'use strict'
import { createClient } from '@remixproject/plugin-iframe'
import { PluginClient } from '@remixproject/plugin'
import { ethers } from 'ethers' // eslint-disable-line
import Web3 from 'web3'
import swarmgw_fn from 'swarmgw'
import * as starknet from 'starknet'
var chai = require('chai')
var browserfs = require('browserfs')
window.swarmgw = swarmgw_fn()
window.ethers = ethers
window.Web3 = Web3

window.onload = () => {
  browserfs.install(window)
  browserfs.configure({
    fs: "LocalStorage"
  }, function(e) {
    console.log('browser fs configured for rsr')
  })
}

class CodeExecutor extends PluginClient {
  execute (script) {
    if (script) {
      try {
        // (new Function(script))()
       const mocha = new Mocha()
       mocha.addFile('default_workspace/scripts/deploy_web3.js')
       console.log('file added, running tests----->')
       const resss = mocha.run()
       console.log('ress----->', resss)
      } catch (e) {
        console.log('error in execute----->', e)
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

window.starknet = starknet
window.chai = chai


// console.log = function () {
//   window.remix.emit('log', {
//     data: Array.from(arguments)
//   })
// }

console.info = function () {
  window.remix.emit('info', {
    data: Array.from(arguments)
  })
}

console.warn = function () {
  window.remix.emit('warn', {
    data: Array.from(arguments)
  })
}

console.error = function () {
  window.remix.emit('error', {
    data: Array.from(arguments)
  })
}
