import { SignerWithAddress } from './signers'

const isFactoryOptions = (signerOrOptions) => {
  if (!signerOrOptions || signerOrOptions === undefined || signerOrOptions instanceof ethers.Signer) return false
  return true
}

const isArtifact = (artifact) => {
  const {
    contractName,
    sourceName,
    abi,
    bytecode,
    deployedBytecode,
    linkReferences,
    deployedLinkReferences,
  } = artifact

  return (
    typeof contractName === "string" &&
    typeof sourceName === "string" &&
    Array.isArray(abi) &&
    typeof bytecode === "string" &&
    typeof deployedBytecode === "string" &&
    linkReferences !== undefined &&
    deployedLinkReferences !== undefined
  )
}

function linkBytecode(artifact, libraries) {
  let bytecode = artifact.bytecode

  for (const { sourceName, libraryName, address } of libraries) {
    const linkReferences = artifact.linkReferences[sourceName][libraryName]
    for (const { start, length } of linkReferences) {
      bytecode =
        bytecode.substring(0, 2 * start) +
        address.replace('0x', '') +
        bytecode.replace('0x', '').substring(2 * start + 2 * length)
    }
  }

  return bytecode
}

const collectLibrariesAndLink = async (artifact, libraries) => {
  const neededLibraries = []
  for (const [sourceName, sourceLibraries] of Object.entries(artifact.linkReferences)) {
    for (const libName of Object.keys(sourceLibraries)) {
      neededLibraries.push({ sourceName, libName })
    }
  }

  const linksToApply = new Map()
  for (const [linkedLibraryName, linkedLibraryAddress] of Object.entries(libraries)) {
    if (!ethers.utils.isAddress(linkedLibraryAddress)) {
      throw new Error(
        `You tried to link the contract ${artifact.contractName} with the library ${linkedLibraryName}, but provided this invalid address: ${linkedLibraryAddress}`
      )
    }

    const matchingNeededLibraries = neededLibraries.filter((lib) => {
      return (
        lib.libName === linkedLibraryName ||
        `${lib.sourceName}:${lib.libName}` === linkedLibraryName
      )
    })

    if (matchingNeededLibraries.length === 0) {
      let detailedMessage
      if (neededLibraries.length > 0) {
        const libraryFQNames = neededLibraries
          .map((lib) => `${lib.sourceName}:${lib.libName}`)
          .map((x) => `* ${x}`)
          .join("\n")
        detailedMessage = `The libraries needed are:
      ${libraryFQNames}`
      } else {
        detailedMessage = "This contract doesn't need linking any libraries."
      }
      throw new Error(
        `You tried to link the contract ${artifact.contractName} with ${linkedLibraryName}, which is not one of its libraries.
      ${detailedMessage}`
      )
    }

    if (matchingNeededLibraries.length > 1) {
      const matchingNeededLibrariesFQNs = matchingNeededLibraries
        .map(({ sourceName, libName }) => `${sourceName}:${libName}`)
        .map((x) => `* ${x}`)
        .join("\n")
      throw new Error(
        `The library name ${linkedLibraryName} is ambiguous for the contract ${artifact.contractName}.
        It may resolve to one of the following libraries:
        ${matchingNeededLibrariesFQNs}

        To fix this, choose one of these fully qualified library names and replace where appropriate.`
      )
    }

    const [neededLibrary] = matchingNeededLibraries

    const neededLibraryFQN = `${neededLibrary.sourceName}:${neededLibrary.libName}`

    // The only way for this library to be already mapped is
    // for it to be given twice in the libraries user input:
    // once as a library name and another as a fully qualified library name.
    if (linksToApply.has(neededLibraryFQN)) {
      throw new Error(
        `The library names ${neededLibrary.libName} and ${neededLibraryFQN} refer to the same library and were given as two separate library links.
        Remove one of them and review your library links before proceeding.`
      )
    }

    linksToApply.set(neededLibraryFQN, {
      sourceName: neededLibrary.sourceName,
      libraryName: neededLibrary.libName,
      address: linkedLibraryAddress,
    })
  }

  if (linksToApply.size < neededLibraries.length) {
    const missingLibraries = neededLibraries
      .map((lib) => `${lib.sourceName}:${lib.libName}`)
      .filter((libFQName) => !linksToApply.has(libFQName))
      .map((x) => `* ${x}`)
      .join("\n")

    throw new Error(
      `The contract ${artifact.contractName} is missing links for the following libraries:
      ${missingLibraries}`
    )
  }

  return linkBytecode(artifact, [...linksToApply.values()])
}

