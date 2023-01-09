"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getWriteFormat = exports["default"] = exports.IPLD_LINKS = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var _lamportClock = _interopRequireDefault(require("./lamport-clock.js"));
var _index = require("./utils/index.js");
var _jsonStringifyDeterministic = _interopRequireDefault(require("json-stringify-deterministic"));
var IpfsNotDefinedError = function IpfsNotDefinedError() {
  return new Error('Ipfs instance not defined');
};
var IPLD_LINKS = ['next', 'refs'];
exports.IPLD_LINKS = IPLD_LINKS;
var getWriteFormatForVersion = function getWriteFormatForVersion(v) {
  return v === 0 ? 'dag-pb' : 'dag-cbor';
};
var getWriteFormat = function getWriteFormat(e) {
  return Entry.isEntry(e) ? getWriteFormatForVersion(e.v) : getWriteFormatForVersion(e);
};

/*
 * @description
 * An ipfs-log entry
 */
exports.getWriteFormat = getWriteFormat;
var Entry = /*#__PURE__*/function () {
  function Entry() {
    (0, _classCallCheck2["default"])(this, Entry);
  }
  (0, _createClass2["default"])(Entry, null, [{
    key: "create",
    value:
    /**
     * Create an Entry
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {string} logId The unique identifier for this log
     * @param {*} data Data of the entry to be added. Can be any JSON.stringifyable data
     * @param {Array<string|Entry>} [next=[]] Parent hashes or entries
     * @param {LamportClock} [clock] The lamport clock
     * @returns {Promise<Entry>}
     * @example
     * const entry = await Entry.create(ipfs, identity, 'hello')
     * console.log(entry)
     * // { hash: null, payload: "hello", next: [] }
     */
    function () {
      var _create = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(ipfs, identity, logId, data) {
        var next,
          clock,
          refs,
          pin,
          toEntry,
          nexts,
          entry,
          signature,
          _args = arguments;
        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              next = _args.length > 4 && _args[4] !== undefined ? _args[4] : [];
              clock = _args.length > 5 ? _args[5] : undefined;
              refs = _args.length > 6 && _args[6] !== undefined ? _args[6] : [];
              pin = _args.length > 7 ? _args[7] : undefined;
              if ((0, _index.isDefined)(ipfs)) {
                _context.next = 6;
                break;
              }
              throw IpfsNotDefinedError();
            case 6:
              if ((0, _index.isDefined)(identity)) {
                _context.next = 8;
                break;
              }
              throw new Error('Identity is required, cannot create entry');
            case 8:
              if ((0, _index.isDefined)(logId)) {
                _context.next = 10;
                break;
              }
              throw new Error('Entry requires an id');
            case 10:
              if ((0, _index.isDefined)(data)) {
                _context.next = 12;
                break;
              }
              throw new Error('Entry requires data');
            case 12:
              if (!(!(0, _index.isDefined)(next) || !Array.isArray(next))) {
                _context.next = 14;
                break;
              }
              throw new Error("'next' argument is not an array");
            case 14:
              // Clean the next objects and convert to hashes
              toEntry = function toEntry(e) {
                return e.hash ? e.hash : e;
              };
              nexts = next.filter(_index.isDefined).map(toEntry);
              entry = {
                hash: null,
                // "zd...Foo", we'll set the hash after persisting the entry
                id: logId,
                // For determining a unique chain
                payload: data,
                // Can be any JSON.stringifyable data
                next: nexts,
                // Array of hashes
                refs: refs,
                v: 2,
                // To tag the version of this data structure
                clock: clock || new _lamportClock["default"](identity.publicKey)
              };
              _context.next = 19;
              return identity.provider.sign(identity, Entry.toBuffer(entry));
            case 19:
              signature = _context.sent;
              entry.key = identity.publicKey;
              entry.identity = identity.toJSON();
              entry.sig = signature;
              _context.next = 25;
              return Entry.toMultihash(ipfs, entry, pin);
            case 25:
              entry.hash = _context.sent;
              return _context.abrupt("return", entry);
            case 27:
            case "end":
              return _context.stop();
          }
        }, _callee);
      }));
      function create(_x, _x2, _x3, _x4) {
        return _create.apply(this, arguments);
      }
      return create;
    }()
    /**
     * Verifies an entry signature.
     *
     * @param {IdentityProvider} identityProvider The identity provider to use
     * @param {Entry} entry The entry being verified
     * @return {Promise} A promise that resolves to a boolean value indicating if the signature is valid
     */
  }, {
    key: "verify",
    value: function () {
      var _verify = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2(identityProvider, entry) {
        var e, verifier;
        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              if (identityProvider) {
                _context2.next = 2;
                break;
              }
              throw new Error('Identity-provider is required, cannot verify entry');
            case 2:
              if (Entry.isEntry(entry)) {
                _context2.next = 4;
                break;
              }
              throw new Error('Invalid Log entry');
            case 4:
              if (entry.key) {
                _context2.next = 6;
                break;
              }
              throw new Error("Entry doesn't have a key");
            case 6:
              if (entry.sig) {
                _context2.next = 8;
                break;
              }
              throw new Error("Entry doesn't have a signature");
            case 8:
              e = Entry.toEntry(entry, {
                presigned: true
              });
              verifier = entry.v < 1 ? 'v0' : 'v1';
              return _context2.abrupt("return", identityProvider.verify(entry.sig, entry.key, Entry.toBuffer(e), verifier));
            case 11:
            case "end":
              return _context2.stop();
          }
        }, _callee2);
      }));
      function verify(_x5, _x6) {
        return _verify.apply(this, arguments);
      }
      return verify;
    }()
    /**
     * Transforms an entry into a Buffer.
     * @param {Entry} entry The entry
     * @return {Buffer} The buffer
     */
  }, {
    key: "toBuffer",
    value: function toBuffer(entry) {
      var stringifiedEntry = entry.v === 0 ? JSON.stringify(entry) : (0, _jsonStringifyDeterministic["default"])(entry);
      return Buffer.from(stringifiedEntry);
    }

    /**
     * Get the multihash of an Entry.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Entry} entry Entry to get a multihash for
     * @returns {Promise<string>}
     * @example
     * const multihash = await Entry.toMultihash(ipfs, entry)
     * console.log(multihash)
     * // "Qm...Foo"
     * @deprecated
     */
  }, {
    key: "toMultihash",
    value: function () {
      var _toMultihash = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3(ipfs, entry) {
        var pin,
          e,
          _args3 = arguments;
        return _regenerator["default"].wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              pin = _args3.length > 2 && _args3[2] !== undefined ? _args3[2] : false;
              if (ipfs) {
                _context3.next = 3;
                break;
              }
              throw IpfsNotDefinedError();
            case 3:
              if (Entry.isEntry(entry)) {
                _context3.next = 5;
                break;
              }
              throw new Error('Invalid object format, cannot generate entry hash');
            case 5:
              // // Ensure `entry` follows the correct format
              e = Entry.toEntry(entry);
              return _context3.abrupt("return", _index.io.write(ipfs, getWriteFormat(e.v), e, {
                links: IPLD_LINKS,
                pin: pin
              }));
            case 7:
            case "end":
              return _context3.stop();
          }
        }, _callee3);
      }));
      function toMultihash(_x7, _x8) {
        return _toMultihash.apply(this, arguments);
      }
      return toMultihash;
    }()
  }, {
    key: "toEntry",
    value: function toEntry(entry) {
      var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$presigned = _ref.presigned,
        presigned = _ref$presigned === void 0 ? false : _ref$presigned,
        _ref$includeHash = _ref.includeHash,
        includeHash = _ref$includeHash === void 0 ? false : _ref$includeHash;
      var e = {
        hash: includeHash ? entry.hash : null,
        id: entry.id,
        payload: entry.payload,
        next: entry.next
      };
      var v = entry.v;
      if (v > 1) {
        e.refs = entry.refs; // added in v2
      }

      e.v = entry.v;
      e.clock = new _lamportClock["default"](entry.clock.id, entry.clock.time);
      if (presigned) {
        return e; // don't include key/sig information
      }

      e.key = entry.key;
      if (v > 0) {
        e.identity = entry.identity; // added in v1
      }

      e.sig = entry.sig;
      return e;
    }

    /**
     * Create an Entry from a hash.
     * @param {IPFS} ipfs An IPFS instance
     * @param {string} hash The hash to create an Entry from
     * @returns {Promise<Entry>}
     * @example
     * const entry = await Entry.fromMultihash(ipfs, "zd...Foo")
     * console.log(entry)
     * // { hash: "Zd...Foo", payload: "hello", next: [] }
     */
  }, {
    key: "fromMultihash",
    value: function () {
      var _fromMultihash = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(ipfs, hash) {
        var e, entry;
        return _regenerator["default"].wrap(function _callee4$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              if (ipfs) {
                _context4.next = 2;
                break;
              }
              throw IpfsNotDefinedError();
            case 2:
              if (hash) {
                _context4.next = 4;
                break;
              }
              throw new Error("Invalid hash: ".concat(hash));
            case 4:
              _context4.next = 6;
              return _index.io.read(ipfs, hash, {
                links: IPLD_LINKS
              });
            case 6:
              e = _context4.sent;
              entry = Entry.toEntry(e);
              entry.hash = hash;
              return _context4.abrupt("return", entry);
            case 10:
            case "end":
              return _context4.stop();
          }
        }, _callee4);
      }));
      function fromMultihash(_x9, _x10) {
        return _fromMultihash.apply(this, arguments);
      }
      return fromMultihash;
    }()
    /**
     * Check if an object is an Entry.
     * @param {Entry} obj
     * @returns {boolean}
     */
  }, {
    key: "isEntry",
    value: function isEntry(obj) {
      return obj && obj.id !== undefined && obj.next !== undefined && obj.payload !== undefined && obj.v !== undefined && obj.hash !== undefined && obj.clock !== undefined && (obj.refs !== undefined || obj.v < 2); // 'refs' added in v2
    }

    /**
     * Compares two entries.
     * @param {Entry} a
     * @param {Entry} b
     * @returns {number} 1 if a is greater, -1 is b is greater
     */
  }, {
    key: "compare",
    value: function compare(a, b) {
      var distance = _lamportClock["default"].compare(a.clock, b.clock);
      if (distance === 0) return a.clock.id < b.clock.id ? -1 : 1;
      return distance;
    }

    /**
     * Check if an entry equals another entry.
     * @param {Entry} a
     * @param {Entry} b
     * @returns {boolean}
     */
  }, {
    key: "isEqual",
    value: function isEqual(a, b) {
      return a.hash === b.hash;
    }

    /**
     * Check if an entry is a parent to another entry.
     * @param {Entry} entry1 Entry to check
     * @param {Entry} entry2 The parent Entry
     * @returns {boolean}
     */
  }, {
    key: "isParent",
    value: function isParent(entry1, entry2) {
      return entry2.next.indexOf(entry1.hash) > -1;
    }

    /**
     * Find entry's children from an Array of entries.
     * Returns entry's children as an Array up to the last know child.
     * @param {Entry} entry Entry for which to find the parents
     * @param {Array<Entry>} values Entries to search parents from
     * @returns {Array<Entry>}
     */
  }, {
    key: "findChildren",
    value: function findChildren(entry, values) {
      var stack = [];
      var parent = values.find(function (e) {
        return Entry.isParent(entry, e);
      });
      var prev = entry;
      while (parent) {
        stack.push(parent);
        prev = parent;
        parent = values.find(function (e) {
          return Entry.isParent(prev, e);
        });
      }
      stack = stack.sort(function (a, b) {
        return a.clock.time > b.clock.time;
      });
      return stack;
    }
  }]);
  return Entry;
}();
var _default = Entry;
exports["default"] = _default;