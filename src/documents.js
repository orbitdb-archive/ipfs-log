const DocumentStore = async ({ OpLog, Database, ipfs, identity, databaseId, accessController, storage, indexBy = '_id' }) => {
  const database = await Database({ OpLog, ipfs, identity, databaseId, accessController, storage })

  const { addOperation, log } = database

  /**
   * Stores a document to the store.
   *
   * @param {Object} doc An object representing a key/value list of fields.
   * @returns {string} The hash of the new oplog entry.
   */
  const put = async (doc) => {
    const key = doc[indexBy]

    if (!key) { throw new Error(`The provided document doesn't contain field '${indexBy}'`) }

    return addOperation({ op: 'PUT', key, value: doc })
  }

  /**
   * Deletes a document from the store.
   *
   * @param {string} key The key of the doc to delete.
   * @returns {string} The hash of the new oplog entry.
   */
  const del = async (key) => {
    if (!await get(key)) { throw new Error(`No document with key '${key}' in the database`) }

    return addOperation({ op: 'DEL', key, value: null })
  }

  /**
   * Gets a document from the store by key.
   *
   * @param {string} key The key of the doc to get.
   * @returns {Object} The doc corresponding to key or null.
   */
  const get = async (key) => {
    for await (const doc of iterator()) {
      if (key === doc[indexBy]) {
        return doc
      }
    }
  }

  /**
   * Queries the document store for documents matching mapper filters.
   *
   * @param {function(Object)} findFn A function for querying for specific results.
   * @returns {Array} Found documents.
   */
  const query = async (findFn) => {
    const results = []

    for await (const doc of iterator()) {
      if (findFn(doc)) {
        results.push(doc)
      }
    }

    return results
  }

  const iterator = async function * () {
    const keys = {}
    for await (const entry of log.traverse()) {
      const { op, key, value } = entry.payload
      if (op === 'PUT' && !keys[key]) {
        keys[key] = true
        yield value
      } else if (op === 'DEL' && !keys[key]) {
        keys[key] = true
      }
    }
  }

  return {
    ...database,
    type: 'documents',
    put,
    del,
    get,
    iterator,
    query
  }
}

export default DocumentStore