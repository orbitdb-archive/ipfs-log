import { strictEqual, deepStrictEqual } from 'assert'
import rimraf from 'rimraf'
import { copy } from 'fs-extra'
import Entry from '../src/entry.js'
import Log from '../src/log.js'
import IdentityProvider from 'orbit-db-identity-provider'
import Keystore from 'orbit-db-keystore'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs } from 'orbit-db-test-utils'

const { sync } = rimraf
const { createIdentity } = IdentityProvider
const { isEntry } = Entry
const { fromEntry } = Log

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
      sync(identityKeysPath)
      sync(signingKeysPath)
      await copy(identityKeyFixtures, identityKeysPath)
      await copy(signingKeyFixtures, signingKeysPath)

      keystore = new Keystore(identityKeysPath)
      signingKeystore = new Keystore(signingKeysPath)

      testIdentity = await createIdentity({ id: 'userA', keystore, signingKeystore })
      testIdentity2 = await createIdentity({ id: 'userB', keystore, signingKeystore })
      testIdentity3 = await createIdentity({ id: 'userC', keystore, signingKeystore })
      testIdentity4 = await createIdentity({ id: 'userD', keystore, signingKeystore })
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

    describe('heads', () => {
      it('finds one head after one entry', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        strictEqual(log1.heads.length, 1)
      })

      it('finds one head after two entries', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        strictEqual(log1.heads.length, 1)
      })

      it('log contains the head entry', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        deepStrictEqual(log1.get(log1.heads[0].hash), log1.heads[0])
      })

      it('finds head after a join and append', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')

        await log2.join(log1)
        await log2.append('helloB2')
        const expectedHead = last(log2.values)

        strictEqual(log2.heads.length, 1)
        deepStrictEqual(log2.heads[0].hash, expectedHead.hash)
      })

      it('finds two heads after a join', async () => {
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        const expectedHead1 = last(log1.values)

        await log2.append('helloB1')
        await log2.append('helloB2')
        const expectedHead2 = last(log2.values)

        await log1.join(log2)

        const heads = log1.heads
        strictEqual(heads.length, 2)
        strictEqual(heads[0].hash, expectedHead2.hash)
        strictEqual(heads[1].hash, expectedHead1.hash)
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
        const expectedHead2 = last(log2.values)
        const expectedHead1 = last(log1.values)

        await log1.join(log2)

        const heads = log1.heads
        strictEqual(heads.length, 2)
        strictEqual(heads[0].hash, expectedHead1.hash)
        strictEqual(heads[1].hash, expectedHead2.hash)
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
        const expectedHead1 = last(log1.values)
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log2.join(log3)
        await log2.append('helloB3')
        const expectedHead2 = last(log2.values)
        await log1.join(log2)

        const heads = log1.heads
        strictEqual(heads.length, 2)
        strictEqual(heads[0].hash, expectedHead1.hash)
        strictEqual(heads[1].hash, expectedHead2.hash)
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
        const expectedHead1 = last(log1.values)
        await log3.append('helloC1')
        await log2.append('helloB3')
        await log3.append('helloC2')
        const expectedHead2 = last(log2.values)
        const expectedHead3 = last(log3.values)
        await log1.join(log2)
        await log1.join(log3)

        const heads = log1.heads
        strictEqual(heads.length, 3)
        deepStrictEqual(heads[0].hash, expectedHead1.hash)
        deepStrictEqual(heads[1].hash, expectedHead2.hash)
        deepStrictEqual(heads[2].hash, expectedHead3.hash)
      })
    })

    describe('tails', () => {
      it('returns a tail', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        strictEqual(log1.tails.length, 1)
      })

      it('tail is a Entry', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        strictEqual(isEntry(log1.tails[0]), true)
      })

      it('returns tail entries', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        strictEqual(log1.tails.length, 2)
        strictEqual(isEntry(log1.tails[0]), true)
        strictEqual(isEntry(log1.tails[1]), true)
      })

      it('returns tail hashes', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2, 2)
        strictEqual(log1.tailHashes.length, 2)
      })

      it('returns no tail hashes if all entries point to empty nexts', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        strictEqual(log1.tailHashes.length, 0)
      })

      it('returns tails after loading a partial log', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        const log2 = new Log(ipfs, testIdentity2, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const log4 = await fromEntry(ipfs, testIdentity, log1.heads, { length: 2 })
        strictEqual(log4.length, 2)
        strictEqual(log4.tails.length, 2)
        strictEqual(log4.tails[0].hash, log4.values[0].hash)
        strictEqual(log4.tails[1].hash, log4.values[1].hash)
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
        strictEqual(log4.tails.length, 3)
        strictEqual(log4.tails[0].id, 'XX')
        strictEqual(log4.tails[0].clock.id, testIdentity3.publicKey)
        strictEqual(log4.tails[1].clock.id, testIdentity2.publicKey)
        strictEqual(log4.tails[2].clock.id, testIdentity.publicKey)
        strictEqual(log4.clock.id, testIdentity4.publicKey)
      })
    })
  })
})
