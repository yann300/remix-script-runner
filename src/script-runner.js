'use strict'
import { createClient } from '@remixproject/plugin-iframe'
import { PluginClient } from '@remixproject/plugin'
import { ethers } from 'ethers' // eslint-disable-line
import Web3 from 'web3'
import swarmgw_fn from 'swarmgw'
import * as starknet from 'starknet'
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

// this reporter outputs test results, indenting two spaces per suite
class MochaReporter {
  constructor(runner) {
    this._indents = 0
    const stats = runner.stats

    runner
      .once(EVENT_RUN_BEGIN, () => {
        console.log('Running tests....')
      })
      .on(EVENT_SUITE_BEGIN, (suite) => {
        if(suite.title) {
          this.increaseIndent()
          console.log(`${suite.title}`)
        }
      })
      .on(EVENT_SUITE_END, (suite) => {
        this.decreaseIndent()
        if(suite.root) suite.suites = []
      })
      .on(EVENT_TEST_PASS, test => {
        console.info(`${this.indent()} ✓ ${test.title} (${test.duration} ms)`)
      })
      .on(EVENT_TEST_FAIL, (test, err) => {
        console.error(`${this.indent()} ✘ ${test.title} (${test.duration} ms)`)
        console.error(`${this.indent()} ${this.indent()} Expected: ${err.expected}`)
        console.error(`${this.indent()} ${this.indent()} Actual: ${err.actual}`)
        console.error(`${this.indent()} ${this.indent()} Message: ${err.message}`)

      })
      .once(EVENT_RUN_END, () => {
        console.log(`${stats.passes} passing & ${stats.failures} failing (${stats.duration} ms)`)
      })
  }

  indent() {
    return Array(this._indents).join('  ')
  }

  increaseIndent() {
    this._indents++
  }

  decreaseIndent() {
    this._indents--
  }
}

mocha.reporter(MochaReporter)

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

window.starknet = starknet
window.chai = chai

console.logInternal = console.log
console.log = function () {
  console.logInternal(arguments)
   window.remix.emit('log', {
     data: Array.from(arguments)
   })
 }

console.infoInternal = console.info
console.info = function () {
  console.infoInternal(arguments)
  window.remix.emit('info', {
    data: Array.from(arguments)
  })
}

console.warnInternal = console.warn
console.warn = function () {
  console.warnInternal(arguments)
  window.remix.emit('warn', {
    data: Array.from(arguments)
  })
}

console.errorInternal = console.error
console.error = function () {
  console.errorInternal(arguments)
  window.remix.emit('error', {
    data: Array.from(arguments)
  })
}
