export const getContractFactory = (contractName, signer = null) => {
    return new Promise((resolve, reject) => {
      window.remix.call('compilerArtefacts', 'getArtefactsByContractName', contractName)
      .then((result) => {
        resolve(new ethers.ContractFactory(result.abi, result.evm.bytecode.object, signer || (new ethers.providers.Web3Provider(web3Provider)).getSigner()))
      })
      .catch(e => reject(e))
    })
  }