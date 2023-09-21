'use strict'
import "@babel/polyfill"
import * as ts from "typescript";
import { createClient } from '@remixproject/plugin-iframe'
import { PluginClient } from '@remixproject/plugin'
import Web3 from 'web3'
import { waffleChai } from "@ethereum-waffle/chai";
import './runWithMocha'
import * as path from 'path'
import * as hhEtherMethods from './hardhat-ethers/methods'
import { yarnLoader, yarnContext } from './yarn/yarn-loader'
const chai = require('chai')
chai.use(waffleChai)

window.chai = chai

let currentStopWatch = 0

const scriptReturns = {} // keep track of modules exported values
const fileContents = {} // keep track of file content
window.require = (module) => {  
  if ((module.endsWith('.json') || module.endsWith('.abi')) && window.__execPath__ && fileContents[window.__execPath__]) return JSON.parse(fileContents[window.__execPath__][module])
  else if (window.__execPath__ && scriptReturns[window.__execPath__]) {
    let returns = scriptReturns[window.__execPath__][module] || scriptReturns[window.__execPath__][module + '.js'] // module exported values
    if (module === 'ethers') {
      // Support hardhat-ethers, See: https://hardhat.org/plugins/nomiclabs-hardhat-ethers.html
      returns.provider = new ethers.providers.Web3Provider(window.web3Provider)
      for(const method in hhEtherMethods) Object.defineProperty(returns, method, { value: hhEtherMethods[method]})
    }
    return returns
  } else {
    throw new Error(`${module} module require is not supported by Remix IDE`)    
  }
}

class CodeExecutor extends PluginClient {
  onActivation () {
    this.on('filePanel', 'setWorkspace', (workspace) => {
      console.log('opening a new workspace in script runner ', workspace)
      yarnLoader(this)
    })
  }
  async execute (script, filePath) {
    filePath = filePath || 'scripts/script.ts'
    const paths = filePath.split('/')
    paths.pop()
    const fromPath = paths.join('/') // get current execution context path
    if (script) {
      try {
        script = ts.transpileModule(script, { moduleName: filePath, filePath,
        compilerOptions: {
         target: ts.ScriptTarget.ES2015,
         module: ts.ModuleKind.CommonJS,
         esModuleInterop: true,  
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
        script = `let exports = {};
                  let module = { exports: {} }
                  window.__execPath__ = "${fromPath}"
                  ${script};
                  if (Object.keys(exports).length) {
                    return exports
                  } else {
                    return module.exports
                  }
                  `
        const returns = (new Function(script))()
        if (mocha.suite && ((mocha.suite.suites && mocha.suite.suites.length) || (mocha.suite.tests && mocha.suite.tests.length))) {
          console.log(`RUNS ${filePath}....`)
          mocha.run()
        } 
        return returns
      } catch (e) {
        this.emit('error', {
          data: [e.message]
        })
      }
    }
  }

  async _resolveRemixFileSystem(fileName) {
    if (await this.call('fileManager', 'exists', fileName)) return { content: await this.call('fileManager', 'readFile', fileName) }
    if (await this.call('fileManager', 'exists', fileName + '.ts')) return { content: await this.call('fileManager', 'readFile', fileName + '.ts') }
    if (await this.call('fileManager', 'exists', fileName + '.js')) return { content: await this.call('fileManager', 'readFile', fileName + '.js') }
    return {content: null}
  }

  async _resolveYarnFileSystem(fileName) {
    let path = fileName.indexOf('/app/node_modules/') !== -1 ? fileName : `/app/node_modules/${fileName}`
    let content
    let isDirectory = false
    try {
      isDirectory = yarnContext.memfs.lstatSync(path).isDirectory()
    } catch (e) {}
    
    if (isDirectory) {
      let main = null

      // main property of package.json
      const packageJson = `/app/node_modules/${fileName}/package.json`
      const isFile = yarnContext.memfs.lstatSync(packageJson).isFile()
      if (isFile) {
        const json = JSON.parse(yarnContext.memfs.readFileSync(packageJson, { encoding: 'utf8' }))
        if (json.main) main = `/app/node_modules/${fileName}/${json.main}`
      }

      if (!main) {
        // looking for an entry point
        const hasDistDirectory = yarnContext.memfs.lstatSync(`/app/node_modules/${fileName}/dist`).isDirectory()    
        if (hasDistDirectory) {
          // dist folder
          const hasDistBuild = yarnContext.memfs.lstatSync(`/app/node_modules/${fileName}/dist/${fileName}.js`).isFile()
          if (hasDistBuild) main = `/app/node_modules/${fileName}/dist/${fileName}.js`
        }
      }
      
      if (main) {
        content = yarnContext.memfs.readFileSync(main, { encoding: 'utf8' })
        return  { content, path: main }
      }      
      return { content: null} 
    }
    
    let isFile = false
    try {
      isFile = yarnContext.memfs.lstatSync(path).isFile()
    } catch (e) {}
    
    if (isFile) {
      content = yarnContext.memfs.readFileSync(path, { encoding: 'utf8' })
      return { content, path } 
    }

    if (!path.endsWith('.js')) path = path + '.js'
    try {
      isFile = yarnContext.memfs.lstatSync(path).isFile()
    } catch (e) {}
    
    if (isFile) {
      content = yarnContext.memfs.readFileSync(path, { encoding: 'utf8' })
      return { content, path } 
    }
    return { content: null }
  }

  async _resolveFile (fileName) {
    const { content, path } = await this._resolveRemixFileSystem(fileName)
    if (content) return { content, path }
    const ret = await this._resolveYarnFileSystem(fileName)
    return ret
  }

  async executeFile (fileName) {
    try {
      if (require(fileName)) return require(fileName)
    } catch (e) {}
    const { content, path } = await this._resolveFile(fileName)
    const returns = await this.execute(content, path || fileName)
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
window.provider = web3Provider
window.ethereum = web3Provider

window.web3 = new Web3(window.web3Provider)

console.logInternal = console.log
console.log = function () {
   window.remix.emit('log', {
     data: Array.from(arguments).map((el) => el ? JSON.parse(JSON.stringify(el)) : 'undefined')
   })
 }

console.infoInternal = console.info
console.info = function () {
  window.remix.emit('info', {
    data: Array.from(arguments).map((el) => el ? JSON.parse(JSON.stringify(el)) : 'undefined')
  })
}

console.warnInternal = console.warn
console.warn = function () {
  window.remix.emit('warn', {
    data: Array.from(arguments).map((el) => el ? JSON.parse(JSON.stringify(el)) : 'undefined')
  })
}

console.errorInternal = console.error
console.error = function () {
  window.remix.emit('error', {
    data: Array.from(arguments).map((el) => el ? JSON.parse(JSON.stringify(el)) : 'undefined')
  })
}
