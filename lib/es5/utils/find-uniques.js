"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
function findUniques(value, key) {
  // Create an index of the collection
  var uniques = {};
  var get = function get(e) {
    return uniques[e];
  };
  var addToIndex = function addToIndex(e) {
    return uniques[key ? e[key] : e] = e;
  };
  value.forEach(addToIndex);
  return Object.keys(uniques).map(get);
}
var _default = findUniques;
exports["default"] = _default;