const Keystore = require('orbit-db-keystore')
const IdentityProvider = require('orbit-db-identity-provider')
const leveldown = require('leveldown')
const storage = require('orbit-db-storage-adapter')(leveldown)

const Log = require('../../src/log')
const AccessController = Log.AccessController

let store

const createLog = async (ipfs, logId) => {
  if (!store) {
    const keysPath = (await ipfs.repo.stat()).repoPath + '/keys'
    store = await storage.createStore(keysPath)
  }

  const access = new AccessController()
  const keystore = new Keystore(store)
  const identity = await IdentityProvider.createIdentity({ id: 'userA', keystore })
  const log = new Log(ipfs, identity, { logId: 'A', access, cacheSize: 5 })
  return { log, access, identity }
}

module.exports = createLog
