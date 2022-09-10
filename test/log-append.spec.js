'use strict'

import { strictEqual } from 'assert'
import rimraf from 'rimraf'
import { copy } from 'fs-extra'
import Log from '../src/log.js'
import IdentityProvider from 'orbit-db-identity-provider'
import Keystore from 'orbit-db-keystore'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs } from 'orbit-db-test-utils'

const { createIdentity } = IdentityProvider
const { sync } = rimraf

let ipfsd, ipfs, testIdentity

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Append (' + IPFS + ')', function () {
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

    describe('append', () => {
      describe('append one', async () => {
        let log

        before(async () => {
          log = new Log(ipfs, testIdentity, 'A')
          await log.append('hello1')
        })

        it('added the correct amount of items', () => {
          strictEqual(log.length, 1)
        })

        it('added the correct values', async () => {
          log.values.forEach((entry) => {
            strictEqual(entry.payload, 'hello1')
          })
        })

        it('added the correct amount of next pointers', async () => {
          log.values.forEach((entry) => {
            strictEqual(entry.next.length, 0)
          })
        })

        it('has the correct heads', async () => {
          log.heads.forEach((head) => {
            strictEqual(head.hash, log.values[0].hash)
          })
        })

        it('updated the clocks correctly', async () => {
          log.values.forEach((entry) => {
            strictEqual(entry.clock.id, testIdentity.publicKey)
            strictEqual(entry.clock.time, 1)
          })
        })
      })

      describe('append 100 items to a log', async () => {
        const amount = 100
        const nextPointerAmount = 64

        let log

        before(async () => {
          log = new Log(ipfs, testIdentity, 'A')
          for (let i = 0; i < amount; i++) {
            await log.append('hello' + i, nextPointerAmount)
            // Make sure the log has the right heads after each append
            const values = log.values
            strictEqual(log.heads.length, 1)
            strictEqual(log.heads[0].hash, values[values.length - 1].hash)
          }
        })

        it('added the correct amount of items', () => {
          strictEqual(log.length, amount)
        })

        it('added the correct values', async () => {
          log.values.forEach((entry, index) => {
            strictEqual(entry.payload, 'hello' + index)
          })
        })

        it('updated the clocks correctly', async () => {
          log.values.forEach((entry, index) => {
            strictEqual(entry.clock.time, index + 1)
            strictEqual(entry.clock.id, testIdentity.publicKey)
          })
        })

        it('added the correct amount of refs pointers', async () => {
          log.values.forEach((entry, index) => {
            strictEqual(entry.refs.length, index > 0 ? Math.ceil(Math.log2(Math.min(nextPointerAmount, index))) : 0)
          })
        })
      })
    })
  })
})
