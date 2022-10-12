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

let ipfsd, ipfs, testIdentity, testIdentity2

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Signed Log (' + IPFS + ')', function () {
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
      testIdentity2 = await IdentityProvider.createIdentity({ id: 'userB', keystore, signingKeystore })
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

    it('creates a signed log', () => {
      const logId = 'A'
      const log = new Log(ipfs, testIdentity, { logId })
      assert.notStrictEqual(log.id, null)
      assert.strictEqual(log.id, logId)
    })

    it('has the correct identity', () => {
      const log = new Log(ipfs, testIdentity, { logId: 'A' })
      assert.notStrictEqual(log.id, null)
      assert.strictEqual(log._identity.id, '03e0480538c2a39951d054e17ff31fde487cb1031d0044a037b53ad2e028a3e77c')
      assert.strictEqual(log._identity.publicKey, '048bef2231e64d5c7147bd4b8afb84abd4126ee8d8335e4b069ac0a65c7be711cea5c1b8d47bc20ebaecdca588600ddf2894675e78b2ef17cf49e7bbaf98080361')
      assert.strictEqual(log._identity.signatures.id, '3045022100f5f6f10571d14347aaf34e526ce3419fd64d75ffa7aa73692cbb6aeb6fbc147102203a3e3fa41fa8fcbb9fc7c148af5b640e2f704b20b3a4e0b93fc3a6d44dffb41e')
      assert.strictEqual(log._identity.signatures.publicKey, '3044022020982b8492be0c184dc29de0a3a3bd86a86ba997756b0bf41ddabd24b47c5acf02203745fda39d7df650a5a478e52bbe879f0cb45c074025a93471414a56077640a4')
    })

    it('has the correct public key', () => {
      const log = new Log(ipfs, testIdentity, { logId: 'A' })
      assert.strictEqual(log._identity.publicKey, testIdentity.publicKey)
    })

    it('has the correct pkSignature', () => {
      const log = new Log(ipfs, testIdentity, { logId: 'A' })
      assert.strictEqual(log._identity.signatures.id, testIdentity.signatures.id)
    })

    it('has the correct signature', () => {
      const log = new Log(ipfs, testIdentity, { logId: 'A' })
      assert.strictEqual(log._identity.signatures.publicKey, testIdentity.signatures.publicKey)
    })

    it('entries contain an identity', async () => {
      const log = new Log(ipfs, testIdentity, { logId: 'A' })
      await log.append('one')
      const values = await log.values()
      assert.notStrictEqual(values[0].sig, null)
      assert.deepStrictEqual(values[0].identity, testIdentity.toJSON())
    })

    it('doesn\'t sign entries when identity is not defined', async () => {
      let err
      try {
        const log = new Log(ipfs) // eslint-disable-line no-unused-vars
      } catch (e) {
        err = e
      }
      assert.strictEqual(err.message, 'Identity is required')
    })

    it('doesn\'t join logs with different IDs ', async () => {
      const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
      const log2 = new Log(ipfs, testIdentity2, { logId: 'B' })

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        await log2.append('three')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
        throw e
      }

      const values1 = await log1.values()
      assert.strictEqual(err, undefined)
      assert.strictEqual(log1.id, 'A')
      assert.strictEqual(values1.length, 1)
      assert.strictEqual(values1[0].payload, 'one')
    })

    it('throws an error if log is signed but trying to merge with an entry that doesn\'t have public signing key', async () => {
      const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
      const log2 = new Log(ipfs, testIdentity2, { logId: 'A' })

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        const values2 = await log2.values()
        delete values2[0].key
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }
      assert.strictEqual(err, 'Error: Entry doesn\'t have a key')
    })

    it('throws an error if log is signed but trying to merge an entry that doesn\'t have a signature', async () => {
      const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
      const log2 = new Log(ipfs, testIdentity2, { logId: 'A' })

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        const values2 = await log2.values()
        delete values2[0].sig
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }
      assert.strictEqual(err, 'Error: Entry doesn\'t have a signature')
    })

    it('throws an error if log is signed but the signature doesn\'t verify', async () => {
      const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
      const log2 = new Log(ipfs, testIdentity2, { logId: 'A' })
      let err

      try {
        await log1.append('one')
        await log2.append('two')
        const values1 = await log1.values()
        const values2 = await log2.values()
        values2[0].sig = values1[0].sig
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }

      const values1 = await log1.values()
      const values2 = await log2.values()

      const entry = values2[0]
      assert.strictEqual(err, `Error: Could not validate signature "${entry.sig}" for entry "${entry.hash}" and key "${entry.key}"`)
      assert.strictEqual(values1.length, 1)
      assert.strictEqual(values1[0].payload, 'one')
    })

    it('throws an error if entry doesn\'t have append access', async () => {
      const denyAccess = { canAppend: () => false }
      const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
      const log2 = new Log(ipfs, testIdentity2, { logId: 'A', access: denyAccess })

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }

      assert.strictEqual(err, `Error: Could not append entry, key "${testIdentity2.id}" is not allowed to write to the log`)
    })

    it('throws an error upon join if entry doesn\'t have append access', async () => {
      const testACL = {
        canAppend: (entry) => entry.identity.id !== testIdentity2.id
      }
      const log1 = new Log(ipfs, testIdentity, { logId: 'A', access: testACL })
      const log2 = new Log(ipfs, testIdentity2, { logId: 'A' })

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }

      assert.strictEqual(err, `Error: Could not append entry, key "${testIdentity2.id}" is not allowed to write to the log`)
    })
  })
})
