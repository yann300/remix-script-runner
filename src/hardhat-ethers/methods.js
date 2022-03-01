import { SignerWithAddress } from './signers'

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

const isArtifact = (artifact) => {
  const {
    contractName,
    sourceName,
    abi,
    bytecode,
    deployedBytecode,
    linkReferences,
    deployedLinkReferences,
  } = artifact;

  return (
    typeof contractName === "string" &&
    typeof sourceName === "string" &&
    Array.isArray(abi) &&
    typeof bytecode === "string" &&
    typeof deployedBytecode === "string" &&
    linkReferences !== undefined &&
    deployedLinkReferences !== undefined
  );
}

export const getContractFactoryFromArtifact = (artifact, signerOrOptions = null) => {
  if (!isArtifact(artifact)) {
    throw new Error(
      `You are trying to create a contract factory from an artifact, but you have not passed a valid artifact parameter.`
    );
  }

  if (artifact.bytecode === "0x") {
    throw new Error(
      `You are trying to create a contract factory for the contract ${artifact.contractName}, which is abstract and can't be deployed.
If you want to call a contract using ${artifact.contractName} as its interface use the "getContractAt" function instead.`
    );
  }

  return getContractFactory(artifact.abi, artifact.bytecode, signerOrOptions)
}

export const getContractAtFromArtifact = (artifact, address, signerOrOptions = null) => {
  if (!isArtifact(artifact)) {
    throw new Error(
      `You are trying to create a contract factory from an artifact, but you have not passed a valid artifact parameter.`
    );
  }

  return getContractAt(artifact.abi, address, signerOrOptions)
}