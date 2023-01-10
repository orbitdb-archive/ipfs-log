import { strictEqual, deepStrictEqual } from 'assert'
import rimraf from 'rimraf'
import { copy } from 'fs-extra'
import Log from '../src/log.js'
import IdentityProvider from 'orbit-db-identity-provider'
import Keystore from 'orbit-db-keystore'
import LogCreator from './utils/log-creator.js'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs } from 'orbit-db-test-utils'

const { sync: rmrf } = rimraf
const { createIdentity } = IdentityProvider
const { createLogWithSixteenEntries } = LogCreator

let ipfsd, ipfs, testIdentity, testIdentity2, testIdentity3

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Iterator (' + IPFS + ')', function () {
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
      testIdentity2 = await createIdentity({ id: 'userB', keystore, signingKeystore })
      testIdentity3 = await createIdentity({ id: 'userC', keystore, signingKeystore })
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

    describe('Basic iterator functionality', () => {
      let log1

      beforeEach(async () => {
        log1 = new Log(ipfs, testIdentity, { logId: 'X' })

        for (let i = 0; i <= 100; i++) {
          await log1.append('entry' + i)
        }
      })

      it('returns a Symbol.iterator object', async () => {
        const it = log1.iterator({
          lte: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde',
          amount: 0
        })

        strictEqual(typeof it[Symbol.iterator], 'function')
        deepStrictEqual(it.next(), { value: undefined, done: true })
      })

      it('returns length with lte and amount', async () => {
        const amount = 10
        const it = log1.iterator({
          lte: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde',
          amount
        })

        strictEqual([...it].length, 10)
      })

      it('returns entries with lte and amount', async () => {
        const amount = 10

        const it = log1.iterator({
          lte: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde',
          amount
        })

        let i = 0
        for (const entry of it) {
          strictEqual(entry.payload, 'entry' + (67 - i++))
        }
      })

      it('returns length with lt and amount', async () => {
        const amount = 10

        const it = log1.iterator({
          lt: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde',
          amount
        })

        strictEqual([...it].length, amount)
      })

      it('returns entries with lt and amount', async () => {
        const amount = 10

        const it = log1.iterator({
          lt: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde',
          amount
        })

        let i = 1
        for (const entry of it) {
          strictEqual(entry.payload, 'entry' + (67 - i++))
        }
      })

      it('returns correct length with gt and amount', async () => {
        const amount = 5
        const it = log1.iterator({
          gt: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde',
          amount
        })

        let i = 0
        let count = 0
        for (const entry of it) {
          strictEqual(entry.payload, 'entry' + (72 - i++))
          count++
        }
        strictEqual(count, amount)
      })

      it('returns length with gte and amount', async () => {
        const amount = 12

        const it = log1.iterator({
          gt: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde',
          amount
        })

        strictEqual([...it].length, amount)
      })

      it('returns entries with gte and amount', async () => {
        const amount = 12

        const it = log1.iterator({
          gt: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde',
          amount
        })

        let i = 0
        for (const entry of it) {
          strictEqual(entry.payload, 'entry' + (79 - i++))
        }
      })

      /* eslint-disable camelcase */
      it('iterates with lt and gt', async () => {
        const it = log1.iterator({
          gt: 'zdpuAymZUrYbHgwfYK76xXYhzxNqwaXRWWrn5kmRsZJFdqBEz',
          lt: 'zdpuAoDcWRiChLXnGskymcGrM1VdAjsaFrsXvNZmcDattA7AF'
        })
        const hashes = [...it].map(e => e.hash)

        // neither hash should appear in the array
        strictEqual(hashes.indexOf('zdpuAymZUrYbHgwfYK76xXYhzxNqwaXRWWrn5kmRsZJFdqBEz'), -1)
        strictEqual(hashes.indexOf('zdpuAoDcWRiChLXnGskymcGrM1VdAjsaFrsXvNZmcDattA7AF'), -1)
        strictEqual(hashes.length, 10)
      })

      it('iterates with lt and gte', async () => {
        const it = log1.iterator({
          gte: 'zdpuAt7YtNE1i9APJitGyKomcmxjc2BDHa57wkrjq4onqBNaR',
          lt: 'zdpuAr8N4vzqcB5sh5JLcr6Eszo4HnYefBWDbBBwwrTPo6kU6'
        })
        const hashes = [...it].map(e => e.hash)

        // only the gte hash should appear in the array
        strictEqual(hashes.indexOf('zdpuAt7YtNE1i9APJitGyKomcmxjc2BDHa57wkrjq4onqBNaR'), 24)
        strictEqual(hashes.indexOf('zdpuAr8N4vzqcB5sh5JLcr6Eszo4HnYefBWDbBBwwrTPo6kU6'), -1)
        strictEqual(hashes.length, 25)
      })

      it('iterates with lte and gt', async () => {
        const it = log1.iterator({
          gt: 'zdpuAqUrGrPa4AaZAQbCH4yxQfEjB32rdFY743XCgyGW8iAuU',
          lte: 'zdpuAwkagwE9D2jUtLnDiCPqBGh9xhpnaX8iEDQ3K7HRmjggi'
        })
        const hashes = [...it].map(e => e.hash)

        // only the lte hash should appear in the array
        strictEqual(hashes.indexOf('zdpuAqUrGrPa4AaZAQbCH4yxQfEjB32rdFY743XCgyGW8iAuU'), -1)
        strictEqual(hashes.indexOf('zdpuAwkagwE9D2jUtLnDiCPqBGh9xhpnaX8iEDQ3K7HRmjggi'), 0)
        strictEqual(hashes.length, 4)
      })

      it('iterates with lte and gte', async () => {
        const it = log1.iterator({
          gte: 'zdpuAzG5AD1GdeNffSskTErjjPbAb95QiNyoaQSrbB62eqYSD',
          lte: 'zdpuAuujURnUUxVw338Xwh47zGEFjjbaZXXARHPik6KYUcUVk'
        })
        const hashes = [...it].map(e => e.hash)

        // neither hash should appear in the array
        strictEqual(hashes.indexOf('zdpuAzG5AD1GdeNffSskTErjjPbAb95QiNyoaQSrbB62eqYSD'), 9)
        strictEqual(hashes.indexOf('zdpuAuujURnUUxVw338Xwh47zGEFjjbaZXXARHPik6KYUcUVk'), 0)
        strictEqual(hashes.length, 10)
      })

      it('returns length with gt and default amount', async () => {
        const it = log1.iterator({
          gt: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde'
        })

        strictEqual([...it].length, 33)
      })

      it('returns entries with gt and default amount', async () => {
        const it = log1.iterator({
          gt: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde'
        })

        let i = 0
        for (const entry of it) {
          strictEqual(entry.payload, 'entry' + (100 - i++))
        }
      })

      it('returns length with gte and default amount', async () => {
        const it = log1.iterator({
          gte: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde'
        })

        strictEqual([...it].length, 34)
      })

      it('returns entries with gte and default amount', async () => {
        const it = log1.iterator({
          gte: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde'
        })

        let i = 0
        for (const entry of it) {
          strictEqual(entry.payload, 'entry' + (100 - i++))
        }
      })

      it('returns length with lt and default amount value', async () => {
        const it = log1.iterator({
          lt: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde'
        })

        strictEqual([...it].length, 67)
      })

      it('returns entries with lt and default amount value', async () => {
        const it = log1.iterator({
          lt: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde'
        })

        let i = 0
        for (const entry of it) {
          strictEqual(entry.payload, 'entry' + (66 - i++))
        }
      })

      it('returns length with lte and default amount value', async () => {
        const it = log1.iterator({
          lte: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde'
        })

        strictEqual([...it].length, 68)
      })

      it('returns entries with lte and default amount value', async () => {
        const it = log1.iterator({
          lte: 'zdpuAuNuQ4YBeXY5YStfrsJx6ykz4yBV2XnNcBR4uGmiojQde'
        })

        let i = 0
        for (const entry of it) {
          strictEqual(entry.payload, 'entry' + (67 - i++))
        }
      })
    })

    describe('Iteration over forked/joined logs', () => {
      let fixture, identities

      before(async () => {
        identities = [testIdentity3, testIdentity2, testIdentity3, testIdentity]
        fixture = await createLogWithSixteenEntries(Log, ipfs, identities)
      })

      it('returns the full length from all heads', async () => {
        const it = fixture.log.iterator({
          lte: fixture.log.heads
        })

        strictEqual([...it].length, 16)
      })

      it('returns partial entries from all heads', async () => {
        const it = fixture.log.iterator({
          lte: fixture.log.heads,
          amount: 6
        })

        deepStrictEqual([...it].map(e => e.payload),
          ['entryA10', 'entryA9', 'entryA8', 'entryA7', 'entryC0', 'entryA6'])
      })

      it('returns partial logs from single heads #1', async () => {
        const it = fixture.log.iterator({
          lte: [fixture.log.heads[0]]
        })

        strictEqual([...it].length, 10)
      })

      it('returns partial logs from single heads #2', async () => {
        const it = fixture.log.iterator({
          lte: [fixture.log.heads[1]]
        })

        strictEqual([...it].length, 11)
      })

      it('throws error if lt/lte not a string or array of entries', async () => {
        let errMsg

        try {
          fixture.log.iterator({
            lte: fixture.log.heads[1]
          })
        } catch (e) {
          errMsg = e.message
        }

        strictEqual(errMsg, 'lt or lte must be a string or array of Entries')
      })
    })
  })
})
