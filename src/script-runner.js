'use strict'
import { createClient } from '@remixproject/plugin-iframe';
import { PluginClient } from '@remixproject/plugin';
import { ethers } from 'ethers' // eslint-disable-line
import Web3 from 'web3'
import swarmgw_fn from 'swarmgw'
window.swarmgw = swarmgw_fn()
window.ethers = ethers
window.Web3 = Web3

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

console.log = function () {
  window.remix.emit('log', {
    data: Array.from(arguments)
  })
}

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
