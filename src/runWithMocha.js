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
        if(suite.root) {
          suite.suites = []
          suite.tests = []
        }
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
        console.log(`${stats.passes} passing, ${stats.failures} failing (${stats.duration} ms)`)
      })
  }

  setIndent(size) {
    return Array(size).join('  ')
  }
}
mocha.reporter(MochaReporter)