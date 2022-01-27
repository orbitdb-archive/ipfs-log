'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const fs = require('fs-extra')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')
const Keystore = require('orbit-db-keystore')

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('orbit-db-test-utils')

let ipfsd, ipfs, testIdentity

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Append (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    let keystore, signingKeystore

    before(async () => {
      rmrf.sync(identityKeysPath)
      rmrf.sync(signingKeysPath)
      await fs.copy(identityKeyFixtures, identityKeysPath)
      await fs.copy(signingKeyFixtures, signingKeysPath)

      keystore = new Keystore(identityKeysPath)
      signingKeystore = new Keystore(signingKeysPath)

      testIdentity = await IdentityProvider.createIdentity({ id: 'userA', keystore, signingKeystore })
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

    describe('append', () => {
      describe('append one', async () => {
        let log

        before(async () => {
          log = new Log(ipfs, testIdentity, 'A')
          await log.append('hello1')
        })

        it('added the correct amount of items', () => {
          assert.strictEqual(log.length, 1)
        })

        it('added the correct values', async () => {
          log.values.forEach((entry) => {
            assert.strictEqual(entry.payload, 'hello1')
          })
        })

        it('added the correct amount of next pointers', async () => {
          log.values.forEach((entry) => {
            assert.strictEqual(entry.next.length, 0)
          })
        })

        it('has the correct heads', async () => {
          log.heads.forEach((head) => {
            assert.strictEqual(head.hash, log.values[0].hash)
          })
        })

        it('updated the clocks correctly', async () => {
          log.values.forEach((entry) => {
            assert.strictEqual(entry.clock.id, testIdentity.publicKey)
            assert.strictEqual(entry.clock.time, 1)
          })
        })
      })

      describe.only('append 10 items to a log', async () => {
        const amount = 100
        const nextPointerAmount = 64

        let log

        before(async () => {
          log = new Log(ipfs, testIdentity, 'A')
          console.time("append all")
          for (let i = 0; i < amount; i++) {
            // await log.append('hello' + i, nextPointerAmount)
            const count = i + 1
            await log.append({ key: 'key' + count, value: 'value' + count }, nextPointerAmount)
            // Make sure the log has the right heads after each append
            // const values = log.values
            // assert.strictEqual(log.heads.length, 1)
            // assert.strictEqual(log.heads[0].hash, values[values.length - 1].hash)
          }
          console.timeEnd("append all")
        })

        it.only('traverse - stops when it finds an entry with the right key (latest entry)', async () => {

          const shouldStop = async (res) => {
            const entries = Object.values(res)
            const last = entries[entries.length - 1]
            if (last) {
              // console.log(">>", entries)
              const entry = last
              return entry.payload.key === 'key7'
            }
            return false
          }

          let entries = []
          for await (let e of log.traverse(log.heads, shouldStop)) {
            // console.log("--", e)
            entries.push(e)
          }

          assert.equal(entries.length, 94)
          const entry = entries[entries.length - 1]
          assert.equal(entry.payload.key, 'key7')
          assert.equal(entry.payload.value, 'value7')
        })

        it('traverse - stops when it finds an entry with the right key (second last entry)', async () => {
          const shouldStop = async (res) => {
            const entries = Object.values(res)
            if (entries[entries.length - 1]) {
              const entry = await log.get(entries[entries.length - 1])
              return entry.payload.key === 'key1'
            }
            return false
          }
          const entries = await log.traverse(log.heads, shouldStop)
          const values = Object.values(entries)
          assert.notEqual(values, undefined)
          assert.notEqual(values[0], undefined)
          assert.equal(values.length, amount - 1)
          const entry = await log.get(values[values.length - 1])
          console.log(entry)
          assert.equal(entry.payload.key, 'key1')
          assert.equal(entry.payload.value, 'value1')
          console.log(values)
        })

        it('traverse - stops when the whole log was traversed and entry with a key was not found', async () => {
          const shouldStop = async (res) => {
            const entries = Object.values(res)
            if (entries[0]) {
              const entry = await log.get(entries[0])
              return entry.payload.key === 'this is not the key'
            }
            return false
          }
          const entries = await log.traverse(log.heads, shouldStop)
          const values = Object.values(entries)
          assert.notEqual(values, undefined)
          assert.notEqual(values[0], undefined)
          assert.equal(values.length, amount)
          const entry = await log.get(values[values.length - 1])
          assert.equal(entry.payload.key, 'key0')
          assert.equal(entry.payload.value, 'value0')
        })

        it('traverse - stops when there are requested amount of entries (all entries)', async () => {
          const shouldStop = async (res) => {
            return Object.values(res).length === amount
          }
          const entries = await log.traverse(log.heads, shouldStop)
          const values = Object.values(entries)
          assert.notEqual(values, undefined)
          assert.equal(values.length, amount)
        })

        it('traverse - stops when there are requested amount of entries (4 entries)', async () => {
          const shouldStop = async (res) => {
            return Object.values(res).length === 4
          }
          const entries = await log.traverse(log.heads, shouldStop)
          const values = Object.values(entries)
          assert.notEqual(values, undefined)
          assert.equal(values.length, 4)
        })

        it.skip('added the correct amount of items', () => {
          assert.strictEqual(log.length, amount)
        })

        it.skip('added the correct values', async () => {
          log.values.forEach((entry, index) => {
            assert.strictEqual(entry.payload, 'hello' + index)
          })
        })

        it.skip('updated the clocks correctly', async () => {
          log.values.forEach((entry, index) => {
            assert.strictEqual(entry.clock.time, index + 1)
            assert.strictEqual(entry.clock.id, testIdentity.publicKey)
          })
        })

        it.skip('added the correct amount of refs pointers', async () => {
          log.values.forEach((entry, index) => {
            assert.strictEqual(entry.refs.length, index > 0 ? Math.ceil(Math.log2(Math.min(nextPointerAmount, index))) : 0)
          })
        })
      })
    })
  })
})
