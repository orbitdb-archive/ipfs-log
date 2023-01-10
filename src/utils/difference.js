function difference (a, b, key) {
  // Indices for quick lookups
  const processed = {}
  const existing = {}

  // Create an index of the first collection
  const addToIndex = e => (existing[key ? e[key] : e] = true)
  a.forEach(addToIndex)

  // Reduce to entries that are not in the first collection
  const reducer = (res, entry) => {
    const isInFirst = existing[key ? entry[key] : entry] !== undefined
    const hasBeenProcessed = processed[key ? entry[key] : entry] !== undefined
    if (!isInFirst && !hasBeenProcessed) {
      res.push(entry)
      processed[key ? entry[key] : entry] = true
    }
    return res
  }

  return b.reduce(reducer, [])
}

export default difference
