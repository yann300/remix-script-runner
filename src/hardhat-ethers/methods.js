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