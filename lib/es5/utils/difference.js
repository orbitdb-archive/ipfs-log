"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
function difference(a, b, key) {
  // Indices for quick lookups
  var processed = {};
  var existing = {};

  // Create an index of the first collection
  var addToIndex = function addToIndex(e) {
    return existing[key ? e[key] : e] = true;
  };
  a.forEach(addToIndex);

  // Reduce to entries that are not in the first collection
  var reducer = function reducer(res, entry) {
    var isInFirst = existing[key ? entry[key] : entry] !== undefined;
    var hasBeenProcessed = processed[key ? entry[key] : entry] !== undefined;
    if (!isInFirst && !hasBeenProcessed) {
      res.push(entry);
      processed[key ? entry[key] : entry] = true;
    }
    return res;
  };
  return b.reduce(reducer, []);
}
var _default = difference;
exports["default"] = _default;