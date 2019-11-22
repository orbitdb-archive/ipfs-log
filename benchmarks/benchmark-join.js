'use strict'

const IPFS = require('ipfs')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')
const Keystore = require('orbit-db-keystore')

const leveldown = require('leveldown')
const storage = require('orbit-db-storage-adapter')(leveldown)

// State
let ipfs
let log1, log2

// Metrics
let totalQueries = 0
let seconds = 0
let queriesPerSecond = 0
let lastTenSeconds = 0

const queryLoop = async () => {
  try {
    await Promise.all([
      log1.append('a' + totalQueries),
      log2.append('b' + totalQueries)
    ])

    await log1.join(log2)
    await log2.join(log1)
    totalQueries++
    lastTenSeconds++
    queriesPerSecond++
    setImmediate(queryLoop)
  } catch (e) {
    console.error(e)
    process.exit(0)
  }
}

let run = (() => {
  console.log('Starting benchmark...')

  const repoConf = {
    storageBackends: {
      blocks: DatastoreLevel
    }
  }

  ipfs = new IPFS({
    repo: new IPFSRepo('./ipfs-log-benchmarks/ipfs', repoConf),
    start: false,
    EXPERIMENTAL: {
      pubsub: true
    }
  })

  ipfs.on('error', (err) => {
    console.error(err)
    process.exit(1)
  })

  ipfs.on('ready', async () => {
    // Use memory store to test without disk IO
    // const memstore = new MemStore()
    // ipfs.dag.put = memstore.put.bind(memstore)
    // ipfs.dag.get = memstore.get.bind(memstore)

    const signingKeysPath1 = './benchmarks/ipfs-log-benchmarks/keys1'
    const signingKeysPath2 = './benchmarks/ipfs-log-benchmarks/keys2'
    // const identity = await IdentityProvider.createIdentity({ id: 'userA', signingKeysPath1 })
    // const identity2 = await IdentityProvider.createIdentity({ id: 'userB', signingKeysPath2 })

    const store1 = await storage.createStore(signingKeysPath1)
    const store2 = await storage.createStore(signingKeysPath2)
    const keystore1 = new Keystore(store1)
    const keystore2 = new Keystore(store2)

    const identities = new IdentityProvider({ keystore: keystore1 })
    const identity = await identities.createIdentity({ id: 'userA' })
    const identity2 = await identities.createIdentity({ id: 'userB', keystore: keystore2 })

    log1 = new Log(ipfs, identity, identities, { logId: 'A' })
    log2 = new Log(ipfs, identity2, identities, { logId: 'A' })

    // Output metrics at 1 second interval
    setInterval(() => {
      seconds++
      if (seconds % 10 === 0) {
        console.log(`--> Average of ${lastTenSeconds / 10} q/s in the last 10 seconds`)
        if (lastTenSeconds === 0) throw new Error('Problems!')
        lastTenSeconds = 0
      }
      console.log(`${queriesPerSecond} queries per second, ${totalQueries} queries in ${seconds} seconds. log1: ${log1.length}, log2: ${log2.length}`)
      queriesPerSecond = 0
    }, 1000)

    queryLoop()
  })
})()

module.exports = run
