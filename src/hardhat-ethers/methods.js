import { SignerWithAddress } from './signers'

const isFactoryOptions = (signerOrOptions) => {
  if (signerOrOptions === undefined || signerOrOptions instanceof ethers.Signer) return false
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
        bytecode.substr(0, 2 + start * 2) +
        address.substr(2) +
        bytecode.substr(2 + (start + length) * 2)
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

export const getContractFactory = (contractNameOrABI, bytecode=null, signer = null) => {
  return new Promise((resolve, reject) => {
    if(typeof contractNameOrABI === 'string') {
      window.remix.call('compilerArtefacts', 'getArtefactsByContractName', contractNameOrABI)
      .then((result) => {
        resolve(new ethers.ContractFactory(result.abi, result.evm.bytecode.object, signer || (new ethers.providers.Web3Provider(web3Provider)).getSigner()))
      })
      .catch(e => reject(e))
    } else {
      resolve(new ethers.ContractFactory(contractNameOrABI, bytecode, signer || (new ethers.providers.Web3Provider(web3Provider)).getSigner()))
    }
  })
}

export const getContractAt = (contractNameOrABI, address, signer = null) => {
  return new Promise((resolve, reject) => {
    if(typeof contractNameOrABI === 'string') {
      window.remix.call('compilerArtefacts', 'getArtefactsByContractName', contractNameOrABI)
      .then((result) => {
        resolve(new ethers.Contract(address, result.abi, signer || (new ethers.providers.Web3Provider(web3Provider)).getSigner()))
      })
      .catch(e => reject(e))
    } else {
      resolve(new ethers.Contract(address, contractNameOrABI, signer || (new ethers.providers.Web3Provider(web3Provider)).getSigner()))
    }
  })
}

export const getSigner = (address) => {
  return new Promise((resolve, reject) => {
    const signer = window.hardhat.ethers.provider.getSigner(address)
    resolve(SignerWithAddress.create(signer))
  })
}

export const getSigners = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const accounts = await window.hardhat.ethers.provider.listAccounts()
      const signersWithAddress = await Promise.all(
        accounts.map((account) => getSigner(account))
      )
      resolve(signersWithAddress)
    } catch(err) { reject(err) }
  })
}

export const getContractFactoryFromArtifact = (artifact, signerOrOptions = null) => {
  let libraries
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

  collectLibrariesAndLink(artifact, libraries).then(linkedBytecode => {
    return getContractFactory(artifact.abi, linkedBytecode || artifact.bytecode, signer)
  })
}

export const getContractAtFromArtifact = (artifact, address, signerOrOptions = null) => {
  if (!isArtifact(artifact)) {
    throw new Error(
      `You are trying to create a contract factory from an artifact, but you have not passed a valid artifact parameter.`
    )
  }

  return getContractAt(artifact.abi, address, signerOrOptions)
}