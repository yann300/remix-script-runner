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