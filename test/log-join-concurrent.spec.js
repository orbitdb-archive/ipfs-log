import { strictEqual, deepStrictEqual } from 'assert'
import rimraf from 'rimraf'
import { copy } from 'fs-extra'
import Log, { Sorting } from '../src/log.js'
import IdentityProvider from 'orbit-db-identity-provider'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs } from 'orbit-db-test-utils'

const { sync: rmrf } = rimraf
const { SortByEntryHash } = Sorting
const { createIdentity } = IdentityProvider

let ipfsd, ipfs, testIdentity

Object.keys(testAPIs).forEach(IPFS => {
  describe('Log - Join Concurrent Entries (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    before(async () => {
      rmrf(identityKeysPath)
      rmrf(signingKeysPath)
      await copy(identityKeyFixtures, identityKeysPath)
      await copy(signingKeyFixtures, signingKeysPath)
      testIdentity = await createIdentity({ id: 'userA', identityKeysPath, signingKeysPath })
      ipfsd = await startIpfs(IPFS, config.defaultIpfsConfig)
      ipfs = ipfsd.api
    })

    after(async () => {
      await stopIpfs(ipfsd)
      await testIdentity.provider.keystore.close()
      await testIdentity.provider.signingKeystore.close()
      rmrf(identityKeysPath)
      rmrf(signingKeysPath)
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

        strictEqual(hash1, hash2)
        strictEqual(log1.length, 20)
        deepStrictEqual(log1.values.map(e => e.payload), log2.values.map(e => e.payload))
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

        strictEqual(hash1, hash2)
        strictEqual(log1.length, 41)
        strictEqual(log2.length, 41)
        deepStrictEqual(log1.values.map(e => e.payload), log2.values.map(e => e.payload))
      })

      it('Joining after concurrently appending same payload joins entry once', async () => {
        await log1.join(log2)
        await log2.join(log1)

        strictEqual(log1.length, log2.length)
        strictEqual(log1.length, 41)
        deepStrictEqual(log1.values.map(e => e.payload), log2.values.map(e => e.payload))
      })
    })
  })
})
