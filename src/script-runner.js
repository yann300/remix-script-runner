'use strict'
import "@babel/polyfill"
import { createClient } from '@remixproject/plugin-iframe'
import { PluginClient } from '@remixproject/plugin'
import { ethers } from 'ethers' // eslint-disable-line
import Web3 from 'web3'
import swarmgw_fn from 'swarmgw'
import * as starknet from 'starknet'
import './runWithMocha'
import * as hhEtherMethods from './hardhat-ethers/methods'
const chai = require('chai')

window.swarmgw = swarmgw_fn()
window.Web3 = Web3
window.starknet = starknet
window.chai = chai
window.ethers = ethers

window.require = (module) => {
  if(window[module]) return window[module]
  else throw new Error(`${module} module require is not supported by Remix IDE`)
}

class CodeExecutor extends PluginClient {
  execute (script) {
    if (script) {
      try {
        (new Function(script))()
      } catch (e) {
        this.emit('error', {
          data: [e.message]
        })
      }
    }
  }
}

window.remix = new CodeExecutor()
createClient(window.remix)

window.web3Provider = {
  sendAsync(payload, callback) {
    window.remix.call('web3Provider', 'sendAsync', payload)
      .then(result => callback(null, result))
      .catch(e => callback(e))
  }
}
window.web3 = new Web3(window.web3Provider)

// Support hardhat-ethers, See: https://hardhat.org/plugins/nomiclabs-hardhat-ethers.html
const hhEthers = ethers
hhEthers.provider = new ethers.providers.Web3Provider(window.web3Provider)
window.hardhat = { ethers: hhEthers}
for(const method in hhEtherMethods) Object.defineProperty(window.hardhat.ethers, method, { value: hhEtherMethods[method]})

console.logInternal = console.log
console.log = function () {
   window.remix.emit('log', {
     data: Array.from(arguments).map((el) => JSON.parse(JSON.stringify(el)))
   })
 }

console.infoInternal = console.info
console.info = function () {
  window.remix.emit('info', {
    data: Array.from(arguments).map((el) => JSON.parse(JSON.stringify(el)))
  })
}

console.warnInternal = console.warn
console.warn = function () {
  window.remix.emit('warn', {
    data: Array.from(arguments).map((el) => JSON.parse(JSON.stringify(el)))
  })
}

console.errorInternal = console.error
console.error = function () {
  window.remix.emit('error', {
    data: Array.from(arguments).map((el) => JSON.parse(JSON.stringify(el)))
  })
}
