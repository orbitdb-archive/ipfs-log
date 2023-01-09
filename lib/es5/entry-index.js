"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var EntryIndex = /*#__PURE__*/function () {
  function EntryIndex() {
    var entries = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    (0, _classCallCheck2["default"])(this, EntryIndex);
    this._cache = entries;
  }
  (0, _createClass2["default"])(EntryIndex, [{
    key: "set",
    value: function set(k, v) {
      this._cache[k] = v;
    }
  }, {
    key: "get",
    value: function get(k) {
      return this._cache[k];
    }
  }, {
    key: "delete",
    value: function _delete(k) {
      return delete this._cache[k];
    }
  }, {
    key: "add",
    value: function add(newItems) {
      this._cache = Object.assign(this._cache, newItems);
    }
  }, {
    key: "length",
    get: function get() {
      return Object.values(this._cache).length;
    }
  }]);
  return EntryIndex;
}();
var _default = EntryIndex;
exports["default"] = _default;