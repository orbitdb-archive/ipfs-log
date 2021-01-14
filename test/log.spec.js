'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const { CID } = require('multiformats/cid')
const { base58btc } = require('multiformats/bases/base58')
const Clock = require('../src/lamport-clock')
const Entry = require('../src/entry')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')
const Keystore = require('orbit-db-keystore')
const fs = require('fs-extra')
const io = require('orbit-db-io')

// For tiebreaker testing
const { LastWriteWins } = require('../src/log-sorting')
const FirstWriteWins = (a, b) => LastWriteWins(a, b) * -1

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('orbit-db-test-utils')

let ipfsd, ipfs, testIdentity, testIdentity2, testIdentity3

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    let keystore, signingKeystore

    before(async () => {
      await fs.copy(identityKeyFixtures, identityKeysPath)
      await fs.copy(signingKeyFixtures, signingKeysPath)

      keystore = new Keystore(identityKeysPath)
      signingKeystore = new Keystore(signingKeysPath)

      testIdentity = await IdentityProvider.createIdentity({ id: 'userA', keystore, signingKeystore })
      testIdentity2 = await IdentityProvider.createIdentity({ id: 'userB', keystore, signingKeystore })
      testIdentity3 = await IdentityProvider.createIdentity({ id: 'userC', keystore, signingKeystore })
      ipfsd = await startIpfs(IPFS, config.defaultIpfsConfig)
      ipfs = ipfsd.api
    })

    after(async () => {
      await stopIpfs(ipfsd)
      rmrf.sync(signingKeysPath)
      rmrf.sync(identityKeysPath)

      await keystore.close()
      await signingKeystore.close()
    })

    describe('constructor', async () => {
      it('creates an empty log with default params', () => {
        const log = new Log(ipfs, testIdentity)
        assert.notStrictEqual(log._entryIndex, null)
        assert.notStrictEqual(log._headsIndex, null)
        assert.notStrictEqual(log._hashIndex, new Map())
        assert.notStrictEqual(log._id, null)
        assert.notStrictEqual(log.id, null)
        assert.notStrictEqual(log.clock, null)
        assert.notStrictEqual(log.heads, null)
      })

      it('throws an error if IPFS instance is not passed as an argument', () => {
        let err
        try {
          const log = new Log() // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'IPFS instance not defined')
      })

      it('sets an id', () => {
        const log = new Log(ipfs, testIdentity, { logId: 'ABC' })
        assert.strictEqual(log.id, 'ABC')
      })

      it('sets the clock id', () => {
        const log = new Log(ipfs, testIdentity, { logId: 'ABC' })
        assert.strictEqual(log.id, 'ABC')
        assert.strictEqual(log.clock.id, testIdentity.publicKey)
      })

      it('generates id string if id is not passed as an argument', () => {
        const log = new Log(ipfs, testIdentity)
        assert.strictEqual(typeof log.id === 'string', true)
      })

      it('sets items if given as params', async () => {
        const one = await Entry.create(ipfs, testIdentity, 'A', 'entryA', [], new Clock('A', 0))
        const two = await Entry.create(ipfs, testIdentity, 'A', 'entryB', [], new Clock('B', 0))
        const three = await Entry.create(ipfs, testIdentity, 'A', 'entryC', [], new Clock('C', 0))
        const log = new Log(ipfs, testIdentity,
          { logId: 'A', entries: [one, two, three] })
        const values = await log.values()
        assert.strictEqual(log.length, 3)
        assert.strictEqual(values[0].payload, 'entryA')
        assert.strictEqual(values[1].payload, 'entryB')
        assert.strictEqual(values[2].payload, 'entryC')
      })

      it('sets heads if given as params', async () => {
        const one = await Entry.create(ipfs, testIdentity, 'A', 'entryA', [])
        const two = await Entry.create(ipfs, testIdentity, 'A', 'entryB', [])
        const three = await Entry.create(ipfs, testIdentity, 'A', 'entryC', [])
        const log = new Log(ipfs, testIdentity,
          { logId: 'B', entries: [one, two, three], heads: [three] })
        assert.strictEqual(log.heads.length, 1)
        assert.strictEqual(log.heads[0].hash, three.hash)
      })

      it('finds heads if heads not given as params', async () => {
        const one = await Entry.create(ipfs, testIdentity, 'A', 'entryA', [])
        const two = await Entry.create(ipfs, testIdentity, 'A', 'entryB', [])
        const three = await Entry.create(ipfs, testIdentity, 'A', 'entryC', [])
        const log = new Log(ipfs, testIdentity,
          { logId: 'A', entries: [one, two, three] })
        assert.strictEqual(log.heads.length, 3)
        assert.strictEqual(log.heads[2].hash, one.hash)
        assert.strictEqual(log.heads[1].hash, two.hash)
        assert.strictEqual(log.heads[0].hash, three.hash)
      })

      it('throws an error if entries is not an array', () => {
        let err
        try {
          const log = new Log(ipfs, testIdentity, { logId: 'A', entries: {} }) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, undefined)
        assert.strictEqual(err.message, '\'entries\' argument must be an array of Entry instances')
      })

      it('throws an error if heads is not an array', () => {
        let err
        try {
          const log = new Log(ipfs, testIdentity, { logId: 'A', entries: [], heads: {} }) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, undefined)
        assert.strictEqual(err.message, '\'heads\' argument must be an array')
      })

      it('creates default public AccessController if not defined', async () => {
        const log = new Log(ipfs, testIdentity) // eslint-disable-line no-unused-vars
        const anyoneCanAppend = await log._access.canAppend('any')
        assert.notStrictEqual(log._access, undefined)
        assert.strictEqual(anyoneCanAppend, true)
      })

      it('throws an error if identity is not defined', () => {
        let err
        try {
          const log = new Log(ipfs) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, undefined)
        assert.strictEqual(err.message, 'Identity is required')
      })
    })

    describe('toString', async () => {
      let log
      const expectedData = 'five\n└─four\n  └─three\n    └─two\n      └─one'

      beforeEach(async () => {
        log = new Log(ipfs, testIdentity, { logId: 'A' })
        await log.append('one')
        await log.append('two')
        await log.append('three')
        await log.append('four')
        await log.append('five')
      })

      it('returns a nicely formatted string', async () => {
        const logString = await log.toString()
        assert.strictEqual(logString, expectedData)
      })
    })

    describe('get', async () => {
      let log

      beforeEach(async () => {
        log = new Log(ipfs, testIdentity, { logId: 'AAA' })
        await log.append('one')
      })

      it('returns an Entry', async () => {
        const values = await log.values()
        const entry = await log.get(values[0].hash)
        assert.deepStrictEqual(entry.hash, 'zdpuAoFzNYcuuQHk1gLcB8fomHGrqT9k1uQeAvewZJ1cSYrms')
      })

      it('returns undefined when Entry is not in the log', async () => {
        const entry = await log.get('QmFoo')
        assert.deepStrictEqual(entry, undefined)
      })
    })

    describe('setIdentity', () => {
      let log

      beforeEach(async () => {
        log = new Log(ipfs, testIdentity, { logId: 'AAA' })
        await log.append('one')
      })

      it('changes identity', async () => {
        let values = await log.values()
        assert.strictEqual(values[0].clock.id, testIdentity.publicKey)
        assert.strictEqual(values[0].clock.time, 1)
        log.setIdentity(testIdentity2)
        await log.append('two')
        values = await log.values()
        assert.strictEqual(values[1].clock.id, testIdentity2.publicKey)
        assert.strictEqual(values[1].clock.time, 2)
        log.setIdentity(testIdentity3)
        await log.append('three')
        values = await log.values()
        assert.strictEqual(values[2].clock.id, testIdentity3.publicKey)
        assert.strictEqual(values[2].clock.time, 3)
      })
    })

    describe('has', async () => {
      let log, expectedData

      before(async () => {
        expectedData = {
          hash: 'zdpuAoFzNYcuuQHk1gLcB8fomHGrqT9k1uQeAvewZJ1cSYrms',
          id: 'AAA',
          payload: 'one',
          next: [],
          v: 1,
          clock: new Clock(testIdentity.publicKey, 1),
          key: testIdentity.toJSON()
        }

        const sig = await testIdentity.provider.sign(testIdentity, Buffer.from(JSON.stringify(expectedData)))
        Object.assign(expectedData, { sig })
      })

      beforeEach(async () => {
        log = new Log(ipfs, testIdentity, { logId: 'AAA' })
        await log.append('one')
      })

      it('returns true if it has an Entry', () => {
        assert.strictEqual(log.has(expectedData), true)
      })

      it('returns true if it has an Entry, hash lookup', () => {
        assert.strictEqual(log.has(expectedData.hash), true)
      })

      it('returns false if it doesn\'t have the Entry', () => {
        assert.strictEqual(log.has('zdFoo'), false)
      })
    })

    describe('serialize', async () => {
      let log
      const expectedData = {
        id: 'AAA',
        heads: ['zdpuApASvEM59JKWn7Y39JWVSoiQ2CoJWpWseNTzqWvX1dRtC']
      }

      beforeEach(async () => {
        log = new Log(ipfs, testIdentity, { logId: 'AAA' })
        await log.append('one')
        await log.append('two')
        await log.append('three')
      })

      describe('toJSON', () => {
        it('returns the log in JSON format', () => {
          assert.strictEqual(JSON.stringify(log.toJSON()), JSON.stringify(expectedData))
        })
      })

      describe('toSnapshot', () => {
        const expectedData = {
          id: 'AAA',
          heads: ['zdpuApASvEM59JKWn7Y39JWVSoiQ2CoJWpWseNTzqWvX1dRtC'],
          values: [
            'zdpuAoFzNYcuuQHk1gLcB8fomHGrqT9k1uQeAvewZJ1cSYrms',
            'zdpuAo5DjP7XfnJqe8v8RTedi44Xg2w49Wb9xwRBdzf3LNJCV',
            'zdpuApASvEM59JKWn7Y39JWVSoiQ2CoJWpWseNTzqWvX1dRtC'
          ]
        }

        it('returns the log snapshot', async () => {
          const snapshot = await log.toSnapshot()
          assert.strictEqual(snapshot.id, expectedData.id)
          assert.strictEqual(snapshot.heads.length, expectedData.heads.length)
          assert.strictEqual(snapshot.heads[0].hash, expectedData.heads[0])
          assert.strictEqual(snapshot.values.length, expectedData.values.length)
          assert.strictEqual(snapshot.values[0].hash, expectedData.values[0])
          assert.strictEqual(snapshot.values[1].hash, expectedData.values[1])
          assert.strictEqual(snapshot.values[2].hash, expectedData.values[2])
        })
      })

      describe('toBuffer', () => {
        it('returns the log as a Buffer', () => {
          assert.deepStrictEqual(log.toBuffer(), Buffer.from(JSON.stringify(expectedData)))
        })
      })

      describe('toMultihash - cbor', async () => {
        it('returns the log as ipfs CID', async () => {
          const expectedCid = 'zdpuAwC43AQmYEPAnmidtfuUdBQSWuK95z1446UntBMhrqdto'
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const hash = await log.toMultihash()
          assert.strictEqual(hash, expectedCid)
        })

        it('log serialized to ipfs contains the correct data', async () => {
          const expectedData = {
            id: 'A',
            heads: ['zdpuAky58cAEgNyxPGotdCZny1sfk7ima9FJVtPTydDgrCFZw']
          }
          const expectedCid = 'zdpuAwC43AQmYEPAnmidtfuUdBQSWuK95z1446UntBMhrqdto'
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const hash = await log.toMultihash()
          assert.strictEqual(hash, expectedCid)
          const result = await io.read(ipfs, hash)
          const heads = result.heads.map(head => head.toString(base58btc))
          assert.deepStrictEqual(heads, expectedData.heads)
        })

        it('throws an error if log items is empty', async () => {
          const emptyLog = new Log(ipfs, testIdentity)
          let err
          try {
            await emptyLog.toMultihash()
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'Can\'t serialize an empty log')
        })
      })

      describe('toMultihash - pb', async () => {
        it('returns the log as ipfs multihash', async () => {
          const expectedMultihash = 'QmSgYrc2cbLghngrBWJtNvmh282BrUgtGxzjYhEuPgC7Sj'
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const multihash = await log.toMultihash({ format: 'dag-pb' })
          assert.strictEqual(multihash, expectedMultihash)
        })

        it('log serialized to ipfs contains the correct data', async () => {
          const expectedData = {
            id: 'A',
            heads: ['zdpuAky58cAEgNyxPGotdCZny1sfk7ima9FJVtPTydDgrCFZw']
          }
          const expectedMultihash = 'QmSgYrc2cbLghngrBWJtNvmh282BrUgtGxzjYhEuPgC7Sj'
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const multihash = await log.toMultihash({ format: 'dag-pb' })
          assert.strictEqual(multihash, expectedMultihash)
          const result = await ipfs.object.get(CID.parse(multihash))
          const res = JSON.parse(Buffer.from(result.Data).toString())
          assert.deepStrictEqual(res.heads, expectedData.heads)
        })

        it('throws an error if log items is empty', async () => {
          const emptyLog = new Log(ipfs, testIdentity)
          let err
          try {
            await emptyLog.toMultihash()
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'Can\'t serialize an empty log')
        })
      })

      describe('fromMultihash', async () => {
        it('creates a log from ipfs CID - one entry', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB23XC5xJBJbfk5d9EfpWjX56VqTu3z4CUzVf2mxVURnEy']
          }
          const log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const hash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, hash, -1)
          const values = await res.values()
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          assert.strictEqual(res.length, 1)
          assert.strictEqual(values[0].payload, 'one')
          assert.strictEqual(values[0].clock.id, testIdentity.publicKey)
          assert.strictEqual(values[0].clock.time, 1)
        })

        it('creates a log from ipfs CID - three entries', async () => {
          const hash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, hash, -1)
          const values = await res.values()
          assert.strictEqual(res.length, 3)
          assert.strictEqual(values[0].payload, 'one')
          assert.strictEqual(values[0].clock.time, 1)
          assert.strictEqual(values[1].payload, 'two')
          assert.strictEqual(values[1].clock.time, 2)
          assert.strictEqual(values[2].payload, 'three')
          assert.strictEqual(values[2].clock.time, 3)
        })

        it('creates a log from ipfs multihash (backwards compat)', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB23XC5xJBJbfk5d9EfpWjX56VqTu3z4CUzVf2mxVURnEy']
          }
          const log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const multihash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, multihash, { length: -1 })
          const values = await res.values()
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          assert.strictEqual(res.length, 1)
          assert.strictEqual(values[0].payload, 'one')
          assert.strictEqual(values[0].clock.id, testIdentity.publicKey)
          assert.strictEqual(values[0].clock.time, 1)
        })

        it('has the right sequence number after creation and appending', async () => {
          const hash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, hash, { length: -1 })
          let values = await res.values()
          assert.strictEqual(res.length, 3)
          await res.append('four')
          values = await res.values()
          assert.strictEqual(res.length, 4)
          assert.strictEqual(values[3].payload, 'four')
          assert.strictEqual(values[3].clock.time, 4)
        })

        it('creates a log from ipfs CID that has three heads', async () => {
          const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
          const log2 = new Log(ipfs, testIdentity2, { logId: 'A' })
          const log3 = new Log(ipfs, testIdentity3, { logId: 'A' })
          await log1.append('one') // order is determined by the identity's publicKey
          await log2.append('two')
          await log3.append('three')
          await log1.join(log2)
          await log1.join(log3)
          const hash = await log1.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, hash, { length: -1 })
          assert.strictEqual(res.length, 3)
          assert.strictEqual(res.heads.length, 3)
          assert.strictEqual(res.heads[2].payload, 'three')
          assert.strictEqual(res.heads[1].payload, 'two') // order is determined by the identity's publicKey
          assert.strictEqual(res.heads[0].payload, 'one')
        })

        it('creates a log from ipfs CID that has three heads w/ custom tiebreaker', async () => {
          const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
          const log2 = new Log(ipfs, testIdentity2, { logId: 'A' })
          const log3 = new Log(ipfs, testIdentity3, { logId: 'A' })
          await log1.append('one') // order is determined by the identity's publicKey
          await log2.append('two')
          await log3.append('three')
          await log1.join(log2)
          await log1.join(log3)
          const hash = await log1.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, hash,
            { sortFn: FirstWriteWins })
          assert.strictEqual(res.length, 3)
          assert.strictEqual(res.heads.length, 3)
          assert.strictEqual(res.heads[2].payload, 'one')
          assert.strictEqual(res.heads[1].payload, 'two') // order is determined by the identity's publicKey
          assert.strictEqual(res.heads[0].payload, 'three')
        })

        it('creates a log from ipfs CID up to a size limit', async () => {
          const amount = 100
          const size = amount / 2
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }
          const hash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, hash, { length: size })
          assert.strictEqual(res.length, size)
        })

        it('creates a log from ipfs CID up without size limit', async () => {
          const amount = 100
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }
          const hash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, hash, { length: -1 })
          assert.strictEqual(res.length, amount)
        })

        it('throws an error if ipfs is not defined', async () => {
          let err
          try {
            await Log.fromMultihash()
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'IPFS instance not defined')
        })

        it('throws an error if hash is not defined', async () => {
          let err
          try {
            await Log.fromMultihash(ipfs)
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'Invalid hash: undefined')
        })

        it('throws an error if data from hash is not valid JSON', async () => {
          const value = 'hello'
          const cid = CID.parse(await io.write(ipfs, 'dag-pb', value))
          let err
          try {
            const hash = cid.toString(base58btc)
            await Log.fromMultihash(ipfs, testIdentity, hash)
          } catch (e) {
            err = e
          }
          assert.strictEqual(err.message, 'Unexpected token h in JSON at position 0')
        })

        it('throws an error when data from CID is not instance of Log', async () => {
          const hash = await ipfs.dag.put({})
          let err
          try {
            await Log.fromMultihash(ipfs, testIdentity, hash)
          } catch (e) {
            err = e
          }
          assert.strictEqual(err.message, 'Given argument is not an instance of Log')
        })

        it('onProgress callback is fired for each entry', async () => {
          const amount = 100
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }

          const items = await log.values()
          let i = 0
          const loadProgressCallback = (entry) => {
            assert.notStrictEqual(entry, null)
            assert.strictEqual(entry.hash, items[items.length - i - 1].hash)
            assert.strictEqual(entry.payload, items[items.length - i - 1].payload)
            i++
          }

          const hash = await log.toMultihash()
          const result = await Log.fromMultihash(ipfs, testIdentity, hash,
            { length: -1, exclude: [], onProgressCallback: loadProgressCallback })

          const values = await result.values()
          // Make sure the onProgress callback was called for each entry
          assert.strictEqual(i, amount)
          // Make sure the log entries are correct ones
          assert.strictEqual(values[0].clock.time, 1)
          assert.strictEqual(values[0].payload, '0')
          assert.strictEqual(values[result.length - 1].clock.time, 100)
          assert.strictEqual(values[result.length - 1].payload, '99')
        })
      })

      describe('fromEntryHash', async () => {
        afterEach(() => {
          if (Log.fromEntryHash.restore) {
            Log.fromEntryHash.restore()
          }
        })

        it('calls fromEntryHash', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB23XC5xJBJbfk5d9EfpWjX56VqTu3z4CUzVf2mxVURnEy']
          }
          const log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const res = await Log.fromEntryHash(ipfs, testIdentity, expectedData.heads[0],
            { logId: log.id, length: -1 })
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        })
      })

      describe('fromMultihash', async () => {
        afterEach(() => {
          if (Log.fromMultihash.restore) {
            Log.fromMultihash.restore()
          }
        })

        it('calls fromMultihash', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB23XC5xJBJbfk5d9EfpWjX56VqTu3z4CUzVf2mxVURnEy']
          }
          const log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const multihash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, multihash, { length: -1 })
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        })

        it('calls fromMultihash with custom tiebreaker', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB23XC5xJBJbfk5d9EfpWjX56VqTu3z4CUzVf2mxVURnEy']
          }
          const log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const multihash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, multihash,
            { length: -1, sortFn: FirstWriteWins })
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        })
      })
    })

    describe('values', () => {
      it('returns all entries in the log', async () => {
        const log = new Log(ipfs, testIdentity)
        let values = await log.values()
        assert.strictEqual(values instanceof Array, true)
        assert.strictEqual(log.length, 0)
        await log.append('hello1')
        await log.append('hello2')
        await log.append('hello3')
        values = await log.values()
        assert.strictEqual(values instanceof Array, true)
        assert.strictEqual(log.length, 3)
        assert.strictEqual(values[0].payload, 'hello1')
        assert.strictEqual(values[1].payload, 'hello2')
        assert.strictEqual(values[2].payload, 'hello3')
      })
    })
  })
})
