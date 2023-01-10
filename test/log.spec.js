import { notStrictEqual, deepStrictEqual, strictEqual } from 'assert'
import rimraf from 'rimraf'
import { CID } from 'multiformats/cid'
import { base58btc } from 'multiformats/bases/base58'
import Clock from '../src/lamport-clock.js'
import Entry from '../src/entry.js'
import Log from '../src/log.js'
import IdentityProvider from 'orbit-db-identity-provider'
import Keystore from 'orbit-db-keystore'
import { copy } from 'fs-extra'
import { read, write } from 'orbit-db-io'

// For tiebreaker testing
import LogSorting from '../src/log-sorting.js'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs } from 'orbit-db-test-utils'
const { LastWriteWins } = LogSorting
const FirstWriteWins = (a, b) => LastWriteWins(a, b) * -1

const { sync: rmrf } = rimraf
const { create } = Entry
const { createIdentity } = IdentityProvider
const { fromMultihash, fromEntryHash } = Log

let ipfsd, ipfs, testIdentity, testIdentity2, testIdentity3

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    let keystore, signingKeystore

    before(async () => {
      await copy(identityKeyFixtures, identityKeysPath)
      await copy(signingKeyFixtures, signingKeysPath)

      keystore = new Keystore(identityKeysPath)
      signingKeystore = new Keystore(signingKeysPath)

      testIdentity = await createIdentity({ id: 'userA', keystore, signingKeystore })
      testIdentity2 = await createIdentity({ id: 'userB', keystore, signingKeystore })
      testIdentity3 = await createIdentity({ id: 'userC', keystore, signingKeystore })
      ipfsd = await startIpfs(IPFS, config.defaultIpfsConfig)
      ipfs = ipfsd.api
    })

    after(async () => {
      await stopIpfs(ipfsd)
      rmrf(signingKeysPath)
      rmrf(identityKeysPath)

      await keystore.close()
      await signingKeystore.close()
    })

    describe('constructor', async () => {
      it('creates an empty log with default params', () => {
        const log = new Log(ipfs, testIdentity)
        notStrictEqual(log._entryIndex, null)
        notStrictEqual(log._headsIndex, null)
        notStrictEqual(log._id, null)
        notStrictEqual(log.id, null)
        notStrictEqual(log.clock, null)
        notStrictEqual(log.values, null)
        notStrictEqual(log.heads, null)
        notStrictEqual(log.tails, null)
        notStrictEqual(log.tailCids, null)
        deepStrictEqual(log.values, [])
        deepStrictEqual(log.heads, [])
        deepStrictEqual(log.tails, [])
      })

      it('throws an error if IPFS instance is not passed as an argument', () => {
        let err
        try {
          const log = new Log() // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        strictEqual(err.message, 'IPFS instance not defined')
      })

      it('sets an id', () => {
        const log = new Log(ipfs, testIdentity, { logId: 'ABC' })
        strictEqual(log.id, 'ABC')
      })

      it('sets the clock id', () => {
        const log = new Log(ipfs, testIdentity, { logId: 'ABC' })
        strictEqual(log.id, 'ABC')
        strictEqual(log.clock.id, testIdentity.publicKey)
      })

      it('generates id string if id is not passed as an argument', () => {
        const log = new Log(ipfs, testIdentity)
        strictEqual(typeof log.id === 'string', true)
      })

      it('sets items if given as params', async () => {
        const one = await create(ipfs, testIdentity, 'A', 'entryA', [], new Clock('A', 0))
        const two = await create(ipfs, testIdentity, 'A', 'entryB', [], new Clock('B', 0))
        const three = await create(ipfs, testIdentity, 'A', 'entryC', [], new Clock('C', 0))
        const log = new Log(ipfs, testIdentity,
          { logId: 'A', entries: [one, two, three] })
        strictEqual(log.length, 3)
        strictEqual(log.values[0].payload, 'entryA')
        strictEqual(log.values[1].payload, 'entryB')
        strictEqual(log.values[2].payload, 'entryC')
      })

      it('sets heads if given as params', async () => {
        const one = await create(ipfs, testIdentity, 'A', 'entryA', [])
        const two = await create(ipfs, testIdentity, 'A', 'entryB', [])
        const three = await create(ipfs, testIdentity, 'A', 'entryC', [])
        const log = new Log(ipfs, testIdentity,
          { logId: 'B', entries: [one, two, three], heads: [three] })
        strictEqual(log.heads.length, 1)
        strictEqual(log.heads[0].hash, three.hash)
      })

      it('finds heads if heads not given as params', async () => {
        const one = await create(ipfs, testIdentity, 'A', 'entryA', [])
        const two = await create(ipfs, testIdentity, 'A', 'entryB', [])
        const three = await create(ipfs, testIdentity, 'A', 'entryC', [])
        const log = new Log(ipfs, testIdentity,
          { logId: 'A', entries: [one, two, three] })
        strictEqual(log.heads.length, 3)
        strictEqual(log.heads[2].hash, one.hash)
        strictEqual(log.heads[1].hash, two.hash)
        strictEqual(log.heads[0].hash, three.hash)
      })

      it('throws an error if entries is not an array', () => {
        let err
        try {
          const log = new Log(ipfs, testIdentity, { logId: 'A', entries: {} }) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        notStrictEqual(err, undefined)
        strictEqual(err.message, '\'entries\' argument must be an array of Entry instances')
      })

      it('throws an error if heads is not an array', () => {
        let err
        try {
          const log = new Log(ipfs, testIdentity, { logId: 'A', entries: [], heads: {} }) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        notStrictEqual(err, undefined)
        strictEqual(err.message, '\'heads\' argument must be an array')
      })

      it('creates default public AccessController if not defined', async () => {
        const log = new Log(ipfs, testIdentity) // eslint-disable-line no-unused-vars
        const anyoneCanAppend = await log._access.canAppend('any')
        notStrictEqual(log._access, undefined)
        strictEqual(anyoneCanAppend, true)
      })

      it('throws an error if identity is not defined', () => {
        let err
        try {
          const log = new Log(ipfs) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        notStrictEqual(err, undefined)
        strictEqual(err.message, 'Identity is required')
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

      it('returns a nicely formatted string', () => {
        strictEqual(log.toString(), expectedData)
      })
    })

    describe('get', async () => {
      let log

      beforeEach(async () => {
        log = new Log(ipfs, testIdentity, { logId: 'AAA' })
        await log.append('one')
      })

      it('returns an Entry', () => {
        const entry = log.get(log.values[0].hash)
        deepStrictEqual(entry.hash, 'zdpuAoFzNYcuuQHk1gLcB8fomHGrqT9k1uQeAvewZJ1cSYrms')
      })

      it('returns undefined when Entry is not in the log', () => {
        const entry = log.get('QmFoo')
        deepStrictEqual(entry, undefined)
      })
    })

    describe('setIdentity', () => {
      let log

      beforeEach(async () => {
        log = new Log(ipfs, testIdentity, { logId: 'AAA' })
        await log.append('one')
      })

      it('changes identity', async () => {
        strictEqual(log.values[0].clock.id, testIdentity.publicKey)
        strictEqual(log.values[0].clock.time, 1)
        log.setIdentity(testIdentity2)
        await log.append('two')
        strictEqual(log.values[1].clock.id, testIdentity2.publicKey)
        strictEqual(log.values[1].clock.time, 2)
        log.setIdentity(testIdentity3)
        await log.append('three')
        strictEqual(log.values[2].clock.id, testIdentity3.publicKey)
        strictEqual(log.values[2].clock.time, 3)
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
        strictEqual(log.has(expectedData), true)
      })

      it('returns true if it has an Entry, hash lookup', () => {
        strictEqual(log.has(expectedData.hash), true)
      })

      it('returns false if it doesn\'t have the Entry', () => {
        strictEqual(log.has('zdFoo'), false)
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
          strictEqual(JSON.stringify(log.toJSON()), JSON.stringify(expectedData))
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

        it('returns the log snapshot', () => {
          const snapshot = log.toSnapshot()
          strictEqual(snapshot.id, expectedData.id)
          strictEqual(snapshot.heads.length, expectedData.heads.length)
          strictEqual(snapshot.heads[0].hash, expectedData.heads[0])
          strictEqual(snapshot.values.length, expectedData.values.length)
          strictEqual(snapshot.values[0].hash, expectedData.values[0])
          strictEqual(snapshot.values[1].hash, expectedData.values[1])
          strictEqual(snapshot.values[2].hash, expectedData.values[2])
        })
      })

      describe('toBuffer', () => {
        it('returns the log as a Buffer', () => {
          deepStrictEqual(log.toBuffer(), Buffer.from(JSON.stringify(expectedData)))
        })
      })

      describe('toMultihash - cbor', async () => {
        it('returns the log as ipfs CID', async () => {
          const expectedCid = 'zdpuAwC43AQmYEPAnmidtfuUdBQSWuK95z1446UntBMhrqdto'
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const hash = await log.toMultihash()
          strictEqual(hash, expectedCid)
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
          strictEqual(hash, expectedCid)
          const result = await read(ipfs, hash)
          const heads = result.heads.map(head => head.toString(base58btc))
          deepStrictEqual(heads, expectedData.heads)
        })

        it('throws an error if log items is empty', async () => {
          const emptyLog = new Log(ipfs, testIdentity)
          let err
          try {
            await emptyLog.toMultihash()
          } catch (e) {
            err = e
          }
          notStrictEqual(err, null)
          strictEqual(err.message, 'Can\'t serialize an empty log')
        })
      })

      describe('toMultihash - pb', async () => {
        it('returns the log as ipfs multihash', async () => {
          const expectedMultihash = 'QmSgYrc2cbLghngrBWJtNvmh282BrUgtGxzjYhEuPgC7Sj'
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const multihash = await log.toMultihash({ format: 'dag-pb' })
          strictEqual(multihash, expectedMultihash)
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
          strictEqual(multihash, expectedMultihash)
          const result = await ipfs.object.get(CID.parse(multihash))
          const res = JSON.parse(Buffer.from(result.Data).toString())
          deepStrictEqual(res.heads, expectedData.heads)
        })

        it('throws an error if log items is empty', async () => {
          const emptyLog = new Log(ipfs, testIdentity)
          let err
          try {
            await emptyLog.toMultihash()
          } catch (e) {
            err = e
          }
          notStrictEqual(err, null)
          strictEqual(err.message, 'Can\'t serialize an empty log')
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
          const res = await fromMultihash(ipfs, testIdentity, hash, -1)
          strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          strictEqual(res.length, 1)
          strictEqual(res.values[0].payload, 'one')
          strictEqual(res.values[0].clock.id, testIdentity.publicKey)
          strictEqual(res.values[0].clock.time, 1)
        })

        it('creates a log from ipfs CID - three entries', async () => {
          const hash = await log.toMultihash()
          const res = await fromMultihash(ipfs, testIdentity, hash, -1)
          strictEqual(res.length, 3)
          strictEqual(res.values[0].payload, 'one')
          strictEqual(res.values[0].clock.time, 1)
          strictEqual(res.values[1].payload, 'two')
          strictEqual(res.values[1].clock.time, 2)
          strictEqual(res.values[2].payload, 'three')
          strictEqual(res.values[2].clock.time, 3)
        })

        it('creates a log from ipfs multihash (backwards compat)', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB23XC5xJBJbfk5d9EfpWjX56VqTu3z4CUzVf2mxVURnEy']
          }
          const log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const multihash = await log.toMultihash()
          const res = await fromMultihash(ipfs, testIdentity, multihash, { length: -1 })
          strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          strictEqual(res.length, 1)
          strictEqual(res.values[0].payload, 'one')
          strictEqual(res.values[0].clock.id, testIdentity.publicKey)
          strictEqual(res.values[0].clock.time, 1)
        })

        it('has the right sequence number after creation and appending', async () => {
          const hash = await log.toMultihash()
          const res = await fromMultihash(ipfs, testIdentity, hash, { length: -1 })
          strictEqual(res.length, 3)
          await res.append('four')
          strictEqual(res.length, 4)
          strictEqual(res.values[3].payload, 'four')
          strictEqual(res.values[3].clock.time, 4)
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
          const res = await fromMultihash(ipfs, testIdentity, hash, { length: -1 })
          strictEqual(res.length, 3)
          strictEqual(res.heads.length, 3)
          strictEqual(res.heads[2].payload, 'three')
          strictEqual(res.heads[1].payload, 'two') // order is determined by the identity's publicKey
          strictEqual(res.heads[0].payload, 'one')
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
          const res = await fromMultihash(ipfs, testIdentity, hash,
            { sortFn: FirstWriteWins })
          strictEqual(res.length, 3)
          strictEqual(res.heads.length, 3)
          strictEqual(res.heads[2].payload, 'one')
          strictEqual(res.heads[1].payload, 'two') // order is determined by the identity's publicKey
          strictEqual(res.heads[0].payload, 'three')
        })

        it('creates a log from ipfs CID up to a size limit', async () => {
          const amount = 100
          const size = amount / 2
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }
          const hash = await log.toMultihash()
          const res = await fromMultihash(ipfs, testIdentity, hash, { length: size })
          strictEqual(res.length, size)
        })

        it('creates a log from ipfs CID up without size limit', async () => {
          const amount = 100
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }
          const hash = await log.toMultihash()
          const res = await fromMultihash(ipfs, testIdentity, hash, { length: -1 })
          strictEqual(res.length, amount)
        })

        it('throws an error if ipfs is not defined', async () => {
          let err
          try {
            await fromMultihash()
          } catch (e) {
            err = e
          }
          notStrictEqual(err, null)
          strictEqual(err.message, 'IPFS instance not defined')
        })

        it('throws an error if hash is not defined', async () => {
          let err
          try {
            await fromMultihash(ipfs)
          } catch (e) {
            err = e
          }
          notStrictEqual(err, null)
          strictEqual(err.message, 'Invalid hash: undefined')
        })

        it('throws an error if data from hash is not valid JSON', async () => {
          const value = 'hello'
          const cid = CID.parse(await write(ipfs, 'dag-pb', value))
          let err
          try {
            const hash = cid.toString(base58btc)
            await fromMultihash(ipfs, testIdentity, hash)
          } catch (e) {
            err = e
          }
          strictEqual(err.message, 'Unexpected token h in JSON at position 0')
        })

        it('throws an error when data from CID is not instance of Log', async () => {
          const hash = await write(ipfs, 'dag-cbor', {})
          let err
          try {
            await fromMultihash(ipfs, testIdentity, hash)
          } catch (e) {
            err = e
          }
          strictEqual(err.message, 'Given argument is not an instance of Log')
        })

        it('onProgress callback is fired for each entry', async () => {
          const amount = 100
          const log = new Log(ipfs, testIdentity, { logId: 'A' })
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }

          const items = log.values
          let i = 0
          const loadProgressCallback = (entry) => {
            notStrictEqual(entry, null)
            strictEqual(entry.hash, items[items.length - i - 1].hash)
            strictEqual(entry.payload, items[items.length - i - 1].payload)
            i++
          }

          const hash = await log.toMultihash()
          const result = await fromMultihash(ipfs, testIdentity, hash,
            { length: -1, exclude: [], onProgressCallback: loadProgressCallback })

          // Make sure the onProgress callback was called for each entry
          strictEqual(i, amount)
          // Make sure the log entries are correct ones
          strictEqual(result.values[0].clock.time, 1)
          strictEqual(result.values[0].payload, '0')
          strictEqual(result.values[result.length - 1].clock.time, 100)
          strictEqual(result.values[result.length - 1].payload, '99')
        })
      })

      describe('fromEntryHash', async () => {
        afterEach(() => {
          if (fromEntryHash.restore) {
            fromEntryHash.restore()
          }
        })

        it('calls fromEntryHash', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB23XC5xJBJbfk5d9EfpWjX56VqTu3z4CUzVf2mxVURnEy']
          }
          const log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const res = await fromEntryHash(ipfs, testIdentity, expectedData.heads[0],
            { logId: log.id, length: -1 })
          strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        })
      })

      describe('fromMultihash', async () => {
        afterEach(() => {
          if (fromMultihash.restore) {
            fromMultihash.restore()
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
          const res = await fromMultihash(ipfs, testIdentity, multihash, { length: -1 })
          strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        })

        it('calls fromMultihash with custom tiebreaker', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB23XC5xJBJbfk5d9EfpWjX56VqTu3z4CUzVf2mxVURnEy']
          }
          const log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const multihash = await log.toMultihash()
          const res = await fromMultihash(ipfs, testIdentity, multihash,
            { length: -1, sortFn: FirstWriteWins })
          strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        })
      })
    })

    describe('values', () => {
      it('returns all entries in the log', async () => {
        const log = new Log(ipfs, testIdentity)
        strictEqual(log.values instanceof Array, true)
        strictEqual(log.length, 0)
        await log.append('hello1')
        await log.append('hello2')
        await log.append('hello3')
        strictEqual(log.values instanceof Array, true)
        strictEqual(log.length, 3)
        strictEqual(log.values[0].payload, 'hello1')
        strictEqual(log.values[1].payload, 'hello2')
        strictEqual(log.values[2].payload, 'hello3')
      })
    })
  })
})