// Convert output.contracts.<filename>.<contractName> in Artifact object compatible form
const resultToArtifact = (result) => {
  const { fullyQualifiedName, artefact } = result
  return {
    contractName: fullyQualifiedName.split(':')[1],
    sourceName: fullyQualifiedName.split(':')[0],
    abi: artefact.abi,
    bytecode: artefact.evm.bytecode.object,
    deployedBytecode: artefact.evm.deployedBytecode.object,
    linkReferences: artefact.evm.bytecode.linkReferences,
    deployedLinkReferences: artefact.evm.deployedBytecode.linkReferences
  }
}

export const getContractFactory = async (contractNameOrABI, bytecode=null, signerOrOptions = null) => {
  if(typeof contractNameOrABI === 'string') {
    try {
      const result = await window.remix.call('compilerArtefacts', 'getArtefactsByContractName', contractNameOrABI)
      return await getContractFactoryFromArtifact(resultToArtifact(result), signerOrOptions)
    } catch(e) { throw e }
  } else {
    return new ethers.ContractFactory(contractNameOrABI, bytecode, signerOrOptions || (new ethers.providers.Web3Provider(web3Provider)).getSigner())
  }
}

export const getContractAt = async (contractNameOrABI, address, signer = null) => {
  if(typeof contractNameOrABI === 'string') {
    try {
      const result = await window.remix.call('compilerArtefacts', 'getArtefactsByContractName', contractNameOrABI)
      return new ethers.Contract(address, result.artefact.abi, signer || (new ethers.providers.Web3Provider(web3Provider)).getSigner())
    } catch(e) { throw e }
  } else {
    return new ethers.Contract(address, contractNameOrABI, signer || (new ethers.providers.Web3Provider(web3Provider)).getSigner())
  }
}

export const getSigner = async (address) => {
  const signer = window.hardhat.ethers.provider.getSigner(address)
  return SignerWithAddress.create(signer)
}

export const getSigners = async () => {
  try {
    const accounts = await window.hardhat.ethers.provider.listAccounts()
    return await Promise.all( accounts.map((account) => getSigner(account)))
  } catch(err) { throw err }
}

export const getContractFactoryFromArtifact = async (artifact, signerOrOptions = null) => {
  let libraries = {}
  let signer

  if (!isArtifact(artifact)) {
    throw new Error(
      `You are trying to create a contract factory from an artifact, but you have not passed a valid artifact parameter.`
    )
  }

  if (isFactoryOptions(signerOrOptions)) {
    signer = signerOrOptions.signer;
    libraries = signerOrOptions.libraries ?? {};
  } else {
    signer = signerOrOptions;
  }

  if (artifact.bytecode === "0x") {
    throw new Error(
      `You are trying to create a contract factory for the contract ${artifact.contractName}, which is abstract and can't be deployed.
If you want to call a contract using ${artifact.contractName} as its interface use the "getContractAt" function instead.`
    )
  }

  const linkedBytecode = await collectLibrariesAndLink(artifact, libraries)
  return new ethers.ContractFactory(artifact.abi, linkedBytecode || artifact.bytecode, signer || (new ethers.providers.Web3Provider(web3Provider)).getSigner())
}

export const getContractAtFromArtifact = async (artifact, address, signerOrOptions = null) => {
  if (!isArtifact(artifact)) {
    throw new Error(
      `You are trying to create a contract factory from an artifact, but you have not passed a valid artifact parameter.`
    )
  }

  return await getContractAt(artifact.abi, address, signerOrOptions)
}
