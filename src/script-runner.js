'use strict'
import "@babel/polyfill"
import * as ts from "typescript";
import { createClient } from '@remixproject/plugin-iframe'
import { PluginClient } from '@remixproject/plugin'
import * as ethersJs from 'ethers' // eslint-disable-line
import multihash from 'multihashes'
import * as web3Js from 'web3'
import Web3 from 'web3'
import swarmgw_fn from 'swarmgw'
import { waffleChai } from "@ethereum-waffle/chai";
import * as starknet from 'starknet'
import './runWithMocha'
import * as path from 'path'
import * as hhEtherMethods from './hardhat-ethers/methods'
const chai = require('chai')
chai.use(waffleChai)

const requiredModule = {
  swarmgw: swarmgw_fn(),
  web3: web3Js,
  starknet: starknet,
  chai: chai,
  ethers: ethersJs,
  multihashes: multihash
}

const scriptReturns = {} // keep track of modules exported values
const fileContents = {} // keep track of file content
window.require = (module) => {
  if (requiredModule[module]) return requiredModule[module] // library
  else if ((module.endsWith('.json') || module.endsWith('.abi')) && window.__execPath__ && fileContents[window.__execPath__]) return JSON.parse(fileContents[window.__execPath__][module])
  else if (window.__execPath__ && scriptReturns[window.__execPath__]) return scriptReturns[window.__execPath__][module] // module exported values
  else throw new Error(`${module} module require is not supported by Remix IDE`)
}

class CodeExecutor extends PluginClient {
  async execute (script, filePath) {
    filePath = filePath || 'scripts/script.ts'
    const paths = filePath.split('/')
    paths.pop()
    const fromPath = paths.join('/') // get current execcution context path
    if (script) {
      try {
        script = ts.transpileModule(script, { moduleName: filePath, filePath,
        compilerOptions: {
         target: ts.ScriptTarget.ES2015,
         module: ts.ModuleKind.CommonJS 
        }});
        script = script.outputText;
        // extract all the "require", execute them and store the returned values.
        const regexp = /require\((.*?)\)/g
        const array = [...script.matchAll(regexp)];

        for (const regex of array) {
          let file = regex[1]
          file = file.slice(0, -1).slice(1) // remove " and '
          let absolutePath = file
          if (file.startsWith('./') || file.startsWith('../')) {            
            absolutePath = path.resolve(fromPath, file)
          }
          if (!scriptReturns[fromPath]) scriptReturns[fromPath] = {}
          if (!fileContents[fromPath]) fileContents[fromPath] = {}
          const { returns, content } = await this.executeFile(absolutePath)
          scriptReturns[fromPath][file] = returns
          fileContents[fromPath][file] = content
        }

        // execute the script
        script = `const exports = {};
                  const module = { exports: {} }
                  window.__execPath__ = "${fromPath}"
                  ${script};
                  return exports || module.exports`
        const returns = (new Function(script))()
        if (mocha.suite && ((mocha.suite.suites && mocha.suite.suites.length) || (mocha.suite.tests && mocha.suite.tests.length))) mocha.run()
        return returns
      } catch (e) {
        this.emit('error', {
          data: [e.message]
        })
      }
    }
  }

  async _resolveFile (fileName) {
    if (await this.call('fileManager', 'exists', fileName)) return await this.call('fileManager', 'readFile', fileName)
    if (await this.call('fileManager', 'exists', fileName + '.ts')) return await this.call('fileManager', 'readFile', fileName + '.ts')
    if (await this.call('fileManager', 'exists', fileName + '.js')) return await this.call('fileManager', 'readFile', fileName + '.js')
  }

  async executeFile (fileName) {
    try {
      if (require(fileName)) return require(fileName)
    } catch (e) {}
    const content = await this._resolveFile(fileName)
    const returns = await this.execute(content, fileName)
    return {returns, content}
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
const { ethers } = ethersJs
ethers.provider = new ethers.providers.Web3Provider(window.web3Provider)
window.hardhat = { ethers }
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
