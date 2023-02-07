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
    let accessController

    const databaseId = 'documents-AAA'

    before(async () => {
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

      const accessController = {
        canAppend: (entry) => entry.identity.id === testIdentity1.id
      }
    })

    beforeEach(async () => {
      db1 = await Documents({ OpLog: Log, Database, ipfs: ipfs1, identity: testIdentity1, databaseId, accessController })
    })

    afterEach(async () => {
      if (db1) {
        await db1.drop()
        await db1.close()
      }
      if (db2) {
        await db2.drop()
        await db2.close()
      }
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

    describe('using database', () => {
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
        
        strictEqual(err.message, `No document with key \'${key}\' in the database`)
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
  })
})