'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const fs = require('fs-extra')
const Entry = require('../src/entry')
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

let ipfsd, ipfs, testIdentity, testIdentity2, testIdentity3, testIdentity4

const last = (arr) => {
  return arr[arr.length - 1]
}

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Heads and Tails (' + IPFS + ')', function () {
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
      testIdentity3 = await IdentityProvider.createIdentity({ id: 'userC', keystore, signingKeystore })
      testIdentity4 = await IdentityProvider.createIdentity({ id: 'userD', keystore, signingKeystore })
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

    describe('heads', () => {
      it('finds one head after one entry', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        assert.strictEqual(log1.heads.length, 1)
      })

      it('finds one head after two entries', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        assert.strictEqual(log1.heads.length, 1)
      })

      it('log contains the head entry', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        const entry = await log1.get(log1.heads[0].hash)
        assert.deepStrictEqual(entry, log1.heads[0])
      })

      it('finds head after a join and append', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')

        await log2.join(log1)
        await log2.append('helloB2')
        const values2 = await log2.values()
        const expectedHead = last(values2)

        assert.strictEqual(log2.heads.length, 1)
        assert.deepStrictEqual(log2.heads[0].hash, expectedHead.hash)
      })

      it('finds two heads after a join', async () => {
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        const values1 = await log1.values()
        const expectedHead1 = last(values1)

        await log2.append('helloB1')
        await log2.append('helloB2')
        const values2 = await log2.values()
        const expectedHead2 = last(values2)

        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].hash, expectedHead2.hash)
        assert.strictEqual(heads[1].hash, expectedHead1.hash)
      })

      it('finds two heads after two joins', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')

        await log2.append('helloB1')
        await log2.append('helloB2')

        await log1.join(log2)

        await log2.append('helloB3')

        await log1.append('helloA3')
        await log1.append('helloA4')
        const values1 = await log1.values()
        const values2 = await log2.values()
        const expectedHead2 = last(values2)
        const expectedHead1 = last(values1)

        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].hash, expectedHead1.hash)
        assert.strictEqual(heads[1].hash, expectedHead2.hash)
      })

      it('finds two heads after three joins', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log3 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log1.append('helloA3')
        await log1.append('helloA4')
        const values1 = await log1.values()
        const expectedHead1 = last(values1)
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log2.join(log3)
        await log2.append('helloB3')
        const values2 = await log2.values()
        const expectedHead2 = last(values2)
        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].hash, expectedHead1.hash)
        assert.strictEqual(heads[1].hash, expectedHead2.hash)
      })

      it('finds three heads after three joins', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log3 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log1.append('helloA3')
        await log1.append('helloA4')
        const values1 = await log1.values()
        const expectedHead1 = last(values1)
        await log3.append('helloC1')
        await log2.append('helloB3')
        await log3.append('helloC2')
        const values2 = await log2.values()
        const values3 = await log3.values()
        const expectedHead2 = last(values2)
        const expectedHead3 = last(values3)
        await log1.join(log2)
        await log1.join(log3)

        const heads = log1.heads
        assert.strictEqual(heads.length, 3)
        assert.deepStrictEqual(heads[0].hash, expectedHead1.hash)
        assert.deepStrictEqual(heads[1].hash, expectedHead2.hash)
        assert.deepStrictEqual(heads[2].hash, expectedHead3.hash)
      })
    })

    describe('tails', () => {
      it('returns a tail', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        const tails1 = await log1.tails()
        assert.strictEqual(tails1.length, 1)
      })

      it('tail is a Entry', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        const tails1 = await log1.tails()
        assert.strictEqual(Entry.isEntry(tails1[0]), true)
      })

      it('returns tail entries', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        const tails1 = await log1.tails()
        assert.strictEqual(tails1.length, 2)
        assert.strictEqual(Entry.isEntry(tails1[0]), true)
        assert.strictEqual(Entry.isEntry(tails1[1]), true)
      })

      it('returns tail hashes', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2, 2)
        const tailHashes = await log1.tailHashes()
        assert.strictEqual(tailHashes.length, 2)
      })

      it('returns no tail hashes if all entries point to empty nexts', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        const tailHashes = await log1.tailHashes()
        assert.strictEqual(tailHashes.length, 0)
      })

      it('returns tails after loading a partial log', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity2, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const log4 = await Log.fromEntry(ipfs, testIdentity, log1.heads, { length: 2 })
        assert.strictEqual(log4.length, 2)
        const tails4 = await log4.tails()
        assert.strictEqual(tails4.length, 2)
        const values4 = await log4.values()
        assert.strictEqual(tails4[0].hash, values4[0].hash)
        assert.strictEqual(tails4[1].hash, values4[1].hash)
      })

      it('returns tails sorted by public key', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'XX' })
        const log2 = new Log(ipfs, testIdentity2, { logId: 'XX' })
        const log3 = new Log(ipfs, testIdentity3, { logId: 'XX' })
        const log4 = new Log(ipfs, testIdentity4, { logId: 'XX' })
        await log1.append('helloX1')
        await log2.append('helloB1')
        await log3.append('helloA1')
        await log3.join(log1)
        await log3.join(log2)
        await log4.join(log3)
        const tails4 = await log4.tails()
        assert.strictEqual(tails4.length, 3)
        assert.strictEqual(tails4[0].id, 'XX')
        assert.strictEqual(tails4[0].clock.id, testIdentity3.publicKey)
        assert.strictEqual(tails4[1].clock.id, testIdentity2.publicKey)
        assert.strictEqual(tails4[2].clock.id, testIdentity.publicKey)
        assert.strictEqual(log4.clock.id, testIdentity4.publicKey)
      })
    })
  })
})
