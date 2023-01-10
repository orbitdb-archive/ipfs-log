import { strictEqual, notStrictEqual, deepStrictEqual } from 'assert'
import rimraf from 'rimraf'
import { copy } from 'fs-extra'
import Clock from '../src/lamport-clock.js'
import Entry from '../src/entry.js'
import Log from '../src/log.js'
import IdentityProvider from 'orbit-db-identity-provider'
import Keystore from 'orbit-db-keystore'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs } from 'orbit-db-test-utils'

const { fromEntry } = Log
const { create } = Entry
const { sync: rmrf } = rimraf
const { createIdentity } = IdentityProvider

let ipfsd, ipfs, testIdentity, testIdentity2, testIdentity3, testIdentity4

const last = (arr) => {
  return arr[arr.length - 1]
}

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Join (' + IPFS + ')', function () {
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

      testIdentity = await createIdentity({ id: 'userC', keystore, signingKeystore })
      testIdentity2 = await createIdentity({ id: 'userB', keystore, signingKeystore })
      testIdentity3 = await createIdentity({ id: 'userD', keystore, signingKeystore })
      testIdentity4 = await createIdentity({ id: 'userA', keystore, signingKeystore })

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

    describe('join', () => {
      let log1, log2, log3, log4

      beforeEach(async () => {
        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
        log4 = new Log(ipfs, testIdentity4, { logId: 'X' })
      })

      it('joins logs', async () => {
        const items1 = []
        const items2 = []
        const items3 = []
        const amount = 100
        for (let i = 1; i <= amount; i++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await create(ipfs, testIdentity, 'X', 'entryA' + i, [prev1])
          const n2 = await create(ipfs, testIdentity2, 'X', 'entryB' + i, [prev2, n1])
          const n3 = await create(ipfs, testIdentity3, 'X', 'entryC' + i, [prev3, n1, n2])
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        // Here we're creating a log from entries signed by A and B
        // but we accept entries from C too
        const logA = await fromEntry(ipfs, testIdentity3, last(items2), -1)
        // Here we're creating a log from entries signed by peer A, B and C
        // "logA" accepts entries from peer C so we can join logs A and B
        const logB = await fromEntry(ipfs, testIdentity3, last(items3), -1)
        strictEqual(logA.length, items2.length + items1.length)
        strictEqual(logB.length, items3.length + items2.length + items1.length)

        await logA.join(logB)

        strictEqual(logA.length, items3.length + items2.length + items1.length)
        // The last entry, 'entryC100', should be the only head
        // (it points to entryB100, entryB100 and entryC99)
        strictEqual(logA.heads.length, 1)
      })

      it('throws an error if first log is not defined', async () => {
        let err
        try {
          await log1.join()
        } catch (e) {
          err = e
        }
        notStrictEqual(err, null)
        strictEqual(err.message, 'Log instance not defined')
      })

      it('throws an error if passed argument is not an instance of Log', async () => {
        let err
        try {
          await log1.join({})
        } catch (e) {
          err = e
        }
        notStrictEqual(err, null)
        strictEqual(err.message, 'Given argument is not an instance of Log')
      })

      it('joins only unique items', async () => {
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log1.join(log2)

        const expectedData = [
          'helloA1', 'helloB1', 'helloA2', 'helloB2'
        ]

        strictEqual(log1.length, 4)
        deepStrictEqual(log1.values.map((e) => e.payload), expectedData)

        const item = last(log1.values)
        strictEqual(item.next.length, 1)
      })

      it('joins logs two ways', async () => {
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log2.join(log1)

        const expectedData = [
          'helloA1', 'helloB1', 'helloA2', 'helloB2'
        ]

        deepStrictEqual(log1.values.map((e) => e.hash), log2.values.map((e) => e.hash))
        deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
        deepStrictEqual(log2.values.map((e) => e.payload), expectedData)
      })

      it('joins logs twice', async () => {
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log2.join(log1)

        await log1.append('helloA2')
        await log2.append('helloB2')
        await log2.join(log1)

        const expectedData = [
          'helloA1', 'helloB1', 'helloA2', 'helloB2'
        ]

        strictEqual(log2.length, 4)
        deepStrictEqual(log2.values.map((e) => e.payload), expectedData)
      })

      it('joins 2 logs two ways', async () => {
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log2.join(log1)
        await log1.join(log2)
        await log1.append('helloA2')
        await log2.append('helloB2')
        await log2.join(log1)

        const expectedData = [
          'helloA1', 'helloB1', 'helloA2', 'helloB2'
        ]

        strictEqual(log2.length, 4)
        deepStrictEqual(log2.values.map((e) => e.payload), expectedData)
      })

      it('joins 2 logs two ways and has the right heads at every step', async () => {
        await log1.append('helloA1')
        strictEqual(log1.heads.length, 1)
        strictEqual(log1.heads[0].payload, 'helloA1')

        await log2.append('helloB1')
        strictEqual(log2.heads.length, 1)
        strictEqual(log2.heads[0].payload, 'helloB1')

        await log2.join(log1)
        strictEqual(log2.heads.length, 2)
        strictEqual(log2.heads[0].payload, 'helloB1')
        strictEqual(log2.heads[1].payload, 'helloA1')

        await log1.join(log2)
        strictEqual(log1.heads.length, 2)
        strictEqual(log1.heads[0].payload, 'helloB1')
        strictEqual(log1.heads[1].payload, 'helloA1')

        await log1.append('helloA2')
        strictEqual(log1.heads.length, 1)
        strictEqual(log1.heads[0].payload, 'helloA2')

        await log2.append('helloB2')
        strictEqual(log2.heads.length, 1)
        strictEqual(log2.heads[0].payload, 'helloB2')

        await log2.join(log1)
        strictEqual(log2.heads.length, 2)
        strictEqual(log2.heads[0].payload, 'helloB2')
        strictEqual(log2.heads[1].payload, 'helloA2')
      })

      it('joins 4 logs to one', async () => {
        // order determined by identity's publicKey
        await log1.append('helloA1')
        await log1.append('helloA2')

        await log3.append('helloB1')
        await log3.append('helloB2')

        await log2.append('helloC1')
        await log2.append('helloC2')

        await log4.append('helloD1')
        await log4.append('helloD2')
        await log1.join(log2)
        await log1.join(log3)
        await log1.join(log4)

        const expectedData = [
          'helloA1',
          'helloB1',
          'helloC1',
          'helloD1',
          'helloA2',
          'helloB2',
          'helloC2',
          'helloD2'
        ]

        strictEqual(log1.length, 8)
        deepStrictEqual(log1.values.map(e => e.payload), expectedData)
      })

      it('joins 4 logs to one is commutative', async () => {
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log4.append('helloD1')
        await log4.append('helloD2')
        await log1.join(log2)
        await log1.join(log3)
        await log1.join(log4)
        await log2.join(log1)
        await log2.join(log3)
        await log2.join(log4)

        strictEqual(log1.length, 8)
        deepStrictEqual(log1.values.map(e => e.payload), log2.values.map(e => e.payload))
      })

      it('joins logs and updates clocks', async () => {
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log2.join(log1)
        await log1.append('helloA2')
        await log2.append('helloB2')

        strictEqual(log1.clock.id, testIdentity.publicKey)
        strictEqual(log2.clock.id, testIdentity2.publicKey)
        strictEqual(log1.clock.time, 2)
        strictEqual(log2.clock.time, 2)

        await log3.join(log1)
        strictEqual(log3.id, 'X')
        strictEqual(log3.clock.id, testIdentity3.publicKey)
        strictEqual(log3.clock.time, 2)

        await log3.append('helloC1')
        await log3.append('helloC2')
        await log1.join(log3)
        await log1.join(log2)
        await log4.append('helloD1')
        await log4.append('helloD2')
        await log4.join(log2)
        await log4.join(log1)
        await log4.join(log3)
        await log4.append('helloD3')
        await log4.append('helloD4')

        await log1.join(log4)
        await log4.join(log1)
        await log4.append('helloD5')
        await log1.append('helloA5')
        await log4.join(log1)
        deepStrictEqual(log4.clock.id, testIdentity4.publicKey)
        deepStrictEqual(log4.clock.time, 7)

        await log4.append('helloD6')
        deepStrictEqual(log4.clock.time, 8)

        const expectedData = [
          { payload: 'helloA1', id: 'X', clock: new Clock(testIdentity.publicKey, 1) },
          { payload: 'helloB1', id: 'X', clock: new Clock(testIdentity2.publicKey, 1) },
          { payload: 'helloD1', id: 'X', clock: new Clock(testIdentity4.publicKey, 1) },
          { payload: 'helloA2', id: 'X', clock: new Clock(testIdentity.publicKey, 2) },
          { payload: 'helloB2', id: 'X', clock: new Clock(testIdentity2.publicKey, 2) },
          { payload: 'helloD2', id: 'X', clock: new Clock(testIdentity4.publicKey, 2) },
          { payload: 'helloC1', id: 'X', clock: new Clock(testIdentity3.publicKey, 3) },
          { payload: 'helloC2', id: 'X', clock: new Clock(testIdentity3.publicKey, 4) },
          { payload: 'helloD3', id: 'X', clock: new Clock(testIdentity4.publicKey, 5) },
          { payload: 'helloD4', id: 'X', clock: new Clock(testIdentity4.publicKey, 6) },
          { payload: 'helloA5', id: 'X', clock: new Clock(testIdentity.publicKey, 7) },
          { payload: 'helloD5', id: 'X', clock: new Clock(testIdentity4.publicKey, 7) },
          { payload: 'helloD6', id: 'X', clock: new Clock(testIdentity4.publicKey, 8) }
        ]

        const transformed = log4.values.map((e) => {
          return { payload: e.payload, id: e.id, clock: e.clock }
        })

        strictEqual(log4.length, 13)
        deepStrictEqual(transformed, expectedData)
      })

      it('joins logs from 4 logs', async () => {
        await log1.append('helloA1')
        await log1.join(log2)
        await log2.append('helloB1')
        await log2.join(log1)
        await log1.append('helloA2')
        await log2.append('helloB2')

        await log1.join(log3)
        strictEqual(log1.id, 'X')
        strictEqual(log1.clock.id, testIdentity.publicKey)
        strictEqual(log1.clock.time, 2)

        await log3.join(log1)
        strictEqual(log3.id, 'X')
        strictEqual(log3.clock.id, testIdentity3.publicKey)
        strictEqual(log3.clock.time, 2)

        await log3.append('helloC1')
        await log3.append('helloC2')
        await log1.join(log3)
        await log1.join(log2)
        await log4.append('helloD1')
        await log4.append('helloD2')
        await log4.join(log2)
        await log4.join(log1)
        await log4.join(log3)
        await log4.append('helloD3')
        await log4.append('helloD4')

        strictEqual(log4.clock.id, testIdentity4.publicKey)
        strictEqual(log4.clock.time, 6)

        const expectedData = [
          'helloA1',
          'helloB1',
          'helloD1',
          'helloA2',
          'helloB2',
          'helloD2',
          'helloC1',
          'helloC2',
          'helloD3',
          'helloD4'
        ]

        strictEqual(log4.length, 10)
        deepStrictEqual(log4.values.map((e) => e.payload), expectedData)
      })

      describe('takes length as an argument', async () => {
        beforeEach(async () => {
          await log1.append('helloA1')
          await log1.append('helloA2')
          await log2.append('helloB1')
          await log2.append('helloB2')
        })

        it('joins only specified amount of entries - one entry', async () => {
          await log1.join(log2, 1)

          const expectedData = [
            'helloB2'
          ]
          const lastEntry = last(log1.values)

          strictEqual(log1.length, 1)
          deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
          strictEqual(lastEntry.next.length, 1)
        })

        it('joins only specified amount of entries - two entries', async () => {
          await log1.join(log2, 2)

          const expectedData = [
            'helloA2', 'helloB2'
          ]
          const lastEntry = last(log1.values)

          strictEqual(log1.length, 2)
          deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
          strictEqual(lastEntry.next.length, 1)
        })

        it('joins only specified amount of entries - three entries', async () => {
          await log1.join(log2, 3)

          const expectedData = [
            'helloB1', 'helloA2', 'helloB2'
          ]
          const lastEntry = last(log1.values)

          strictEqual(log1.length, 3)
          deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
          strictEqual(lastEntry.next.length, 1)
        })

        it('joins only specified amount of entries - (all) four entries', async () => {
          await log1.join(log2, 4)

          const expectedData = [
            'helloA1', 'helloB1', 'helloA2', 'helloB2'
          ]
          const lastEntry = last(log1.values)

          strictEqual(log1.length, 4)
          deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
          strictEqual(lastEntry.next.length, 1)
        })
      })
    })
  })
})
