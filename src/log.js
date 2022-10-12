'use strict'

const pMap = require('p-map')
const GSet = require('./g-set')
const Entry = require('./entry')
const LogIO = require('./log-io')
const LogError = require('./log-errors')
const Clock = require('./lamport-clock')
const Sorting = require('./log-sorting')
const { LastWriteWins, NoZeroes } = Sorting
const AccessController = require('./default-access-controller')
const { isDefined, findUniques } = require('./utils')
const EntryIndex = require('./entry-index')
const randomId = () => new Date().getTime().toString()
const getHash = e => e.hash
const flatMap = (res, acc) => res.concat(acc)
const getNextPointers = entry => entry.next
const maxClockTimeReducer = (res, acc) => Math.max(res, acc.clock.time)
const uniqueEntriesReducer = (res, acc) => {
  res[acc.hash] = acc
  return res
}

/**
 * @description
 * Log implements a G-Set CRDT and adds ordering.
 *
 * From:
 * "A comprehensive study of Convergent and Commutative Replicated Data Types"
 * https://hal.inria.fr/inria-00555588
 */
class Log extends GSet {
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
   * @param {Map} options.hashIndex A Map of entry hashes to next pointers
   * @return {Log} The log instance
   */
  constructor (ipfs, identity, { logId, access, entries, heads, clock, sortFn, concurrency, hashIndex = new Map(), cacheSize } = {}) {
    if (!isDefined(ipfs)) {
      throw LogError.IPFSNotDefinedError()
    }

    if (!isDefined(identity)) {
      throw new Error('Identity is required')
    }

    if (!isDefined(access)) {
      access = new AccessController()
    }

    if (isDefined(entries) && !Array.isArray(entries)) {
      throw new Error('\'entries\' argument must be an array of Entry instances')
    }

    if (isDefined(heads) && !Array.isArray(heads)) {
      throw new Error('\'heads\' argument must be an array')
    }

    if (!isDefined(sortFn)) {
      sortFn = LastWriteWins
    }

    super()

    this._sortFn = NoZeroes(sortFn)

    this._storage = ipfs
    this._id = logId || randomId()

    // Access Controller
    this._access = access
    // Identity
    this._identity = identity

    // Add entries to the internal cache
    const uniqueEntries = (entries || []).reduce(uniqueEntriesReducer, {})
    this._entryIndex = new EntryIndex(uniqueEntries, cacheSize)
    entries = Object.values(uniqueEntries) || []

    // Set heads if not passed as an argument
    heads = heads || Log.findHeads(entries)
    this._headsIndex = heads.reduce(uniqueEntriesReducer, {})

    // Index of log hashes
    this._hashIndex = hashIndex
    entries.forEach(e => this._hashIndex.set(e.hash, e.next))

    // Index of all next pointers in this log
    this._nextsIndex = {}
    const addToNextsIndex = e => e.next.forEach(a => (this._nextsIndex[a] = e.hash))
    entries.forEach(addToNextsIndex)
    hashIndex.forEach((nexts, hash) => nexts.forEach(a => (this._nextsIndex[a] = hash)))

    // Set the clock
    const maxTime = Math.max(clock ? clock.time : 0, this.heads.reduce(maxClockTimeReducer, 0))
    // Take the given key as the clock id is it's a Key instance,
    // otherwise if key was given, take whatever it is,
    // and if it was null, take the given id as the clock id
    this._clock = new Clock(this._identity.publicKey, maxTime)

    this.joinConcurrency = concurrency || 16
  }

  /**
   * Returns the ID of the log.
   * @returns {string}
   */
  get id () {
    return this._id
  }

  /**
   * Returns the clock of the log.
   * @returns {string}
   */
  get clock () {
    return this._clock
  }

  /**
   * Returns the length of the log.
   * @return {number} Length
   */
  get length () {
    return this._hashIndex.size
  }

