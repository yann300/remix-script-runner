'use strict'
import { createClient } from '@remixproject/plugin-iframe'
import { PluginClient } from '@remixproject/plugin'
import { ethers } from 'ethers' // eslint-disable-line
import Web3 from 'web3'
import swarmgw_fn from 'swarmgw'
import * as starknet from 'starknet'
import * as hhEtherMethods from './hhEthers'
const chai = require('chai')
const mocha = require('mocha')
const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END
} = mocha._runnerClass.constants
mocha.setup('bdd')
mocha.checkLeaks()
mocha.cleanReferencesAfterRun(false)

class MochaReporter {
  constructor(runner) {
    const stats = runner.stats
    runner
      .once(EVENT_RUN_BEGIN, () => {
        console.log('Running tests....')
      })
      .on(EVENT_SUITE_BEGIN, (suite) => {
        if(suite.title) {
          console.log(`${this.setIndent(1)} ${suite.title}`)
        }
      })
      .on(EVENT_SUITE_END, (suite) => {
        if(suite.root) suite.suites = []
      })
      .on(EVENT_TEST_PASS, test => {
        console.info(`${this.setIndent(2)} ✓ ${test.title} (${test.duration} ms)`)
      })
      .on(EVENT_TEST_FAIL, (test, err) => {
        console.error(`${this.setIndent(2)} ✘ ${test.title} (${test.duration} ms)`)
        if (err.expected) console.error(`${this.setIndent(3)} Expected: ${err.expected}`)
        if (err.actual) console.error(`${this.setIndent(3)} Actual: ${err.actual}`)
        if (err.message) console.error(`${this.setIndent(3)} Message: ${err.message}`)
      })
      .once(EVENT_RUN_END, () => {
        console.log(`${stats.passes} passing & ${stats.failures} failing (${stats.duration} ms)`)
      })
  }

  setIndent(size) {
    return Array(size).join('  ')
  }
}
mocha.reporter(MochaReporter)
window.swarmgw = swarmgw_fn()
window.ethers = ethers
for(const method in hhEtherMethods) Object.defineProperty(window.ethers, method, { value: hhEtherMethods[method]})
window.Web3 = Web3
window.starknet = starknet
window.chai = chai

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

console.logInternal = console.log
console.log = function () {
   window.remix.emit('log', {
     data: Array.from(arguments)
   })
 }

console.infoInternal = console.info
console.info = function () {
  window.remix.emit('info', {
    data: Array.from(arguments)
  })
}

console.warnInternal = console.warn
console.warn = function () {
  window.remix.emit('warn', {
    data: Array.from(arguments)
  })
}

console.errorInternal = console.error
console.error = function () {
  window.remix.emit('error', {
    data: Array.from(arguments)
  })
}
