import Entry from './entry.js'
import Clock from './lamport-clock.js'
import Sorting from './log-sorting.js'
import AccessController from './default-access-controller.js'
import { isDefined } from './utils/index.js'
import LRU from 'lru'
import IPFSBlockStorage from './ipfs-block-storage.js'
import MemoryStorage from './memory-storage.js'
import LRUStorage from './lru-storage.js'
import LevelStorage from './level-storage.js'

const { LastWriteWins, NoZeroes } = Sorting

const randomId = () => new Date().getTime().toString()
const maxClockTimeReducer = (res, acc) => Math.max(res, acc.clock.time)

// Default storage for storing the Log. Default: In Memory. Options: Memory, LRU, IPFS,
const defaultStorage = MemoryStorage()
// const defaultStorage =  LevelStorage()
// const defaultStorage = IPFSBlockStorage(null, { ipfs, timeout, pin: true })
// const defaultStorage = MemoryStorage(IPFSBlockStorage(null, { ipfs, timeout, pin: true }))
// const defaultStorage = LRUStorage()

/**
 * @description
 * Log is a verifiable, append-only log CRDT.
 *
 * Implemented as a Merkle-CRDT as per the paper:
 * "Merkle-CRDTs: Merkle-DAGs meet CRDTs"
 * https://arxiv.org/abs/2004.00107
 */

/**
 * Create a new Log instance
 * @param {IPFS} ipfs An IPFS instance
 * @param {Object} identity Identity (https://github.com/orbitdb/orbit-db-identity-provider/blob/master/src/identity.js)
 * @param {Object} options
 * @param {string} options.logId ID of the log
 * @param {Object} options.access AccessController (./default-access-controller)
 * @param {Array<Entry>} options.entries An Array of Entries from which to create the log
 * @param {Array<Entry>} options.heads Set the heads of the log
 * @param {Clock} options.clock Set the clock of the log
 * @param {Function} options.sortFn The sort function - by default LastWriteWins
 * @return {Log} The log instance
 */
