'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var LRU = require('lru-cache');

var EntryIndex = /*#__PURE__*/function () {
  function EntryIndex() {
    var entries = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var cacheSize = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Infinity;
    (0, _classCallCheck2["default"])(this, EntryIndex);
    this._cache = new LRU({
      max: cacheSize
    });
    this.add(entries);
  }

  (0, _createClass2["default"])(EntryIndex, [{
    key: "set",
    value: function set(k, v) {
      this._cache.set(k, v);
    }
  }, {
    key: "get",
    value: function get(k) {
      return this._cache.get(k);
    }
  }, {
    key: "delete",
    value: function _delete(k) {
      this._cache.del(k);
    }
  }, {
    key: "add",
    value: function add(items) {
      for (var k in items) {
        this._cache.set(k, items[k]);
      }
    }
  }, {
    key: "length",
    get: function get() {
      return this._cache.length;
    }
  }]);
  return EntryIndex;
}();

module.exports = EntryIndex;