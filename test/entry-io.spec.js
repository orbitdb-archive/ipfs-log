'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const fs = require('fs-extra')
const EntryIO = require('../src/entry-io')
const Log = require('../src/log')
const Keystore = require('orbit-db-keystore')
const IdentityProvider = require('orbit-db-identity-provider')

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('orbit-db-test-utils')

let ipfsd, ipfs, testIdentity, testIdentity2, testIdentity3, testIdentity4

const last = arr => arr[arr.length - 1]

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Entry - Persistency (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    let options, keystore, signingKeystore

    before(async () => {
      rmrf.sync(identityKeysPath)
      rmrf.sync(signingKeysPath)
      await fs.copy(identityKeyFixtures, identityKeysPath)
      await fs.copy(signingKeyFixtures, signingKeysPath)
      const defaultOptions = { identityKeysPath, signingKeysPath }

      keystore = new Keystore(identityKeysPath)
      signingKeystore = new Keystore(signingKeysPath)

      const users = ['userA', 'userB', 'userC', 'userD']
      options = users.map((user) => {
        return Object.assign({}, defaultOptions, { id: user, keystore, signingKeystore })
      })

      testIdentity = await IdentityProvider.createIdentity(options[0])
      testIdentity2 = await IdentityProvider.createIdentity(options[1])
      testIdentity3 = await IdentityProvider.createIdentity(options[2])
      testIdentity4 = await IdentityProvider.createIdentity(options[3])
      ipfsd = await startIpfs(IPFS, config.defaultIpfsConfig)
      ipfs = ipfsd.api
    })

    after(async () => {
      await stopIpfs(ipfsd)
      rmrf.sync(identityKeysPath)
      rmrf.sync(signingKeysPath)

      await keystore.close()
      await signingKeystore.close()
    })

    it('log with one entry', async () => {
      const log = new Log(ipfs, testIdentity, { logId: 'X' })
      await log.append('one')
      const values = await log.values()
      const hash = values[0].hash
      const res = await EntryIO.fetchAll(ipfs, hash, { length: 1 })
      assert.strictEqual(res.length, 1)
    })

    it('log with 2 entries', async () => {
      const log = new Log(ipfs, testIdentity, { logId: 'X' })
      await log.append('one')
      await log.append('two')
      const values = await log.values()
      const hash = last(values).hash
      const res = await EntryIO.fetchAll(ipfs, hash, { length: 2 })
      assert.strictEqual(res.length, 2)
    })

    it('loads max 1 entry from a log of 2 entry', async () => {
      const log = new Log(ipfs, testIdentity, { logId: 'X' })
      await log.append('one')
      await log.append('two')
      const values = await log.values()
      const hash = last(values).hash
      const res = await EntryIO.fetchAll(ipfs, hash, { length: 1 })
      assert.strictEqual(res.length, 1)
    })

    it('log with 100 entries', async () => {
      const count = 100
      const log = new Log(ipfs, testIdentity, { logId: 'X' })
      for (let i = 0; i < count; i++) {
        await log.append('hello' + i)
      }
      const hash = await log.toMultihash()
      const result = await Log.fromMultihash(ipfs, testIdentity, hash)
      assert.strictEqual(result.length, count)
    })

    it('load only 42 entries from a log with 100 entries', async () => {
      const count = 100
      const log = new Log(ipfs, testIdentity, { logId: 'X' })
      let log2 = new Log(ipfs, testIdentity, { logId: 'X' })
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        const values2 = await log2.values()
        if (i % 10 === 0) {
          log2 = new Log(ipfs, testIdentity,
            { logId: log2.id, entries: values2, heads: log2.heads.concat(log.heads) })
          await log2.append('hi' + i)
        }
      }

      const hash = await log.toMultihash()
      const result = await Log.fromMultihash(ipfs, testIdentity, hash, { length: 42 })
      assert.strictEqual(result.length, 42)
    })

    it('load only 99 entries from a log with 100 entries', async () => {
      const count = 100
      const log = new Log(ipfs, testIdentity, { logId: 'X' })
      let log2 = new Log(ipfs, testIdentity, { logId: 'X' })
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          const values2 = await log2.values()
          log2 = new Log(ipfs, testIdentity, { logId: log2.id, entries: values2 })
          await log2.append('hi' + i)
          await log2.join(log)
        }
      }

      const hash = await log2.toMultihash()
      const result = await Log.fromMultihash(ipfs, testIdentity, hash, { length: 99 })
      assert.strictEqual(result.length, 99)
    })

    it('load only 10 entries from a log with 100 entries', async () => {
      const count = 100
      const log = new Log(ipfs, testIdentity, { logId: 'X' })
      let log2 = new Log(ipfs, testIdentity, { logId: 'X' })
      let log3 = new Log(ipfs, testIdentity, { logId: 'X' })
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          const values2 = await log2.values()
          log2 = new Log(ipfs, testIdentity,
            { logId: log2.id, entries: values2, heads: log2.heads })
          await log2.append('hi' + i)
          await log2.join(log)
        }
        if (i % 25 === 0) {
          const values3 = await log3.values()
          log3 = new Log(ipfs, testIdentity,
            { logId: log3.id, entries: values3, heads: log3.heads.concat(log2.heads) })
          await log3.append('--' + i)
        }
      }

      await log3.join(log2)
      const hash = await log3.toMultihash()
      const result = await Log.fromMultihash(ipfs, testIdentity, hash, { length: 10 })
      assert.strictEqual(result.length, 10)
    })

    it('load only 10 entries and then expand to max from a log with 100 entries', async () => {
      const count = 30

      const log = new Log(ipfs, testIdentity, { logId: 'X' })
      const log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
      let log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          await log2.append('hi' + i)
          await log2.join(log)
        }
        if (i % 25 === 0) {
          const values3 = await log3.values()
          log3 = new Log(ipfs, testIdentity3,
            { logId: log3.id, entries: values3, heads: log3.heads.concat(log2.heads) })
          await log3.append('--' + i)
        }
      }

      await log3.join(log2)

      const log4 = new Log(ipfs, testIdentity4, { logId: 'X' })
      await log4.join(log2)
      await log4.join(log3)

      const values3 = await log3.values()
      const values4 = await log4.values()

      const entryPayloads3 = values3.map((e) => e.payload)
      const entryPayloads4 = values4.map((e) => e.payload)

      assert.deepStrictEqual(entryPayloads3, entryPayloads4)
    })
  })
})
