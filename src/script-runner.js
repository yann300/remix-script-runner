'use strict'
import { createClient } from '@remixproject/plugin-iframe'
import { PluginClient } from '@remixproject/plugin'
import { ethers } from 'ethers' // eslint-disable-line
import Web3 from 'web3'
import swarmgw_fn from 'swarmgw'
import * as starknet from 'starknet'
var chai = require('chai')
var mocha = require('mocha')
mocha.setup('bdd')
mocha.checkLeaks()
mocha.cleanReferencesAfterRun(false)

const mochaConstant = {
  /**
   * Emitted when {@link Hook} execution begins
   */
  EVENT_HOOK_BEGIN: 'hook',
  /**
   * Emitted when {@link Hook} execution ends
   */
  EVENT_HOOK_END: 'hook end',
  /**
   * Emitted when Root {@link Suite} execution begins (all files have been parsed and hooks/tests are ready for execution)
   */
  EVENT_RUN_BEGIN: 'start',
  /**
   * Emitted when Root {@link Suite} execution has been delayed via `delay` option
   */
  EVENT_DELAY_BEGIN: 'waiting',
  /**
   * Emitted when delayed Root {@link Suite} execution is triggered by user via `global.run()`
   */
  EVENT_DELAY_END: 'ready',
  /**
   * Emitted when Root {@link Suite} execution ends
   */
  EVENT_RUN_END: 'end',
  /**
   * Emitted when {@link Suite} execution begins
   */
  EVENT_SUITE_BEGIN: 'suite',
  /**
   * Emitted when {@link Suite} execution ends
   */
  EVENT_SUITE_END: 'suite end',
  /**
   * Emitted when {@link Test} execution begins
   */
  EVENT_TEST_BEGIN: 'test',
  /**
   * Emitted when {@link Test} execution ends
   */
  EVENT_TEST_END: 'test end',
  /**
   * Emitted when {@link Test} execution fails
   */
  EVENT_TEST_FAIL: 'fail',
  /**
   * Emitted when {@link Test} execution succeeds
   */
  EVENT_TEST_PASS: 'pass',
  /**
   * Emitted when {@link Test} becomes pending
   */
  EVENT_TEST_PENDING: 'pending',
  /**
   * Emitted when {@link Test} execution has failed, but will retry
   */
  EVENT_TEST_RETRY: 'retry',
  /**
     * Initial state of Runner
     */
   STATE_IDLE: 'idle',
   /**
    * State set to this value when the Runner has started running
    */
   STATE_RUNNING: 'running',
   /**
    * State set to this value when the Runner has stopped
    */
   STATE_STOPPED: 'stopped'
 }


// this reporter outputs test results, indenting two spaces per suite
class MochaReporter {
  constructor(runner) {
    this._indents = 0
    const stats = runner.stats

    runner
      .once(mochaConstant.EVENT_RUN_BEGIN, () => {
        console.log('Running tests ....')
      })
      .on(mochaConstant.EVENT_SUITE_BEGIN, (suite) => {
        this.increaseIndent()
        console.log(`${this.indent()}${suite.title}`)
      })
      .on(mochaConstant.EVENT_SUITE_END, (suite) => {
        this.decreaseIndent()
        if(suite.root) suite.suites = []
      })
      .on(mochaConstant.EVENT_TEST_PASS, test => {
        console.log(`${this.indent()}pass: ${test.title}`)
      })
      .on(mochaConstant.EVENT_TEST_FAIL, (test, err) => {
        console.log(
          `${this.indent()}fail: ${test.title} - error: ${err.message}`
        )
      })
      .once(mochaConstant.EVENT_RUN_END, () => {
        console.log(`end: ${stats.passes}/${stats.passes + stats.failures} ok`)
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
