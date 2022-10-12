'use strict'
const assert = require('assert')
const rmrf = require('rimraf')
const fs = require('fs-extra')
const Log = require('../src/log')
const { SortByEntryHash } = Log.Sorting
const IdentityProvider = require('orbit-db-identity-provider')

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('orbit-db-test-utils')

let ipfsd, ipfs, testIdentity

Object.keys(testAPIs).forEach(IPFS => {
  describe('Log - Join Concurrent Entries (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    before(async () => {
      rmrf.sync(identityKeysPath)
      rmrf.sync(signingKeysPath)
      await fs.copy(identityKeyFixtures, identityKeysPath)
      await fs.copy(signingKeyFixtures, signingKeysPath)
      testIdentity = await IdentityProvider.createIdentity({ id: 'userA', identityKeysPath, signingKeysPath })
      ipfsd = await startIpfs(IPFS, config.defaultIpfsConfig)
      ipfs = ipfsd.api
    })

    after(async () => {
      await stopIpfs(ipfsd)
      await testIdentity.provider.keystore.close()
      await testIdentity.provider.signingKeystore.close()
      rmrf.sync(identityKeysPath)
      rmrf.sync(signingKeysPath)
    })

    describe('join ', async () => {
      let log1, log2

      before(async () => {
        log1 = new Log(ipfs, testIdentity, { logId: 'A', sortFn: SortByEntryHash })
        log2 = new Log(ipfs, testIdentity, { logId: 'A', sortFn: SortByEntryHash })
      })

      it('joins consistently', async () => {
        for (let i = 0; i < 10; i++) {
          await log1.append('hello1-' + i)
          await log2.append('hello2-' + i)
        }

        await log1.join(log2)
        await log2.join(log1)

        const hash1 = await log1.toMultihash()
        const hash2 = await log2.toMultihash()

        const values1 = await log1.values()
        const values2 = await log2.values()

        assert.strictEqual(hash1, hash2)
        assert.strictEqual(log1.length, 20)
        assert.deepStrictEqual(values1.map(e => e.payload), values2.map(e => e.payload))
      })

      it('Concurrently appending same payload after join results in same state', async () => {
        for (let i = 10; i < 20; i++) {
          await log1.append('hello1-' + i)
          await log2.append('hello2-' + i)
        }

        await log1.join(log2)
        await log2.join(log1)

        await log1.append('same')
        await log2.append('same')

        const hash1 = await log1.toMultihash()
        const hash2 = await log2.toMultihash()

        const values1 = await log1.values()
        const values2 = await log2.values()

        assert.strictEqual(hash1, hash2)
        assert.strictEqual(log1.length, 41)
        assert.strictEqual(log2.length, 41)
        assert.deepStrictEqual(values1.map(e => e.payload), values2.map(e => e.payload))
      })

      it('Joining after concurrently appending same payload joins entry once', async () => {
        await log1.join(log2)
        await log2.join(log1)

        const values1 = await log1.values()
        const values2 = await log2.values()

        assert.strictEqual(log1.length, log2.length)
        assert.strictEqual(log1.length, 41)
        assert.deepStrictEqual(values1.map(e => e.payload), values2.map(e => e.payload))
      })
    })
  })
})