const Log = (identity, { logId, logHeads, access, storage, sortFn } = {}) => {
  if (!isDefined(identity)) {
    throw new Error('Identity is required')
  }
  if (isDefined(logHeads) && !Array.isArray(logHeads)) {
    throw new Error('\'logHeads\' argument must be an array')
  }
  // Set Log's id
  const id = logId || randomId()
  // Set heads
  // TODO: need to be a LevelStorage()
  logHeads = Array.from(new Set(logHeads || []))
  // Access Controller
  access = access || new AccessController()
  // Oplog entry storage
  storage = storage || defaultStorage
  // Conflict-resolution sorting function
  sortFn = NoZeroes(sortFn || LastWriteWins)

  /**
   * Returns an array of entries
   * @returns {Array<Entry>}
   */
  const heads = () => {
    return logHeads.slice().sort(sortFn).reverse()
  }

  /**
   * Returns the clock of the log.
   * @returns {LamportClock}
   */
  const clock = () => {
    // Find the latest clock from the heads
    const maxTime = Math.max(0, heads().reduce(maxClockTimeReducer, 0))
    return new Clock(identity.publicKey, maxTime)
  }

  /**
   * Returns the values in the log.
   * @returns {Promise<Array<Entry>>}
   */
  const values = async () => {
    const values = []
    for await (const entry of traverse()) {
      values.unshift(entry)
    }
    return values
  }

  /**
   * Retrieve an entry.
   * @param {string} [hash] The hash of the entry to retrieve
   * @returns {Promise<Entry|undefined>}
   */
  const get = async (hash) => {
    return storage.get(hash).then(Entry.decode)
  }

  /**
   * Append an new entry to the log.
   * @param {data} data Payload to add to the entry
   * @return {Promise<Entry>} Entry that was appended
   */
  const append = async (data, options = { pointerCount: 1 }) => {
    // Get references (entry at every pow2 of distance)
    const refs = await getReferences(options.pointerCount)
    // Create the next pointers from heads
    const nexts = heads().map(entry => entry.hash)
    // Create the entry
    const entry = await Entry.create(
      identity,
      id,
      data,
      clock().tick(),
      nexts,
      refs
    )
    // Authorize the entry
    const canAppend = await access.canAppend(entry, identity.provider)
    if (!canAppend) {
      throw new Error(`Could not append entry:\nKey "${identity.id}" is not allowed to write to the log`)
    }
    // The appended entry is now the latest head
    logHeads = [entry]
    // Add entry to the storage
    await storage.add(entry.hash, entry.bytes)
    // Return the appended entry
    return entry
  }

  /**
   * Join two logs.
   *
   * Joins another log into this one.
   *
   * @param {Log} log Log to join with this Log
   * @returns {Promise<Log>} This Log instance
   * @example
   * await log1.join(log2)
   */
  const join = async (log) => {
    if (!log) {
      throw new Error('Log instance not defined')
    }
    if (!isLog(log)) {
      throw new Error('Given argument is not an instance of Log')
    }
    for (const entry of log.heads()) {
      await joinEntry(entry)
    }
    await storage.merge(log.storage)
  }

  /**
   * Join an entry into a log.
   *
   * @param {Entry} entry Entry to join with this Log
   * @returns {Promise<Log>} This Log instance
   * @example
   * await log.join(entry)
   */
  const joinEntry = async (entry) => {
    const identityProvider = identity.provider
    // Check that the Entry belongs to this Log
    if (entry.id !== id) {
      throw new Error(`Entry's id (${entry.id}) doesn't match the log's id (${id}).`)
    }
    // Verify if entry is allowed to be added to the log
    const canAppend = await access.canAppend(entry, identityProvider)
    if (!canAppend) {
      throw new Error(`Could not append entry:\nKey "${entry.identity.id}" is not allowed to write to the log`)
    }
    // Verify signature for the entry
    const isValid = await Entry.verify(identityProvider, entry)
    if (!isValid) {
      throw new Error(`Could not validate signature for entry "${entry.hash}"`)
    }
    // Find the new heads
    logHeads = findHeads(Array.from(new Set([...heads(), entry])))
    // Add new entry to storage
    await storage.add(entry.hash, entry.bytes)
  }

  /**
   * TODO
   */
  const traverse = async function * (rootEntries, shouldStopFn) {
    // By default, we don't stop traversal and traverse
    // until the end of the log
    const defaultStopFn = () => false
    shouldStopFn = shouldStopFn || defaultStopFn
    // Start traversal from given entries or from current heads
    rootEntries = rootEntries || heads()
    // Sort the given given root entries and use as the starting stack
    let stack = rootEntries.sort(sortFn)
    // Keep a record of all the hashes of entries we've traversed and yielded
    const traversed = {}
    // Current entry during traversal
    let entry
    // Start traversal
    while (stack.length > 0) {
      // Process stack until it's empty (traversed the full log)
      // or until shouldStopFn returns true
      const done = await shouldStopFn(entry)
      if (done === true) {
        break
      }
      // Get the next entry from the stack
      entry = stack.pop()
      if (entry) {
        // Yield the current entry
        yield entry
        // Add hashes of next entries to the stack from entry's
        // causal connection (next) and references to history (refs)
        for (const hash of [...entry.next, ...entry.refs]) {
          // Check if we've already traversed this entry
          if (!traversed[hash]) {
            // Add to the hashes we've traversed
            traversed[hash] = true
            // Fetch the next entry
            const next = await get(hash)
            if (next) {
              // Add the next entry in front of the stack and sort
              stack = [next, ...stack].sort(sortFn)
            }
          }
        }
      }
    }
  }

  /*
   * Async iterator over the log entries
   *
   * @param {Object} options
   * @param {amount} options.amount Number of entried to return
   * @param {string|Array} options.gt Beginning hash of the iterator, non-inclusive
   * @param {string|Array} options.gte Beginning hash of the iterator, inclusive
   * @param {string|Array} options.lt Ending hash of the iterator, non-inclusive
   * @param {string|Array} options.lte Ending hash of the iterator, inclusive
   * @returns {Symbol.asyncIterator} Iterator object of log entries
   *
   * @examples
   *
   * (async () => {
   *   log = Log(testIdentity, { logId: 'X' })
   *
   *   for (let i = 0; i <= 100; i++) {
   *     await log.append('entry' + i)
   *   }
   *
   *   let it = log.iterator({
   *     lte: 'zdpuApFd5XAPkCTmSx7qWQmQzvtdJPtx2K5p9to6ytCS79bfk',
   *     amount: 10
   *   })
   *
   *   for await (let entry of it) {
   *     console.log(entry.payload) // 'entry100', 'entry99', ..., 'entry91'
   *   }
   * })()
   *
   *
   */
  const iterator = async function * ({ amount = -1, gt, gte, lt, lte }) {
    // TODO: write comments on how the iterator algorithm works

    if (amount === 0) {
      return
    }

    if (typeof lte === 'string') {
      lte = [await get(lte)]
    }

    if (typeof lt === 'string') {
      const entry = await get(lt)
      const nexts = await Promise.all(entry.next.map(n => get(n)))
      lt = nexts
    }

    if (isDefined(lt) && !Array.isArray(lt)) throw new Error('lt must be a string or an array of Entries')
    if (isDefined(lte) && !Array.isArray(lte)) throw new Error('lte must be a string or an array of Entries')

    const start = (lt || (lte || heads())).filter(isDefined)
    const end = (gt || gte) ? await get(gt || gte) : null

    const amountToIterate = end || amount === -1
      ? -1
      : (lte || lt ? amount - 1 : amount)

    let count = 0
    const shouldStopTraversal = async (entry) => {
      if (!entry) {
        return false
      }
      if (count >= amountToIterate && amountToIterate !== -1) {
        return true
      }
      if (end && Entry.isEqual(entry, end)) {
        return true
      }
      count++
      return false
    }

    const useBuffer = end && amount !== -1 && !lt && !lte
    const buffer = useBuffer ? new LRU(amount + 2) : null
    let index = 0

    const it = traverse(start, shouldStopTraversal)

    for await (const entry of it) {
      const skipFirst = (lt && Entry.isEqual(entry, start))
      const skipLast = (gt && Entry.isEqual(entry, end))
      const skip = skipFirst || skipLast
      if (!skip) {
        if (useBuffer) {
          buffer.set(index++, entry.hash)
        } else {
          yield entry
        }
      }
    }

    if (useBuffer) {
      const endIndex = buffer.keys.length - 1
      const startIndex = endIndex - amount
      const keys = buffer.keys.slice(startIndex, endIndex)
      for (const key of keys) {
        const hash = buffer.get(key)
        const entry = await get(hash)
        yield entry
      }
    }
  }

  /**
   * Find heads from a collection of entries.
   *
   * Finds entries that are the heads of this collection,
   * ie. entries that are not referenced by other entries.
   *
   * @param {Array<Entry>} entries Entries to search heads from
   * @returns {Array<Entry>}
   */
  const findHeads = (entries) => {
    const items = {}
    for (const entry of entries) {
      for (const next of entry.next) {
        items[next] = entry.hash
      }
    }

    const res = []
    for (const entry of entries) {
      if (!items[entry.hash]) {
        res.push(entry)
      }
    }

    return res
  }

  /**
   * TODO
   * Get references at every pow2 distance
   * If pointer count is 4, returns 2
   * If pointer count is 8, returns 3 references
   * If pointer count is 512, returns 9 references
   * If pointer count is 2048, returns 11 references
   */
  const getReferences = async (pointerCount = 1) => {
    let nextPointerDistance = 2
    let distance = 0
    const refs = []
    const shouldStopFn = () => distance >= pointerCount
    for await (const entry of traverse(null, shouldStopFn)) {
      distance++
      if (distance === nextPointerDistance) {
        if (entry.hash) {
          refs.push(entry.hash)
        }
        nextPointerDistance *= 2
      }
    }
    return refs
  }

  /**
   * Check if an object is a Log.
   * @param {Log} obj
   * @returns {boolean}
   */
  const isLog = (obj) => {
    return obj && obj.id !== undefined &&
      obj.clock !== undefined &&
      obj.heads !== undefined &&
      obj.values !== undefined &&
      obj.access !== undefined &&
      obj.identity !== undefined &&
      obj.storage !== undefined
  }

  return {
    id,
    clock,
    heads,
    values,
    access,
    identity,
    storage,
    get,
    append,
    join,
    joinEntry,
    traverse,
    iterator
  }
}

export { Log }
export { Sorting }
export { Entry }
export { AccessController }
export { IPFSBlockStorage, MemoryStorage, LRUStorage, LevelStorage }
