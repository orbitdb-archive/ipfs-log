'use strict'

const LRU = require('lru-cache')

class EntryIndex {
  constructor (entries = {}, cacheSize = Infinity) {
    this._cache = new LRU({ max: cacheSize })
    this.add(entries)
  }

  set (k, v) {
    this._cache.set(k, v)
  }

  get (k) {
    return this._cache.get(k)
  }

  delete (k) {
    this._cache.del(k)
  }

  add (items) {
    for (const k in items) {
      this._cache.set(k, items[k])
    }
  }

  get length () {
    return this._cache.length
  }
}

module.exports = EntryIndex
