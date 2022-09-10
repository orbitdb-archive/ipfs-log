'use strict'

import { strictEqual, deepStrictEqual } from 'assert'
import { sync } from 'rimraf'
import { copy } from 'fs-extra'
import { create, toMultihash, toEntry, fromMultihash, IPLD_LINKS, isParent, isEqual, isEntry } from '../src/entry'
import { AccessController as _AccessController } from '../src/log'
import { io } from '../src/utils'
const AccessController = _AccessController
import { createIdentity } from 'orbit-db-identity-provider'
import { hello, helloWorld, helloAgain } from './fixtures/v0-entries.fixture'
import v1Entries from './fixtures/v1-entries.fixture'
import Keystore from 'orbit-db-keystore'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs } from 'orbit-db-test-utils'

let ipfsd, ipfs, testIdentity

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Entry (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const testACL = new AccessController()
    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    let keystore, signingKeystore

    before(async () => {
      await copy(identityKeyFixtures, identityKeysPath)
      await copy(signingKeyFixtures, signingKeysPath)

      keystore = new Keystore(identityKeysPath)
      signingKeystore = new Keystore(signingKeysPath)

      testIdentity = await createIdentity({ id: 'userA', keystore, signingKeystore })
      ipfsd = await startIpfs(IPFS, config.defaultIpfsConfig)
      ipfs = ipfsd.api
    })

    after(async () => {
      await stopIpfs(ipfsd)
      await copy(identityKeyFixtures, identityKeysPath)
      await copy(signingKeyFixtures, signingKeysPath)
      sync(identityKeysPath)
      sync(signingKeysPath)
      await keystore.close()
      await signingKeystore.close()
    })

    describe('create', () => {
      it('creates a an empty entry', async () => {
        const expectedHash = 'zdpuAsPdzSyeux5mFsFV1y3WeHAShGNi4xo22cYBYWUdPtxVB'
        const entry = await create(ipfs, testIdentity, 'A', 'hello')
        strictEqual(entry.hash, expectedHash)
        strictEqual(entry.id, 'A')
        strictEqual(entry.clock.id, testIdentity.publicKey)
        strictEqual(entry.clock.time, 0)
        strictEqual(entry.v, 2)
        strictEqual(entry.payload, 'hello')
        strictEqual(entry.next.length, 0)
        strictEqual(entry.refs.length, 0)
      })

      it('creates a entry with payload', async () => {
        const expectedHash = 'zdpuAyvJU3TS7LUdfRxwAnJorkz6NfpAWHGypsQEXLZxcCCRC'
        const payload = 'hello world'
        const entry = await create(ipfs, testIdentity, 'A', payload, [])
        strictEqual(entry.payload, payload)
        strictEqual(entry.id, 'A')
        strictEqual(entry.clock.id, testIdentity.publicKey)
        strictEqual(entry.clock.time, 0)
        strictEqual(entry.v, 2)
        strictEqual(entry.next.length, 0)
        strictEqual(entry.refs.length, 0)
        strictEqual(entry.hash, expectedHash)
      })

      it('creates a entry with payload and next', async () => {
        const expectedHash = 'zdpuAqsN9Py4EWSfrGYZS8tuokWuiTd9zhS8dhr9XpSGQajP2'
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await create(ipfs, testIdentity, 'A', payload1, [])
        entry1.clock.tick()
        const entry2 = await create(ipfs, testIdentity, 'A', payload2, [entry1], entry1.clock)
        strictEqual(entry2.payload, payload2)
        strictEqual(entry2.next.length, 1)
        strictEqual(entry2.hash, expectedHash)
        strictEqual(entry2.clock.id, testIdentity.publicKey)
        strictEqual(entry2.clock.time, 1)
      })

      it('`next` parameter can be an array of strings', async () => {
        const entry1 = await create(ipfs, testIdentity, 'A', 'hello1', [])
        const entry2 = await create(ipfs, testIdentity, 'A', 'hello2', [entry1.hash])
        strictEqual(typeof entry2.next[0] === 'string', true)
      })

      it('`next` parameter can be an array of Entry instances', async () => {
        const entry1 = await create(ipfs, testIdentity, 'A', 'hello1', [])
        const entry2 = await create(ipfs, testIdentity, 'A', 'hello2', [entry1])
        strictEqual(typeof entry2.next[0] === 'string', true)
      })

      it('`next` parameter can contain nulls and undefined objects', async () => {
        const entry1 = await create(ipfs, testIdentity, 'A', 'hello1', [])
        const entry2 = await create(ipfs, testIdentity, 'A', 'hello2', [entry1, null, undefined])
        strictEqual(typeof entry2.next[0] === 'string', true)
      })

      it('throws an error if ipfs is not defined', async () => {
        let err
        try {
          await create()
        } catch (e) {
          err = e
        }
        strictEqual(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if identity are not defined', async () => {
        let err
        try {
          await create(ipfs, null, 'A', 'hello2', [])
        } catch (e) {
          err = e
        }
        strictEqual(err.message, 'Identity is required, cannot create entry')
      })

      it('throws an error if id is not defined', async () => {
        let err
        try {
          await create(ipfs, testIdentity, null, 'hello', [])
        } catch (e) {
          err = e
        }
        strictEqual(err.message, 'Entry requires an id')
      })

      it('throws an error if data is not defined', async () => {
        let err
        try {
          await create(ipfs, testIdentity, 'A', null, [])
        } catch (e) {
          err = e
        }
        strictEqual(err.message, 'Entry requires data')
      })

      it('throws an error if next is not an array', async () => {
        let err
        try {
          await create(ipfs, testIdentity, 'A', 'hello', {})
        } catch (e) {
          err = e
        }
        strictEqual(err.message, '\'next\' argument is not an array')
      })
    })

    describe('toMultihash', () => {
      it('returns an ipfs multihash', async () => {
        const expectedMultihash = 'zdpuAsPdzSyeux5mFsFV1y3WeHAShGNi4xo22cYBYWUdPtxVB'
        const entry = await create(ipfs, testIdentity, 'A', 'hello', [])
        const multihash = await toMultihash(ipfs, entry)
        strictEqual(multihash, expectedMultihash)
      })

      it('returns the correct ipfs multihash for a v0 entry', async () => {
        const expectedMultihash = 'Qmc2DEiLirMH73kHpuFPbt3V65sBrnDWkJYSjUQHXXvghT'
        const entry = hello
        const multihash = await toMultihash(ipfs, entry)
        strictEqual(multihash, expectedMultihash)
      })

      it('returns the correct ipfs multihash for a v1 entry', async () => {
        const entry = v1Entries[0]
        const expectedMultihash = 'zdpuAsJDrLKrAiU8M518eu6mgv9HzS3e1pfH5XC7LUsFgsK5c'
        const e = toEntry(entry)
        const multihash = await toMultihash(ipfs, e)
        strictEqual(expectedMultihash, entry.hash)
        strictEqual(multihash, expectedMultihash)
      })

      it('throws an error if ipfs is not defined', async () => {
        let err
        try {
          await toMultihash()
        } catch (e) {
          err = e
        }
        strictEqual(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if the object being passed is invalid', async () => {
        let err1, err2
        try {
          await toMultihash(ipfs, testACL, testIdentity, { hash: 'deadbeef' })
        } catch (e) {
          err1 = e
        }

        strictEqual(err1.message, 'Invalid object format, cannot generate entry hash')

        try {
          const entry = await create(ipfs, testIdentity, 'A', 'hello', [])
          delete entry.clock
          await toMultihash(ipfs, entry)
        } catch (e) {
          err2 = e
        }
        strictEqual(err2.message, 'Invalid object format, cannot generate entry hash')
      })
    })

    describe('fromMultihash', () => {
      it('creates a entry from ipfs hash', async () => {
        const expectedHash = 'zdpuAnRGWKPkMHqumqdkRJtzbyW6qAGEiBRv61Zj3Ts4j9tQF'
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await create(ipfs, testIdentity, 'A', payload2, [entry1])
        const final = await fromMultihash(ipfs, entry2.hash)

        deepStrictEqual(entry2, final)
        strictEqual(final.id, 'A')
        strictEqual(final.payload, payload2)
        strictEqual(final.next.length, 1)
        strictEqual(final.next[0], entry1.hash)
        strictEqual(final.hash, expectedHash)
      })

      it('creates a entry from ipfs multihash of v0 entries', async () => {
        const expectedHash = 'QmZ8va2fSjRufV1sD6x5mwi6E5GrSjXHx7RiKFVBzkiUNZ'
        const entry1Hash = await io.write(ipfs, 'dag-pb', toEntry(helloWorld))
        const entry2Hash = await io.write(ipfs, 'dag-pb', toEntry(helloAgain))
        const final = await fromMultihash(ipfs, entry2Hash)

        strictEqual(final.id, 'A')
        strictEqual(final.payload, helloAgain.payload)
        strictEqual(final.next.length, 1)
        strictEqual(final.next[0], helloAgain.next[0])
        strictEqual(final.next[0], entry1Hash)
        strictEqual(final.v, 0)
        strictEqual(final.hash, entry2Hash)
        strictEqual(final.hash, expectedHash)
      })

      it('creates a entry from ipfs multihash of v1 entries', async () => {
        const expectedHash = 'zdpuAxgKyiM9qkP9yPKCCqrHer9kCqYyr7KbhucsPwwfh6JB3'
        const e1 = v1Entries[0]
        const e2 = v1Entries[1]
        const entry1Hash = await io.write(ipfs, 'dag-cbor', toEntry(e1), { links: IPLD_LINKS })
        const entry2Hash = await io.write(ipfs, 'dag-cbor', toEntry(e2), { links: IPLD_LINKS })
        const final = await fromMultihash(ipfs, entry2Hash)
        strictEqual(final.id, 'A')
        strictEqual(final.payload, e2.payload)
        strictEqual(final.next.length, 1)
        strictEqual(final.next[0], e2.next[0])
        strictEqual(final.next[0], entry1Hash)
        strictEqual(final.v, 1)
        strictEqual(final.hash, entry2Hash)
        strictEqual(entry2Hash, expectedHash)
      })

      it('should return an entry interopable with older and newer versions', async () => {
        const expectedHashV1 = 'zdpuAsPdzSyeux5mFsFV1y3WeHAShGNi4xo22cYBYWUdPtxVB'
        const entryV1 = await create(ipfs, testIdentity, 'A', 'hello', [])
        const finalV1 = await fromMultihash(ipfs, entryV1.hash)
        strictEqual(finalV1.hash, expectedHashV1)
        strictEqual(Object.assign({}, finalV1).hash, expectedHashV1)

        const expectedHashV0 = 'QmenUDpFksTa3Q9KmUJYjebqvHJcTF2sGQaCH7orY7bXKC'
        const entryHashV0 = await io.write(ipfs, 'dag-pb', helloWorld)
        const finalV0 = await fromMultihash(ipfs, entryHashV0)
        strictEqual(finalV0.hash, expectedHashV0)
        strictEqual(Object.assign({}, finalV0).hash, expectedHashV0)
      })

      it('throws an error if ipfs is not present', async () => {
        let err
        try {
          await fromMultihash()
        } catch (e) {
          err = e
        }
        strictEqual(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if hash is undefined', async () => {
        let err
        try {
          await fromMultihash(ipfs)
        } catch (e) {
          err = e
        }
        strictEqual(err.message, 'Invalid hash: undefined')
      })
    })

    describe('isParent', () => {
      it('returns true if entry has a child', async () => {
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await create(ipfs, testIdentity, 'A', payload2, [entry1])
        strictEqual(isParent(entry1, entry2), true)
      })

      it('returns false if entry does not have a child', async () => {
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await create(ipfs, testIdentity, 'A', payload2, [])
        const entry3 = await create(ipfs, testIdentity, 'A', payload2, [entry2])
        strictEqual(isParent(entry1, entry2), false)
        strictEqual(isParent(entry1, entry3), false)
        strictEqual(isParent(entry2, entry3), true)
      })
    })

    describe('compare', () => {
      it('returns true if entries are the same', async () => {
        const payload1 = 'hello world'
        const entry1 = await create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await create(ipfs, testIdentity, 'A', payload1, [])
        strictEqual(isEqual(entry1, entry2), true)
      })

      it('returns true if entries are not the same', async () => {
        const payload1 = 'hello world1'
        const payload2 = 'hello world2'
        const entry1 = await create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await create(ipfs, testIdentity, 'A', payload2, [])
        strictEqual(isEqual(entry1, entry2), false)
      })
    })

    describe('isEntry', () => {
      it('is an Entry', async () => {
        const entry = await create(ipfs, testIdentity, 'A', 'hello', [])
        strictEqual(isEntry(entry), true)
      })

      it('is an Entry (v0)', async () => {
        strictEqual(isEntry(hello), true)
      })

      it('is not an Entry - no id', async () => {
        const fakeEntry = { next: [], v: 1, hash: 'Foo', payload: 123, seq: 0 }
        strictEqual(isEntry(fakeEntry), false)
      })

      it('is not an Entry - no seq', async () => {
        const fakeEntry = { next: [], v: 1, hash: 'Foo', payload: 123 }
        strictEqual(isEntry(fakeEntry), false)
      })

      it('is not an Entry - no next', async () => {
        const fakeEntry = { id: 'A', v: 1, hash: 'Foo', payload: 123, seq: 0 }
        strictEqual(isEntry(fakeEntry), false)
      })

      it('is not an Entry - no version', async () => {
        const fakeEntry = { id: 'A', next: [], payload: 123, seq: 0 }
        strictEqual(isEntry(fakeEntry), false)
      })

      it('is not an Entry - no hash', async () => {
        const fakeEntry = { id: 'A', v: 1, next: [], payload: 123, seq: 0 }
        strictEqual(isEntry(fakeEntry), false)
      })

      it('is not an Entry - no payload', async () => {
        const fakeEntry = { id: 'A', v: 1, next: [], hash: 'Foo', seq: 0 }
        strictEqual(isEntry(fakeEntry), false)
      })
    })
  })
})
