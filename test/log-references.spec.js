import { strictEqual } from 'assert'
import rimraf from 'rimraf'
import { copy } from 'fs-extra'
import Log from '../src/log.js'
import IdentityProvider from 'orbit-db-identity-provider'
import Keystore from 'orbit-db-keystore'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs } from 'orbit-db-test-utils'

const { sync: rmrf } = rimraf
const { createIdentity } = IdentityProvider

let ipfsd, ipfs, testIdentity

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - References (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    let keystore, signingKeystore

    before(async () => {
      rmrf(identityKeysPath)
      rmrf(signingKeysPath)
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
      rmrf(identityKeysPath)
      rmrf(signingKeysPath)

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

        strictEqual(log1.values[log1.length - 1].next.length, 1)
        strictEqual(log2.values[log2.length - 1].next.length, 1)
        strictEqual(log3.values[log3.length - 1].next.length, 1)
        strictEqual(log4.values[log4.length - 1].next.length, 1)
        strictEqual(log1.values[log1.length - 1].refs.length, 1)
        strictEqual(log2.values[log2.length - 1].refs.length, 2)
        strictEqual(log3.values[log3.length - 1].refs.length, 3)
        strictEqual(log4.values[log4.length - 1].refs.length, 4)
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

            strictEqual(log1.values.length, input.amount)
            strictEqual(log1.values[log1.length - 1].clock.time, input.amount)

            for (let k = 0; k < input.amount; k++) {
              const idx = log1.length - k - 1
              strictEqual(log1.values[idx].clock.time, idx + 1)

              // Check the first ref (distance 2)
              if (log1.values[idx].refs.length > 0) { strictEqual(log1.values[idx].refs[0], log1.values[idx - 2].hash) }

              // Check the second ref (distance 2)

              if (log1.values[idx].refs.length > 1 && idx > referenceCount) { strictEqual(log1.values[idx].refs[1], log1.values[idx - 4].hash) }

              // Check the third ref (distance 4)
              if (log1.values[idx].refs.length > 2 && idx > referenceCount) { strictEqual(log1.values[idx].refs[2], log1.values[idx - 8].hash) }

              // Check the fourth ref (distance 8)
              if (log1.values[idx].refs.length > 3 && idx > referenceCount) { strictEqual(log1.values[idx].refs[3], log1.values[idx - 16].hash) }

              // Check the fifth ref (distance 16)
              if (log1.values[idx].refs.length > 4 && idx > referenceCount) { strictEqual(log1.values[idx].refs[4], log1.values[idx - 32].hash) }

              // Check the reference of each entry
              if (idx > referenceCount) { strictEqual(log1.values[idx].refs.length, refLength) }
            }
          }

          await test(input.amount, input.referenceCount, input.refLength)
        })
      })
    })
  })
})
