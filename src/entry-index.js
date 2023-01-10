class EntryIndex {
  constructor (entries = {}) {
    this._cache = entries
  }

  set (k, v) {
    this._cache[k] = v
  }

  get (k) {
    return this._cache[k]
  }

  delete (k) {
    return delete this._cache[k]
  }

  add (newItems) {
    this._cache = Object.assign(this._cache, newItems)
  }

  get length () {
    return Object.values(this._cache).length
  }
}

export default EntryIndex
