const { startIpfs, stopIpfs, config } = require('orbit-db-test-utils')
const createLog = require('./utils/create-log')

const base = {
  prepare: async function () {
    const ipfsd = await startIpfs('js-ipfs', config)
    const { log } = await createLog(ipfsd.api, 'A')

    process.stdout.clearLine()
    for (let i = 1; i < this.count + 1; i++) {
      process.stdout.write(`\r${this.name} / Preparing / Writing: ${i}/${this.count}`)
      await log.append(`Hello World: ${i}`)
    }

    return { log, ipfsd }
  },
  cycle: async function ({ log }) {
    return log.tails()
  },
  teardown: async function ({ ipfsd }) {
    await stopIpfs(ipfsd)
  }
}

const baseline = {
  while: ({ stats, startTime, baselineLimit }) => {
    return stats.count < baselineLimit
  }
}

const stress = {
  while: ({ stats, startTime, stressLimit }) => {
    return process.hrtime(startTime)[0] < stressLimit
  }
}

const counts = [1, 100, 1000, 5000]
const benchmarks = []
for (const count of counts) {
  const c = { count }
  benchmarks.push({ name: `tails-${count}-baseline`, ...base, ...c, ...baseline })
  benchmarks.push({ name: `tails-${count}-stress`, ...base, ...c, ...stress })
}

module.exports = benchmarks
