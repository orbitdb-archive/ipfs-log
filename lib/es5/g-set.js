"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
/**
 * Interface for G-Set CRDT
 *
 * From:
 * "A comprehensive study of Convergent and Commutative Replicated Data Types"
 * https://hal.inria.fr/inria-00555588
 */
var GSet = /*#__PURE__*/function () {
  function GSet(values) {
    (0, _classCallCheck2["default"])(this, GSet);
  } // eslint-disable-line
  (0, _createClass2["default"])(GSet, [{
    key: "append",
    value: function append(value) {}
  }, {
    key: "merge",
    value: function merge(set) {}
  }, {
    key: "get",
    value: function get(value) {}
  }, {
    key: "has",
    value: function has(value) {}
  }, {
    key: "values",
    get: function get() {}
  }, {
    key: "length",
    get: function get() {}
  }]);
  return GSet;
}();
var _default = GSet;
exports["default"] = _default;