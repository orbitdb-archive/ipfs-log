'use strict'

import { strictEqual, deepStrictEqual } from 'assert'
import { sync } from 'rimraf'
import { copy } from 'fs-extra'
import Log from '../src/log'
import { createIdentity } from 'orbit-db-identity-provider'
import Keystore from 'orbit-db-keystore'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs } from 'orbit-db-test-utils'

let ipfsd, ipfs, testIdentity, testIdentity2, testIdentity3

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - CRDT (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    let keystore, signingKeystore

    before(async () => {
      sync(identityKeysPath)
      sync(signingKeysPath)
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
      sync(identityKeysPath)
      sync(signingKeysPath)

      await keystore.close()
      await signingKeystore.close()
    })

    describe('is a CRDT', () => {
      let log1, log2, log3

      beforeEach(async () => {
        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
      })

      it('join is associative', async () => {
        const expectedElementsCount = 6

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')

        // a + (b + c)
        await log2.join(log3)
        await log1.join(log2)

        const res1 = log1.values.slice()

        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')

        // (a + b) + c
        await log1.join(log2)
        await log3.join(log1)

        const res2 = log3.values.slice()

        // associativity: a + (b + c) == (a + b) + c
        strictEqual(res1.length, expectedElementsCount)
        strictEqual(res2.length, expectedElementsCount)
        deepStrictEqual(res1, res2)
      })

      it('join is commutative', async () => {
        const expectedElementsCount = 4

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')

        // b + a
        await log2.join(log1)
        const res1 = log2.values.slice()

        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')

        // a + b
        await log1.join(log2)
        const res2 = log1.values.slice()

        // commutativity: a + b == b + a
        strictEqual(res1.length, expectedElementsCount)
        strictEqual(res2.length, expectedElementsCount)
        deepStrictEqual(res1, res2)
      })

      it('multiple joins are commutative', async () => {
        // b + a == a + b
        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log2.join(log1)
        const resA1 = log2.toString()

        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const resA2 = log1.toString()

        strictEqual(resA1, resA2)

        // a + b == b + a
        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const resB1 = log1.toString()

        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log2.join(log1)
        const resB2 = log2.toString()

        strictEqual(resB1, resB2)

        // a + c == c + a
        log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        log3 = new Log(ipfs, testIdentity3, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log3.join(log1)
        const resC1 = log3.toString()

        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log1.join(log3)
        const resC2 = log1.toString()

        strictEqual(resC1, resC2)

        // c + b == b + c
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        log3 = new Log(ipfs, testIdentity3, { logId: 'X' })

        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log3.join(log2)
        const resD1 = log3.toString()

        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log2.join(log3)
        const resD2 = log2.toString()

        strictEqual(resD1, resD2)

        // a + b + c == c + b + a
        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log1.join(log2)
        await log1.join(log3)
        const logLeft = log1.toString()

        log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log3.join(log2)
        await log3.join(log1)
        const logRight = log3.toString()

        strictEqual(logLeft, logRight)
      })

      it('join is idempotent', async () => {
        const expectedElementsCount = 3

        const logA = new Log(ipfs, testIdentity, { logId: 'X' })
        await logA.append('helloA1')
        await logA.append('helloA2')
        await logA.append('helloA3')

        // idempotence: a + a = a
        await logA.join(logA)
        strictEqual(logA.length, expectedElementsCount)
      })
    })
  })
})
