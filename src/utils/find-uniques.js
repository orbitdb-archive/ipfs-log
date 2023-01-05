function findUniques (value, key) {
  // Create an index of the collection
  const uniques = {}
  const get = e => uniques[e]
  const addToIndex = e => (uniques[key ? e[key] : e] = e)
  value.forEach(addToIndex)
  return Object.keys(uniques).map(get)
}

export default findUniques
