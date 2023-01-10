/**
 * Interface for G-Set CRDT
 *
 * From:
 * "A comprehensive study of Convergent and Commutative Replicated Data Types"
 * https://hal.inria.fr/inria-00555588
 */
class GSet {
  constructor (values) {} // eslint-disable-line
  append (value) {}
  merge (set) {}
  get (value) {}
  has (value) {}
  get values () {}
  get length () {}
}

export default GSet
