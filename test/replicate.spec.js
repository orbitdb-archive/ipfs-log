import { strictEqual } from 'assert'
import rimraf from 'rimraf'
import { copy } from 'fs-extra'
import Log from '../src/log.js'
import IdentityProvider from 'orbit-db-identity-provider'
import Keystore from 'orbit-db-keystore'

// Test utils
import { config, testAPIs, startIpfs, stopIpfs, getIpfsPeerId, waitForPeers, connectPeers } from 'orbit-db-test-utils'

const { sync } = rimraf
const { fromMultihash } = Log
const { createIdentity } = IdentityProvider

Object.keys(testAPIs).forEach((IPFS) => {
  describe('ipfs-log - Replication (' + IPFS + ')', function () {
    this.timeout(config.timeout * 2)

    let ipfsd1, ipfsd2, ipfs1, ipfs2, id1, id2, testIdentity, testIdentity2

    const { identityKeyFixtures, signingKeyFixtures, identityKeysPath, signingKeysPath } = config

    let keystore, signingKeystore

    before(async () => {
      sync(identityKeysPath)
      sync(signingKeysPath)
      await copy(identityKeyFixtures, identityKeysPath)
      await copy(signingKeyFixtures, signingKeysPath)

      // Start two IPFS instances
      ipfsd1 = await startIpfs(IPFS, config.daemon1)
      ipfsd2 = await startIpfs(IPFS, config.daemon2)
      ipfs1 = ipfsd1.api
      ipfs2 = ipfsd2.api

      await connectPeers(ipfs1, ipfs2)

      // Get the peer IDs
      id1 = await getIpfsPeerId(ipfs1)
      id2 = await getIpfsPeerId(ipfs2)

      keystore = new Keystore(identityKeysPath)
      signingKeystore = new Keystore(signingKeysPath)

      // Create an identity for each peers
      testIdentity = await createIdentity({ id: 'userB', keystore, signingKeystore })
      testIdentity2 = await createIdentity({ id: 'userA', keystore, signingKeystore })
    })

    after(async () => {
      await stopIpfs(ipfsd1)
      await stopIpfs(ipfsd2)
      sync(identityKeysPath)
      sync(signingKeysPath)

      await keystore.close()
      await signingKeystore.close()
    })

    describe('replicates logs deterministically', function () {
      const amount = 128 + 1
      const channel = 'XXX'
      const logId = 'A'

      let log1, log2, input1, input2
      const buffer1 = []
      const buffer2 = []
      let processing = 0

      const handleMessage = async (message) => {
        if (id1.toString() === message.from.toString()) {
          return
        }
        const hash = Buffer.from(message.data).toString()
        buffer1.push(hash)
        processing++
        process.stdout.write('\r')
        process.stdout.write(`> Buffer1: ${buffer1.length} - Buffer2: ${buffer2.length}`)
        const log = await fromMultihash(ipfs1, testIdentity, hash)
        await log1.join(log)
        processing--
      }

      const handleMessage2 = async (message) => {
        if (id2.toString() === message.from.toString()) {
          return
        }
        const hash = Buffer.from(message.data).toString()
        buffer2.push(hash)
        processing++
        process.stdout.write('\r')
        process.stdout.write(`> Buffer1: ${buffer1.length} - Buffer2: ${buffer2.length}`)
        const log = await fromMultihash(ipfs2, testIdentity2, hash)
        await log2.join(log)
        processing--
      }

      beforeEach(async () => {
        log1 = new Log(ipfs1, testIdentity, { logId })
        log2 = new Log(ipfs2, testIdentity2, { logId })
        input1 = new Log(ipfs1, testIdentity, { logId })
        input2 = new Log(ipfs2, testIdentity2, { logId })
        await ipfs1.pubsub.subscribe(channel, handleMessage)
        await ipfs2.pubsub.subscribe(channel, handleMessage2)
      })

      afterEach(async () => {
        await ipfs1.pubsub.unsubscribe(channel, handleMessage)
        await ipfs2.pubsub.unsubscribe(channel, handleMessage2)
      })

      it('replicates logs', async () => {
        await waitForPeers(ipfs1, [id2], channel)

        for (let i = 1; i <= amount; i++) {
          await input1.append('A' + i)
          await input2.append('B' + i)
          const hash1 = await input1.toMultihash()
          const hash2 = await input2.toMultihash()
          await ipfs1.pubsub.publish(channel, Buffer.from(hash1))
          await ipfs2.pubsub.publish(channel, Buffer.from(hash2))
        }

        console.log('\nAll messages sent')

        const whileProcessingMessages = (timeoutMs) => {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs)
            const timer = setInterval(() => {
              if (buffer1.length + buffer2.length === amount * 2 &&
                  processing === 0) {
                console.log('\nAll messages received')
                clearInterval(timer)
                clearTimeout(timeout)
                resolve()
              }
            }, 200)
          })
        }

        console.log('Waiting for all to process')
        await whileProcessingMessages(config.timeout * 2)

        const result = new Log(ipfs1, testIdentity, { logId })
        await result.join(log1)
        await result.join(log2)

        strictEqual(buffer1.length, amount)
        strictEqual(buffer2.length, amount)
        strictEqual(result.length, amount * 2)
        strictEqual(log1.length, amount)
        strictEqual(log2.length, amount)
        strictEqual(result.values[0].payload, 'A1')
        strictEqual(result.values[1].payload, 'B1')
        strictEqual(result.values[2].payload, 'A2')
        strictEqual(result.values[3].payload, 'B2')
        strictEqual(result.values[99].payload, 'B50')
        strictEqual(result.values[100].payload, 'A51')
        strictEqual(result.values[198].payload, 'A100')
        strictEqual(result.values[199].payload, 'B100')
      })
    })
  })
})
