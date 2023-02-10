import { deepStrictEqual, strictEqual } from 'assert'
import rimraf from 'rimraf'
import * as Log from '../src/log.js'
import IdentityProvider from 'orbit-db-identity-provider'
import Keystore from '../src/Keystore.js'

import Documents from '../src/documents.js'
import Database from '../src/database.js'

// Test utils
import { config, testAPIs, getIpfsPeerId, waitForPeers, startIpfs, stopIpfs } from 'orbit-db-test-utils'
import connectPeers from './utils/connect-nodes.js'
import waitFor from './utils/wait-for.js'
import { identityKeys, signingKeys } from './fixtures/orbit-db-identity-keys.js'

const { sync: rmrf } = rimraf
const { createIdentity } = IdentityProvider

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Documents Database (' + IPFS + ')', function () {
    this.timeout(config.timeout * 2)

    let ipfsd1, ipfsd2
    let ipfs1, ipfs2
    let keystore, signingKeystore
    let peerId1, peerId2
    let testIdentity1, testIdentity2
    let db1, db2

    const databaseId = 'documents-AAA'

    before(async () => {
      rmrf('./keys_1')
      rmrf('./keys_2')

      // Start two IPFS instances
      ipfsd1 = await startIpfs(IPFS, config.daemon1)
      ipfsd2 = await startIpfs(IPFS, config.daemon2)
      ipfs1 = ipfsd1.api
      ipfs2 = ipfsd2.api

      await connectPeers(ipfs1, ipfs2)

      // Get the peer IDs
      peerId1 = await getIpfsPeerId(ipfs1)
      peerId2 = await getIpfsPeerId(ipfs2)

      keystore = new Keystore('./keys_1')
      await keystore.open()
      for (const [key, value] of Object.entries(identityKeys)) {
        await keystore.addKey(key, value)
      }

      signingKeystore = new Keystore('./keys_2')
      await signingKeystore.open()
      for (const [key, value] of Object.entries(signingKeys)) {
        await signingKeystore.addKey(key, value)
      }

      // Create an identity for each peers
      testIdentity1 = await createIdentity({ id: 'userA', keystore, signingKeystore })
      testIdentity2 = await createIdentity({ id: 'userB', keystore, signingKeystore })
    })

    after(async () => {
      if (ipfsd1) {
        await stopIpfs(ipfsd1)
      }
      if (ipfsd2) {
        await stopIpfs(ipfsd2)
      }
      if (keystore) {
        await keystore.close()
      }
      if (signingKeystore) {
        await signingKeystore.close()
      }
      if (testIdentity1) {
        rmrf(testIdentity1.id)
      }
      if (testIdentity2) {
        rmrf(testIdentity2.id)
      }
      rmrf('./orbitdb')
      rmrf('./keys_1')
      rmrf('./keys_2')
    })

    afterEach(async () => {
      if (db1) {
        await db1.close()
      }
      if (db2) {
        await db2.close()
      }
    })

    describe('using database', () => {
      beforeEach(async () => {
        const accessController = {
          canAppend: (entry) => entry.identity.id === testIdentity1.id
        }

        db1 = await Documents({ OpLog: Log, Database, ipfs: ipfs1, identity: testIdentity1, databaseId, accessController })
      })

      afterEach(async () => {
        if (db1) {
          await db1.drop()
        }
      })

      it('gets a document', async () => {
        const key = 'hello world 1'

        const expected = { _id: key, msg: 'writing 1 to db1' }

        await db1.put(expected)

        const doc = await db1.get(key)
        deepStrictEqual(doc, expected)
      })

      it('deletes a document', async () => {
        const key = 'hello world 1'

        await db1.put({ _id: key, msg: 'writing 1 to db1' })
        await db1.del(key)

        const doc = await db1.get(key)
        strictEqual(doc, undefined)
      })

      it('throws an error when deleting a non-existent document', async () => {
        const key = 'i do not exist'
        let err

        try {
          await db1.del(key)
        } catch (e) {
          err = e
        }

        strictEqual(err.message, `No document with key '${key}' in the database`)
      })

      it('queries for a document', async () => {
        const expected = { _id: 'hello world 1', msg: 'writing new 1 to db1', views: 10 }

        await db1.put({ _id: 'hello world 1', msg: 'writing 1 to db1', views: 10 })
        await db1.put({ _id: 'hello world 2', msg: 'writing 2 to db1', views: 5 })
        await db1.put({ _id: 'hello world 3', msg: 'writing 3 to db1', views: 12 })
        await db1.del('hello world 3')
        await db1.put(expected)

        const findFn = (doc) => doc.views > 5

        deepStrictEqual(await db1.query(findFn), [expected])
      })
    })

    describe('replicate database', () => {
      it('returns all entries in the database', async () => {
        let updateCount = 0

        const accessController = {
          canAppend: (entry) => entry.identity.id === testIdentity1.id
        }

        const onUpdate = (entry) => {
          ++updateCount
        }

        const onError = () => {
        }

        db1 = await Documents({ OpLog: Log, Database, ipfs: ipfs1, identity: testIdentity1, databaseId, accessController })
        db2 = await Documents({ OpLog: Log, Database, ipfs: ipfs2, identity: testIdentity2, databaseId, accessController })

        db2.events.on('update', onUpdate)
        db2.events.on('error', onError)

        strictEqual(db1.type, 'documents')
        strictEqual(db2.type, 'documents')

        await waitForPeers(ipfs1, [peerId2], databaseId)
        await waitForPeers(ipfs2, [peerId1], databaseId)

        await db1.put({ _id: "init", value: true })
        await db1.put({ _id: "init", value: false })
        await db1.put({ _id: "hello", text: "friend" })
        await db1.del("hello")
        await db1.put({ _id: "hello", text: "friend2" })
        await db1.put({ _id: "empty" })
        await db1.del("empty")
        await db1.put({ _id: "hello", text: "friend3" })

        await waitFor(() => updateCount, () => 8)

        strictEqual(updateCount, 8)

        const documents2 = []
        console.time('documents2')
        for await (const event of db2.iterator()) {
          documents2.unshift(event)
        }
        console.timeEnd('documents2')
        deepStrictEqual(documents2, [
          { _id: "init", value: false },
          { _id: "hello", text: "friend3" }
        ])

        const documents1 = []
        console.time('documents1')
        for await (const event of db1.iterator()) {
          documents1.unshift(event)
        }
        console.timeEnd('documents1')
        deepStrictEqual(documents1, [
          { _id: "init", value: false },
          { _id: "hello", text: "friend3" }
        ])
      })
    })

    describe('load database', () => {
      it('returns all entries in the database', async () => {
        let updateCount = 0

        const accessController = {
          canAppend: (entry) => entry.identity.id === testIdentity1.id
        }

        const onUpdate = (entry) => {
          ++updateCount
        }

        const onError = () => {
        }

        db1 = await Documents({ OpLog: Log, Database, ipfs: ipfs1, identity: testIdentity1, databaseId, accessController })
        db2 = await Documents({ OpLog: Log, Database, ipfs: ipfs2, identity: testIdentity2, databaseId, accessController })

        db2.events.on('update', onUpdate)
        db2.events.on('error', onError)

        strictEqual(db1.type, 'documents')
        strictEqual(db2.type, 'documents')

        await waitForPeers(ipfs1, [peerId2], databaseId)
        await waitForPeers(ipfs2, [peerId1], databaseId)

        await db1.put({ _id: "init", value: true })
        await db1.put({ _id: "init", value: false })
        await db1.put({ _id: "hello", text: "friend" })
        await db1.del("hello")
        await db1.put({ _id: "hello", text: "friend2" })
        await db1.put({ _id: "empty" })
        await db1.del("empty")
        await db1.put({ _id: "hello", text: "friend3" })

        await waitFor(() => updateCount, () => 8)

        strictEqual(updateCount, 8)

        await db1.close()
        await db2.close()

        db1 = await Documents({ OpLog: Log, Database, ipfs: ipfs1, identity: testIdentity1, databaseId, accessController })
        db2 = await Documents({ OpLog: Log, Database, ipfs: ipfs2, identity: testIdentity2, databaseId, accessController })

        const documents2 = []
        console.time('documents2')
        for await (const event of db2.iterator()) {
          documents2.unshift(event)
        }
        console.timeEnd('documents2')
        deepStrictEqual(documents2, [
          { _id: "init", value: false },
          { _id: "hello", text: "friend3" }
        ])

        const documents1 = []
        console.time('documents1')
        for await (const event of db1.iterator()) {
          documents1.unshift(event)
        }
        console.timeEnd('documents1')
        deepStrictEqual(documents1, [
          { _id: "init", value: false },
          { _id: "hello", text: "friend3" }
        ])
      })
    })
  })
})