  /**
   * Returns the values in the log.
   * @returns {Promise<Array<Entry>>}
   */
  async values () {
    return Object.values(await this.traverse(this.heads)).reverse()
  }

  /**
   * Returns an array of heads as hashes.
   * @returns {Array<string>}
   */
  get heads () {
    return Object.values(this._headsIndex).sort(this._sortFn).reverse()
  }

  /**
   * Returns an array of Entry objects that reference entries which
   * are not in the log currently.
   * @returns {Promise<Array<Entry>>}
   */
  async tails () {
    const values = await this.values()
    return Log.findTails(values)
  }

  /**
   * Returns an array of hashes that are referenced by entries which
   * are not in the log currently.
   * @returns {Promise<Array<string>>} Array of hashes
   */
  async tailHashes () {
    const values = await this.values()
    return Log.findTailHashes(values)
  }

  /**
   * Set the identity for the log
   * @param {Identity} [identity] The identity to be set
   */
  setIdentity (identity) {
    this._identity = identity
    // Find the latest clock from the heads
    const time = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0))
    this._clock = new Clock(this._identity.publicKey, time)
  }

  /**
   * Find an entry.
   * @param {string} [hash] The hashes of the entry
   * @returns {Promise<Entry|undefined>}
   */
  async get (hash) {
    if (!this.has(hash)) {
      return undefined
    }

    const haveCache = this._entryIndex.get(hash)
    if (haveCache) {
      return haveCache
    }

    let entry
    try {
      entry = await Entry.fromMultihash(this._storage, hash)
      this._entryIndex.set(entry.hash, entry)
    } catch (error) {
      // TODO
    }

    return entry
  }

  /**
   * Checks if a entry is part of the log
   * @param {string} hash The hash of the entry
   * @returns {boolean}
   */
  has (entry) {
    return this._hashIndex.has(entry.hash || entry)
  }

  async traverse (rootEntries, amount = -1, endHash) {
    // Sort the given given root entries and use as the starting stack
    let stack = rootEntries.sort(this._sortFn).reverse()

    // Cache for checking if we've processed an entry already
    let traversed = {}
    // End result
    const result = {}
    let count = 0
    // Named function for getting an entry from the log
    const getEntry = async e => this.get(e)

    // Add an entry to the stack and traversed nodes index
    const addToStack = entry => {
      // If we've already processed the entry, don't add it to the stack
      if (!entry || traversed[entry.hash]) {
        return
      }

      // Add the entry in front of the stack and sort
      stack = [entry, ...stack]
        .sort(this._sortFn)
        .reverse()
      // Add to the cache of processed entries
      traversed[entry.hash] = true
    }

    const addEntry = rootEntry => {
      result[rootEntry.hash] = rootEntry
      traversed[rootEntry.hash] = true
      count++
    }

    // Start traversal
    // Process stack until it's empty (traversed the full log)
    // or when we have the requested amount of entries
    // If requested entry amount is -1, traverse all
    while (stack.length > 0 && (count < amount || amount < 0)) { // eslint-disable-line no-unmodified-loop-condition
      // Get the next element from the stack
      const entry = stack.shift()
      // Add to the result
      addEntry(entry)
      // If it is the specified end hash, break out of the while loop
      if (endHash && endHash === entry.hash) break

      // Add entry's next references to the stack
      const entries = await pMap(entry.next, getEntry)
      const defined = entries.filter(isDefined)
      defined.forEach(addToStack)
    }

    stack = []
    traversed = {}
    // End result
    return result
  }

  /**
   * Append an entry to the log.
   * @param {Entry} entry Entry to add
   * @return {Promise<Log>} New Log containing the appended value
   */
  async append (data, pointerCount = 1, pin = false) {
    // Update the clock (find the latest clock)
    const newTime = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0)) + 1
    this._clock = new Clock(this.clock.id, newTime)

    const all = Object.values(await this.traverse(this.heads, Math.max(pointerCount, this.heads.length)))

    // If pointer count is 4, returns 2
    // If pointer count is 8, returns 3 references
    // If pointer count is 512, returns 9 references
    // If pointer count is 2048, returns 11 references
    const getEveryPow2 = (maxDistance) => {
      const entries = new Set()
      for (let i = 1; i <= maxDistance; i *= 2) {
        const index = Math.min(i - 1, all.length - 1)
        entries.add(all[index])
      }
      return entries
    }
    const references = getEveryPow2(Math.min(pointerCount, all.length))

    // Always include the last known reference
    if (all.length < pointerCount && all[all.length - 1]) {
      references.add(all[all.length - 1])
    }

    // Create the next pointers from heads
    const nexts = Object.keys(this.heads.reverse().reduce(uniqueEntriesReducer, {}))
    const isNext = e => !nexts.includes(e)
    // Delete the heads from the refs
    const refs = Array.from(references).map(getHash).filter(isNext)
    // @TODO: Split Entry.create into creating object, checking permission, signing and then posting to IPFS
    // Create the entry and add it to the internal cache
    const entry = await Entry.create(
      this._storage,
      this._identity,
      this.id,
      data,
      nexts,
      this.clock,
      refs,
      pin
    )

    const canAppend = await this._access.canAppend(entry, this._identity.provider)
    if (!canAppend) {
      throw new Error(`Could not append entry, key "${this._identity.id}" is not allowed to write to the log`)
    }

    this._entryIndex.set(entry.hash, entry)
    nexts.forEach(e => (this._nextsIndex[e] = entry.hash))
    this._headsIndex = {}
    this._headsIndex[entry.hash] = entry
    this._hashIndex.set(entry.hash, nexts)
    return entry
  }

  /*
   * Creates a javscript iterator over log entries
   *
   * @param {Object} options
   * @param {string|Array} options.gt Beginning hash of the iterator, non-inclusive
   * @param {string|Array} options.gte Beginning hash of the iterator, inclusive
   * @param {string|Array} options.lt Ending hash of the iterator, non-inclusive
   * @param {string|Array} options.lte Ending hash of the iterator, inclusive
   * @param {amount} options.amount Number of entried to return to / from the gte / lte hash
   * @returns {Symbol.asyncIterator} asyncIterator object containing log entries
   *
   * @examples
   *
   * (async () => {
   *   log1 = new Log(ipfs, testIdentity, { logId: 'X' })
   *
   *   for (let i = 0; i <= 100; i++) {
   *     await log1.append('entry' + i)
   *   }
   *
   *   let it = log1.iterator({
   *     lte: 'zdpuApFd5XAPkCTmSx7qWQmQzvtdJPtx2K5p9to6ytCS79bfk',
   *     amount: 10
   *   })
   *
   *   [...it].length // 10
   * })()
   *
   *
   */
  iterator ({ gt = undefined, gte = undefined, lt = undefined, lte = undefined, amount = -1 } =
  {}) {
    if (amount === 0) return (async function * () {})()
    if (lte && (typeof lte !== 'string' && !Array.isArray(lte))) {
      throw LogError.LtOrLteMustBeStringOrArray()
    }
    if (lt && (typeof lt !== 'string' && !Array.isArray(lt))) {
      throw LogError.LtOrLteMustBeStringOrArray()
    }

    const self = this
    return (async function * () {
      if (typeof lte === 'string') {
        const value = await self.get(lte)
        lte = [value]
      }
      if (typeof lt === 'string') {
        const value = await self.get(lt)
        const next = await self.get(value.next[0])
        lt = [next]
      }

      const start = (lte || (lt || self.heads)).filter(isDefined)
      let endHash = null
      if (gte) {
        const value = await self.get(gte)
        endHash = value.hash
      } else if (gt) {
        const value = await self.get(gt)
        endHash = value.hash
      }
      const count = endHash ? -1 : amount || -1

      const entries = await self.traverse(start, count, endHash)
      let entryValues = Object.values(entries)

      // Strip off last entry if gt is non-inclusive
      if (gt) entryValues.pop()

      // Deal with the amount argument working backwards from gt/gte
      if ((gt || gte) && amount > -1) {
        entryValues = entryValues.slice(entryValues.length - amount, entryValues.length)
      }

      for (const value of entryValues) {
        yield value
      }
    })()
  }

  /**
   * Join two logs.
   *
   * Joins another log into this one.
   *
   * @param {Log} log Log to join with this Log
   * @param {number} [size=-1] Max size of the joined log
   * @returns {Promise<Log>} This Log instance
   * @example
   * await log1.join(log2)
   */
  async join (log, size = -1) {
    if (!isDefined(log)) throw LogError.LogNotDefinedError()
    if (!Log.isLog(log)) throw LogError.NotALogError()
    if (this.id !== log.id) return

    // Get the difference of the logs
    const newItems = await Log.difference(log, this)

    const identityProvider = this._identity.provider
    // Verify if entries are allowed to be added to the log and throws if
    // there's an invalid entry
    const permitted = async (entry) => {
      const canAppend = await this._access.canAppend(entry, identityProvider)
      if (!canAppend) {
        throw new Error(`Could not append entry, key "${entry.identity.id}" is not allowed to write to the log`)
      }
    }

    // Verify signature for each entry and throws if there's an invalid signature
    const verify = async (entry) => {
      const isValid = await Entry.verify(identityProvider, entry)
      const publicKey = entry.identity ? entry.identity.publicKey : entry.key
      if (!isValid) throw new Error(`Could not validate signature "${entry.sig}" for entry "${entry.hash}" and key "${publicKey}"`)
    }

    const entriesToJoin = Object.values(newItems)
    await pMap(entriesToJoin, async e => {
      await permitted(e)
      await verify(e)
    }, { concurrency: this.joinConcurrency })

    // Update internal indexes
    const addToIndexes = e => {
      e.next.forEach(a => (this._nextsIndex[a] = e.hash))
      this._hashIndex.set(e.hash, e.next)
    }
    entriesToJoin.forEach(addToIndexes)

    // Update the internal entry index
    this._entryIndex.add(newItems)

    // Merge the heads
    const notReferencedByNewItems = e => !nextsFromNewItems.find(a => a === e.hash)
    const notInCurrentNexts = e => !this._nextsIndex[e.hash]
    const nextsFromNewItems = Object.values(newItems).map(getNextPointers).reduce(flatMap, [])
    const mergedHeads = Log.findHeads(Object.values(Object.assign({}, this._headsIndex, log._headsIndex)))
      .filter(notReferencedByNewItems)
      .filter(notInCurrentNexts)
      .reduce(uniqueEntriesReducer, {})

    this._headsIndex = mergedHeads

    // Slice to the requested size
    if (size > -1) {
      let tmp = await this.values()
      tmp = tmp.slice(-size)
      this._entryIndex = null
      this._entryIndex = new EntryIndex(tmp.reduce(uniqueEntriesReducer, {}))
      this._hashIndex = new Map()
      tmp.forEach(e => this._hashIndex.set(e.hash, e.next))
      this._nextsIndex = {}
      const addToNextsIndex = e => e.next.forEach(a => (this._nextsIndex[a] = e.hash))
      tmp.forEach(addToNextsIndex)
      this._headsIndex = Log.findHeads(tmp).reduce(uniqueEntriesReducer, {})
    }

    // Find the latest clock from the heads
    const maxClock = Object.values(this._headsIndex).reduce(maxClockTimeReducer, 0)
    this._clock = new Clock(this.clock.id, Math.max(this.clock.time, maxClock))
    return this
  }

  /**
   * Get the log in JSON format.
   * @returns {Object} An object with the id and heads properties
   */
  toJSON () {
    return {
      id: this.id,
      heads: this.heads
        .sort(this._sortFn) // default sorting
        .reverse() // we want the latest as the first element
        .map(getHash) // return only the head hashes
    }
  }

  /**
   * Get the log in JSON format as a snapshot.
   * @returns {Object} An object with the id, heads and value properties
   */
  async toSnapshot () {
    const values = await this.values()
    return {
      id: this.id,
      heads: this.heads,
      values: values
    }
  }

  /**
   * Get the log as a Buffer.
   * @returns {Buffer}
   */
  toBuffer () {
    return Buffer.from(JSON.stringify(this.toJSON()))
  }

  /**
   * Returns the log entries as a formatted string.
   * @returns {string}
   * @example
   * two
   * └─one
   *   └─three
   */
  async toString (payloadMapper) {
    const values = await this.values()
    return values
      .slice()
      .reverse()
      .map((e, idx) => {
        const parents = Entry.findChildren(e, values)
        const len = parents.length
        let padding = new Array(Math.max(len - 1, 0))
        padding = len > 1 ? padding.fill('  ') : padding
        padding = len > 0 ? padding.concat(['└─']) : padding
        /* istanbul ignore next */
        return padding.join('') + (payloadMapper ? payloadMapper(e.payload) : e.payload)
      })
      .join('\n')
  }

  /**
   * Check whether an object is a Log instance.
   * @param {Object} log An object to check
   * @returns {boolean}
   */
  static isLog (log) {
    return log.id !== undefined &&
      log.heads !== undefined
  }

  /**
   * Get the log's multihash.
   * @returns {Promise<string>} Multihash of the Log as Base58 encoded string.
   */
  toMultihash ({ format } = {}) {
    return LogIO.toMultihash(this._storage, this, { format })
  }

  /**
   * Create a log from a hashes.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {string} hash The log hash
   * @param {Object} options
   * @param {AccessController} options.access The access controller instance
   * @param {number} options.length How many items to include in the log
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(hash, entry, parent, depth)} options.onProgressCallback
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @returns {Promise<Log>}
   */
  static async fromMultihash (ipfs, identity, hash,
    { access, length = -1, exclude = [], shouldExclude, timeout, concurrency, sortFn, onProgressCallback } = {}) {
    // TODO: need to verify the entries with 'key'
    const { logId, entries, heads } = await LogIO.fromMultihash(ipfs, hash,
      { length, exclude, shouldExclude, timeout, onProgressCallback, concurrency, sortFn })
    return new Log(ipfs, identity, { logId, access, entries, heads, sortFn })
  }

  /**
   * Create a log from a single entry's hash.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {string} hash The entry's hash
   * @param {Object} options
   * @param {string} options.logId The ID of the log
   * @param {AccessController} options.access The access controller instance
   * @param {number} options.length How many entries to include in the log
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(hash, entry, parent, depth)} options.onProgressCallback
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @return {Promise<Log>} New Log
   */
  static async fromEntryHash (ipfs, identity, hash,
    { logId, access, length = -1, exclude = [], shouldExclude, timeout, concurrency, sortFn, onProgressCallback } = {}) {
    // TODO: need to verify the entries with 'key'
    const { entries } = await LogIO.fromEntryHash(ipfs, hash,
      { length, exclude, shouldExclude, timeout, concurrency, onProgressCallback })
    return new Log(ipfs, identity, { logId, access, entries, sortFn })
  }

  /**
   * Create a log from a Log Snapshot JSON.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {Object} json Log snapshot as JSON object
   * @param {Object} options
   * @param {AccessController} options.access The access controller instance
   * @param {number} options.length How many entries to include in the log
   * @param {function(hash, entry, parent, depth)} [options.onProgressCallback]
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @return {Promise<Log>} New Log
   */
  static async fromJSON (ipfs, identity, json,
    { access, length = -1, timeout, sortFn, onProgressCallback } = {}) {
    // TODO: need to verify the entries with 'key'
    const { logId, entries } = await LogIO.fromJSON(ipfs, json,
      { length, timeout, onProgressCallback })
    return new Log(ipfs, identity, { logId, access, entries, sortFn })
  }

  /**
   * Create a new log from an Entry instance.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {Entry|Array<Entry>} sourceEntries An Entry or an array of entries to fetch a log from
   * @param {Object} options
   * @param {AccessController} options.access The access controller instance
   * @param {number} options.length How many entries to include. Default: infinite.
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(hash, entry, parent, depth)} [options.onProgressCallback]
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @return {Promise<Log>} New Log
   */
  static async fromEntry (ipfs, identity, sourceEntries,
    { access, length = -1, exclude = [], timeout, concurrency, sortFn, onProgressCallback } = {}) {
    // TODO: need to verify the entries with 'key'
    const { logId, entries } = await LogIO.fromEntry(ipfs, sourceEntries,
      { length, exclude, timeout, concurrency, onProgressCallback })
    return new Log(ipfs, identity, { logId, access, entries, sortFn })
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
  static findHeads (entries) {
    const indexReducer = (res, entry, idx, arr) => {
      const addToResult = e => (res[e] = entry.hash)
      entry.next.forEach(addToResult)
      return res
    }

    const items = entries.reduce(indexReducer, {})

    const exists = e => items[e.hash] === undefined
    const compareIds = (a, b) => a.clock.id > b.clock.id

    return entries.filter(exists).sort(compareIds)
  }

  // Find entries that point to another entry that is not in the
  // input array
  static findTails (entries) {
    // Reverse index { next -> entry }
    const reverseIndex = {}
    // Null index containing entries that have no parents (nexts)
    const nullIndex = []
    // Hashes for all entries for quick lookups
    const hashes = {}
    // Hashes of all next entries
    let nexts = []

    const addToIndex = (e) => {
      if (e.next.length === 0) {
        nullIndex.push(e)
      }
      const addToReverseIndex = (a) => {
        /* istanbul ignore else */
        if (!reverseIndex[a]) reverseIndex[a] = []
        reverseIndex[a].push(e)
      }

      // Add all entries and their parents to the reverse index
      e.next.forEach(addToReverseIndex)
      // Get all next references
      nexts = nexts.concat(e.next)
      // Get the hashes of input entries
      hashes[e.hash] = true
    }

    // Create our indices
    entries.forEach(addToIndex)

    const addUniques = (res, entries, idx, arr) => res.concat(findUniques(entries, 'hash'))
    const exists = e => hashes[e] === undefined
    const findFromReverseIndex = e => reverseIndex[e]

    // Drop hashes that are not in the input entries
    const tails = nexts // For every hash in nexts:
      .filter(exists) // Remove undefineds and nulls
      .map(findFromReverseIndex) // Get the Entry from the reverse index
      .reduce(addUniques, []) // Flatten the result and take only uniques
      .concat(nullIndex) // Combine with tails the have no next refs (ie. first-in-their-chain)

    return findUniques(tails, 'hash').sort(Entry.compare)
  }

  // Find the hashes to entries that are not in a collection
  // but referenced by other entries
  static findTailHashes (entries) {
    const hashes = {}
    const addToIndex = e => (hashes[e.hash] = true)
    const reduceTailHashes = (res, entry, idx, arr) => {
      const addToResult = (e) => {
        /* istanbul ignore else */
        if (hashes[e] === undefined) {
          res.splice(0, 0, e)
        }
      }
      entry.next.reverse().forEach(addToResult)
      return res
    }

    entries.forEach(addToIndex)
    return entries.reduce(reduceTailHashes, [])
  }

  static async difference (a, b) {
    const res = {}
    const hashesFromA = Array.from(a._hashIndex.keys())
    const diff = hashesFromA.filter(hash => !b.has(hash))
    const entries = await pMap(diff, hash => a.get(hash))
    entries.forEach(e => { res[e.hash] = e })
    return res
  }
}

Log.Entry = Entry

module.exports = Log
module.exports.Sorting = Sorting
module.exports.Entry = Entry
module.exports.AccessController = AccessController
