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
  describe('Log - References (' + IPFS + ')', function () {
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
    describe('References', () => {
      it('creates entries with references', async () => {
        const amount = 64
        const maxReferenceDistance = 2
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'B' })
        const log3 = new Log(ipfs, testIdentity, { logId: 'C' })
        const log4 = new Log(ipfs, testIdentity, { logId: 'D' })

        for (let i = 0; i < amount; i++) {
          await log1.append(i.toString(), maxReferenceDistance)
        }

        for (let i = 0; i < amount * 2; i++) {
          await log2.append(i.toString(), Math.pow(maxReferenceDistance, 2))
        }

        for (let i = 0; i < amount * 3; i++) {
          await log3.append(i.toString(), Math.pow(maxReferenceDistance, 3))
        }

        for (let i = 0; i < amount * 4; i++) {
          await log4.append(i.toString(), Math.pow(maxReferenceDistance, 4))
        }

        const values1 = await log1.values()
        const values2 = await log2.values()
        const values3 = await log3.values()
        const values4 = await log4.values()

        assert.strict.equal(values1[log1.length - 1].next.length, 1)
        assert.strict.equal(values2[log2.length - 1].next.length, 1)
        assert.strict.equal(values3[log3.length - 1].next.length, 1)
        assert.strict.equal(values4[log4.length - 1].next.length, 1)
        assert.strict.equal(values1[log1.length - 1].refs.length, 1)
        assert.strict.equal(values2[log2.length - 1].refs.length, 2)
        assert.strict.equal(values3[log3.length - 1].refs.length, 3)
        assert.strict.equal(values4[log4.length - 1].refs.length, 4)
      })

      const inputs = [
        { amount: 1, referenceCount: 1, refLength: 0 },
        { amount: 1, referenceCount: 2, refLength: 0 },
        { amount: 2, referenceCount: 1, refLength: 1 },
        { amount: 2, referenceCount: 2, refLength: 1 },
        { amount: 3, referenceCount: 2, refLength: 1 },
        { amount: 3, referenceCount: 4, refLength: 1 },
        { amount: 4, referenceCount: 4, refLength: 2 },
        { amount: 4, referenceCount: 4, refLength: 2 },
        { amount: 32, referenceCount: 4, refLength: 2 },
        { amount: 32, referenceCount: 8, refLength: 3 },
        { amount: 32, referenceCount: 16, refLength: 4 },
        { amount: 18, referenceCount: 32, refLength: 5 },
        { amount: 128, referenceCount: 32, refLength: 5 },
        { amount: 64, referenceCount: 64, refLength: 6 },
        { amount: 65, referenceCount: 64, refLength: 6 },
        { amount: 128, referenceCount: 64, refLength: 6 },
        { amount: 128, referenceCount: 1, refLength: 0 },
        { amount: 128, referenceCount: 2, refLength: 1 },
        { amount: 256, referenceCount: 1, refLength: 0 },
        { amount: 256, referenceCount: 256, refLength: 8 },
        { amount: 256, referenceCount: 1024, refLength: 8 }
      ]

      inputs.forEach(input => {
        it(`has ${input.refLength} references, max distance ${input.referenceCount}, total of ${input.amount} entries`, async () => {
          const test = async (amount, referenceCount, refLength) => {
            const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
            for (let i = 0; i < amount; i++) {
              await log1.append((i + 1).toString(), referenceCount)
            }

            const values1 = await log1.values()
            assert.strict.equal(values1.length, input.amount)
            assert.strict.equal(values1[log1.length - 1].clock.time, input.amount)

            for (let k = 0; k < input.amount; k++) {
              const idx = log1.length - k - 1
              assert.strict.equal(values1[idx].clock.time, idx + 1)

              // Check the first ref (distance 2)
              if (values1[idx].refs.length > 0) { assert.strict.equal(values1[idx].refs[0], values1[idx - 2].hash) }

              // Check the second ref (distance 2)

              if (values1[idx].refs.length > 1 && idx > referenceCount) { assert.strict.equal(values1[idx].refs[1], values1[idx - 4].hash) }

              // Check the third ref (distance 4)
              if (values1[idx].refs.length > 2 && idx > referenceCount) { assert.strict.equal(values1[idx].refs[2], values1[idx - 8].hash) }

              // Check the fourth ref (distance 8)
              if (values1[idx].refs.length > 3 && idx > referenceCount) { assert.strict.equal(values1[idx].refs[3], values1[idx - 16].hash) }

              // Check the fifth ref (distance 16)
              if (values1[idx].refs.length > 4 && idx > referenceCount) { assert.strict.equal(values1[idx].refs[4], values1[idx - 32].hash) }

              // Check the reference of each entry
              if (idx > referenceCount) { assert.strict.equal(values1[idx].refs.length, refLength) }
            }
          }

          await test(input.amount, input.referenceCount, input.refLength)
        })
      })
    })
  })
})
