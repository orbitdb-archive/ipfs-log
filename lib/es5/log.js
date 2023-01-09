"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "AccessController", {
  enumerable: true,
  get: function get() {
    return _defaultAccessController["default"];
  }
});
Object.defineProperty(exports, "Entry", {
  enumerable: true,
  get: function get() {
    return _entry["default"];
  }
});
Object.defineProperty(exports, "IPLD_LINKS", {
  enumerable: true,
  get: function get() {
    return _entry.IPLD_LINKS;
  }
});
Object.defineProperty(exports, "Sorting", {
  enumerable: true,
  get: function get() {
    return _logSorting["default"];
  }
});
exports["default"] = void 0;
Object.defineProperty(exports, "getWriteFormat", {
  enumerable: true,
  get: function get() {
    return _entry.getWriteFormat;
  }
});
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var _inherits2 = _interopRequireDefault(require("@babel/runtime/helpers/inherits"));
var _possibleConstructorReturn2 = _interopRequireDefault(require("@babel/runtime/helpers/possibleConstructorReturn"));
var _getPrototypeOf2 = _interopRequireDefault(require("@babel/runtime/helpers/getPrototypeOf"));
var _pMap = _interopRequireDefault(require("p-map"));
var _gSet = _interopRequireDefault(require("./g-set.js"));
var _entry = _interopRequireWildcard(require("./entry.js"));
var _logIo = _interopRequireDefault(require("./log-io.js"));
var _logErrors = require("./log-errors.js");
var _lamportClock = _interopRequireDefault(require("./lamport-clock.js"));
var _logSorting = _interopRequireDefault(require("./log-sorting.js"));
var _defaultAccessController = _interopRequireDefault(require("./default-access-controller.js"));
var _index = require("./utils/index.js");
var _entryIndex = _interopRequireDefault(require("./entry-index.js"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = (0, _getPrototypeOf2["default"])(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = (0, _getPrototypeOf2["default"])(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return (0, _possibleConstructorReturn2["default"])(this, result); }; }
function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }
var LastWriteWins = _logSorting["default"].LastWriteWins,
  NoZeroes = _logSorting["default"].NoZeroes;
var randomId = function randomId() {
  return new Date().getTime().toString();
};
var getHash = function getHash(e) {
  return e.hash;
};
var flatMap = function flatMap(res, acc) {
  return res.concat(acc);
};
var getNextPointers = function getNextPointers(entry) {
  return entry.next;
};
var maxClockTimeReducer = function maxClockTimeReducer(res, acc) {
  return Math.max(res, acc.clock.time);
};
var uniqueEntriesReducer = function uniqueEntriesReducer(res, acc) {
  res[acc.hash] = acc;
  return res;
};

/**
 * @description
 * Log implements a G-Set CRDT and adds ordering.
 *
 * From:
 * "A comprehensive study of Convergent and Commutative Replicated Data Types"
 * https://hal.inria.fr/inria-00555588
 */
var Log = /*#__PURE__*/function (_GSet) {
  (0, _inherits2["default"])(Log, _GSet);
  var _super = _createSuper(Log);
  /**
   * Create a new Log instance
   * @param {IPFS} ipfs An IPFS instance
   * @param {Object} identity Identity (https://github.com/orbitdb/orbit-db-identity-provider/blob/master/src/identity.js)
   * @param {Object} options
   * @param {string} options.logId ID of the log
   * @param {Object} options.access AccessController (./default-access-controller)
   * @param {Array<Entry>} options.entries An Array of Entries from which to create the log
   * @param {Array<Entry>} options.heads Set the heads of the log
   * @param {Clock} options.clock Set the clock of the log
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @return {Log} The log instance
   */
  function Log(ipfs, identity) {
    var _this;
    var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
      logId = _ref.logId,
      access = _ref.access,
      entries = _ref.entries,
      heads = _ref.heads,
      clock = _ref.clock,
      sortFn = _ref.sortFn,
      concurrency = _ref.concurrency;
    (0, _classCallCheck2["default"])(this, Log);
    if (!(0, _index.isDefined)(ipfs)) {
      throw (0, _logErrors.IPFSNotDefinedError)();
    }
    if (!(0, _index.isDefined)(identity)) {
      throw new Error('Identity is required');
    }
    if (!(0, _index.isDefined)(access)) {
      access = new _defaultAccessController["default"]();
    }
    if ((0, _index.isDefined)(entries) && !Array.isArray(entries)) {
      throw new Error('\'entries\' argument must be an array of Entry instances');
    }
    if ((0, _index.isDefined)(heads) && !Array.isArray(heads)) {
      throw new Error('\'heads\' argument must be an array');
    }
    if (!(0, _index.isDefined)(sortFn)) {
      sortFn = LastWriteWins;
    }
    _this = _super.call(this);
    _this._sortFn = NoZeroes(sortFn);
    _this._storage = ipfs;
    _this._id = logId || randomId();

    // Access Controller
    _this._access = access;
    // Identity
    _this._identity = identity;

    // Add entries to the internal cache
    var uniqueEntries = (entries || []).reduce(uniqueEntriesReducer, {});
    _this._entryIndex = new _entryIndex["default"](uniqueEntries);
    entries = Object.values(uniqueEntries) || [];

    // Set heads if not passed as an argument
    heads = heads || Log.findHeads(entries);
    _this._headsIndex = heads.reduce(uniqueEntriesReducer, {});

    // Index of all next pointers in this log
    _this._nextsIndex = {};
    var addToNextsIndex = function addToNextsIndex(e) {
      return e.next.forEach(function (a) {
        return _this._nextsIndex[a] = e.hash;
      });
    };
    entries.forEach(addToNextsIndex);

    // Set the length, we calculate the length manually internally
    _this._length = entries.length;

    // Set the clock
    var maxTime = Math.max(clock ? clock.time : 0, _this.heads.reduce(maxClockTimeReducer, 0));
    // Take the given key as the clock id is it's a Key instance,
    // otherwise if key was given, take whatever it is,
    // and if it was null, take the given id as the clock id
    _this._clock = new _lamportClock["default"](_this._identity.publicKey, maxTime);
    _this.joinConcurrency = concurrency || 16;
    return _this;
  }

  /**
   * Returns the ID of the log.
   * @returns {string}
   */
  (0, _createClass2["default"])(Log, [{
    key: "id",
    get: function get() {
      return this._id;
    }

    /**
     * Returns the clock of the log.
     * @returns {string}
     */
  }, {
    key: "clock",
    get: function get() {
      return this._clock;
    }

    /**
     * Returns the length of the log.
     * @return {number} Length
     */
  }, {
    key: "length",
    get: function get() {
      return this._length;
    }

    /**
     * Returns the values in the log.
     * @returns {Array<Entry>}
     */
  }, {
    key: "values",
    get: function get() {
      return Object.values(this.traverse(this.heads)).reverse();
    }

    /**
     * Returns an array of heads as hashes.
     * @returns {Array<string>}
     */
  }, {
    key: "heads",
    get: function get() {
      return Object.values(this._headsIndex).sort(this._sortFn).reverse();
    }

    /**
     * Returns an array of Entry objects that reference entries which
     * are not in the log currently.
     * @returns {Array<Entry>}
     */
  }, {
    key: "tails",
    get: function get() {
      return Log.findTails(this.values);
    }

    /**
     * Returns an array of hashes that are referenced by entries which
     * are not in the log currently.
     * @returns {Array<string>} Array of hashes
     */
  }, {
    key: "tailHashes",
    get: function get() {
      return Log.findTailHashes(this.values);
    }

    /**
     * Set the identity for the log
     * @param {Identity} [identity] The identity to be set
     */
  }, {
    key: "setIdentity",
    value: function setIdentity(identity) {
      this._identity = identity;
      // Find the latest clock from the heads
      var time = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0));
      this._clock = new _lamportClock["default"](this._identity.publicKey, time);
    }

    /**
     * Find an entry.
     * @param {string} [hash] The hashes of the entry
     * @returns {Entry|undefined}
     */
  }, {
    key: "get",
    value: function get(hash) {
      return this._entryIndex.get(hash);
    }

    /**
     * Checks if a entry is part of the log
     * @param {string} hash The hash of the entry
     * @returns {boolean}
     */
  }, {
    key: "has",
    value: function has(entry) {
      return this._entryIndex.get(entry.hash || entry) !== undefined;
    }
  }, {
    key: "traverse",
    value: function traverse(rootEntries) {
      var _this2 = this;
      var amount = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
      var endHash = arguments.length > 2 ? arguments[2] : undefined;
      // Sort the given given root entries and use as the starting stack
      var stack = rootEntries.sort(this._sortFn).reverse();

      // Cache for checking if we've processed an entry already
      var traversed = {};
      // End result
      var result = {};
      var count = 0;
      // Named function for getting an entry from the log
      var getEntry = function getEntry(e) {
        return _this2.get(e);
      };

      // Add an entry to the stack and traversed nodes index
      var addToStack = function addToStack(entry) {
        // If we've already processed the entry, don't add it to the stack
        if (!entry || traversed[entry.hash]) {
          return;
        }

        // Add the entry in front of the stack and sort
        stack = [entry].concat((0, _toConsumableArray2["default"])(stack)).sort(_this2._sortFn).reverse();
        // Add to the cache of processed entries
        traversed[entry.hash] = true;
      };
      var addEntry = function addEntry(rootEntry) {
        result[rootEntry.hash] = rootEntry;
        traversed[rootEntry.hash] = true;
        count++;
      };

      // Start traversal
      // Process stack until it's empty (traversed the full log)
      // or when we have the requested amount of entries
      // If requested entry amount is -1, traverse all
      while (stack.length > 0 && (count < amount || amount < 0)) {
        // eslint-disable-line no-unmodified-loop-condition
        // Get the next element from the stack
        var entry = stack.shift();
        // Add to the result
        addEntry(entry);
        // If it is the specified end hash, break out of the while loop
        if (endHash && endHash === entry.hash) break;

        // Add entry's next references to the stack
        var entries = entry.next.map(getEntry);
        var defined = entries.filter(_index.isDefined);
        defined.forEach(addToStack);
      }
      stack = [];
      traversed = {};
      // End result
      return result;
    }

    /**
     * Append an entry to the log.
     * @param {Entry} entry Entry to add
     * @return {Log} New Log containing the appended value
     */
  }, {
    key: "append",
    value: function () {
      var _append = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(data) {
        var _this3 = this;
        var pointerCount,
          pin,
          newTime,
          all,
          getEveryPow2,
          references,
          nexts,
          isNext,
          refs,
          entry,
          canAppend,
          _args = arguments;
        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              pointerCount = _args.length > 1 && _args[1] !== undefined ? _args[1] : 1;
              pin = _args.length > 2 && _args[2] !== undefined ? _args[2] : false;
              // Update the clock (find the latest clock)
              newTime = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0)) + 1;
              this._clock = new _lamportClock["default"](this.clock.id, newTime);
              all = Object.values(this.traverse(this.heads, Math.max(pointerCount, this.heads.length))); // If pointer count is 4, returns 2
              // If pointer count is 8, returns 3 references
              // If pointer count is 512, returns 9 references
              // If pointer count is 2048, returns 11 references
              getEveryPow2 = function getEveryPow2(maxDistance) {
                var entries = new Set();
                for (var i = 1; i <= maxDistance; i *= 2) {
                  var index = Math.min(i - 1, all.length - 1);
                  entries.add(all[index]);
                }
                return entries;
              };
              references = getEveryPow2(Math.min(pointerCount, all.length)); // Always include the last known reference
              if (all.length < pointerCount && all[all.length - 1]) {
                references.add(all[all.length - 1]);
              }

              // Create the next pointers from heads
              nexts = Object.keys(this.heads.reverse().reduce(uniqueEntriesReducer, {}));
              isNext = function isNext(e) {
                return !nexts.includes(e);
              }; // Delete the heads from the refs
              refs = Array.from(references).map(getHash).filter(isNext); // @TODO: Split Entry.create into creating object, checking permission, signing and then posting to IPFS
              // Create the entry and add it to the internal cache
              _context.next = 13;
              return _entry["default"].create(this._storage, this._identity, this.id, data, nexts, this.clock, refs, pin);
            case 13:
              entry = _context.sent;
              _context.next = 16;
              return this._access.canAppend(entry, this._identity.provider);
            case 16:
              canAppend = _context.sent;
              if (canAppend) {
                _context.next = 19;
                break;
              }
              throw new Error("Could not append entry, key \"".concat(this._identity.id, "\" is not allowed to write to the log"));
            case 19:
              this._entryIndex.set(entry.hash, entry);
              nexts.forEach(function (e) {
                return _this3._nextsIndex[e] = entry.hash;
              });
              this._headsIndex = {};
              this._headsIndex[entry.hash] = entry;
              // Update the length
              this._length++;
              return _context.abrupt("return", entry);
            case 25:
            case "end":
              return _context.stop();
          }
        }, _callee, this);
      }));
      function append(_x) {
        return _append.apply(this, arguments);
      }
      return append;
    }()
    /*
     * Creates a javscript iterator over log entries
     *
     * @param {Object} options
     * @param {string|Array} options.gt Beginning hash of the iterator, non-inclusive
     * @param {string|Array} options.gte Beginning hash of the iterator, inclusive
     * @param {string|Array} options.lt Ending hash of the iterator, non-inclusive
     * @param {string|Array} options.lte Ending hash of the iterator, inclusive
     * @param {amount} options.amount Number of entried to return to / from the gte / lte hash
     * @returns {Symbol.Iterator} Iterator object containing log entries
     *
     * @examples
     *
     * (async () => {
     *   log1 = new Log(ipfs, testIdentity, { logId: 'X' })
     *
     *   for (let i = 0; i <= 100; i++) {
     *     await log1.append('entry' + i)
     *   }
     *
     *   let it = log1.iterator({
     *     lte: 'zdpuApFd5XAPkCTmSx7qWQmQzvtdJPtx2K5p9to6ytCS79bfk',
     *     amount: 10
     *   })
     *
     *   [...it].length // 10
     * })()
     *
     *
     */
  }, {
    key: "iterator",
    value: function iterator() {
      var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref2$gt = _ref2.gt,
        gt = _ref2$gt === void 0 ? undefined : _ref2$gt,
        _ref2$gte = _ref2.gte,
        gte = _ref2$gte === void 0 ? undefined : _ref2$gte,
        _ref2$lt = _ref2.lt,
        lt = _ref2$lt === void 0 ? undefined : _ref2$lt,
        _ref2$lte = _ref2.lte,
        lte = _ref2$lte === void 0 ? undefined : _ref2$lte,
        _ref2$amount = _ref2.amount,
        amount = _ref2$amount === void 0 ? -1 : _ref2$amount;
      if (amount === 0) return /*#__PURE__*/_regenerator["default"].mark(function _callee2() {
        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
            case "end":
              return _context2.stop();
          }
        }, _callee2);
      })();
      if (typeof lte === 'string') lte = [this.get(lte)];
      if (typeof lt === 'string') lt = [this.get(this.get(lt).next[0])];
      if (lte && !Array.isArray(lte)) throw (0, _logErrors.LtOrLteMustBeStringOrArray)();
      if (lt && !Array.isArray(lt)) throw (0, _logErrors.LtOrLteMustBeStringOrArray)();
      var start = (lte || lt || this.heads).filter(_index.isDefined);
      var endHash = gte ? this.get(gte).hash : gt ? this.get(gt).hash : null;
      var count = endHash ? -1 : amount || -1;
      var entries = this.traverse(start, count, endHash);
      var entryValues = Object.values(entries);

      // Strip off last entry if gt is non-inclusive
      if (gt) entryValues.pop();

      // Deal with the amount argument working backwards from gt/gte
      if ((gt || gte) && amount > -1) {
        entryValues = entryValues.slice(entryValues.length - amount, entryValues.length);
      }
      return /*#__PURE__*/_regenerator["default"].mark(function _callee3() {
        var i;
        return _regenerator["default"].wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              _context3.t0 = _regenerator["default"].keys(entryValues);
            case 1:
              if ((_context3.t1 = _context3.t0()).done) {
                _context3.next = 7;
                break;
              }
              i = _context3.t1.value;
              _context3.next = 5;
              return entryValues[i];
            case 5:
              _context3.next = 1;
              break;
            case 7:
            case "end":
              return _context3.stop();
          }
        }, _callee3);
      })();
    }

    /**
     * Join two logs.
     *
     * Joins another log into this one.
     *
     * @param {Log} log Log to join with this Log
     * @param {number} [size=-1] Max size of the joined log
     * @returns {Promise<Log>} This Log instance
     * @example
     * await log1.join(log2)
     */
  }, {
    key: "join",
    value: function () {
      var _join = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee7(log) {
        var _this4 = this;
        var size,
          newItems,
          identityProvider,
          permitted,
          verify,
          entriesToJoin,
          addToNextsIndex,
          notReferencedByNewItems,
          notInCurrentNexts,
          nextsFromNewItems,
          mergedHeads,
          tmp,
          maxClock,
          _args7 = arguments;
        return _regenerator["default"].wrap(function _callee7$(_context7) {
          while (1) switch (_context7.prev = _context7.next) {
            case 0:
              size = _args7.length > 1 && _args7[1] !== undefined ? _args7[1] : -1;
              if ((0, _index.isDefined)(log)) {
                _context7.next = 3;
                break;
              }
              throw (0, _logErrors.LogNotDefinedError)();
            case 3:
              if (Log.isLog(log)) {
                _context7.next = 5;
                break;
              }
              throw (0, _logErrors.NotALogError)();
            case 5:
              if (!(this.id !== log.id)) {
                _context7.next = 7;
                break;
              }
              return _context7.abrupt("return");
            case 7:
              // Get the difference of the logs
              newItems = Log.difference(log, this);
              identityProvider = this._identity.provider; // Verify if entries are allowed to be added to the log and throws if
              // there's an invalid entry
              permitted = /*#__PURE__*/function () {
                var _ref3 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(entry) {
                  var canAppend;
                  return _regenerator["default"].wrap(function _callee4$(_context4) {
                    while (1) switch (_context4.prev = _context4.next) {
                      case 0:
                        _context4.next = 2;
                        return _this4._access.canAppend(entry, identityProvider);
                      case 2:
                        canAppend = _context4.sent;
                        if (canAppend) {
                          _context4.next = 5;
                          break;
                        }
                        throw new Error("Could not append entry, key \"".concat(entry.identity.id, "\" is not allowed to write to the log"));
                      case 5:
                      case "end":
                        return _context4.stop();
                    }
                  }, _callee4);
                }));
                return function permitted(_x3) {
                  return _ref3.apply(this, arguments);
                };
              }(); // Verify signature for each entry and throws if there's an invalid signature
              verify = /*#__PURE__*/function () {
                var _ref4 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee5(entry) {
                  var isValid, publicKey;
                  return _regenerator["default"].wrap(function _callee5$(_context5) {
                    while (1) switch (_context5.prev = _context5.next) {
                      case 0:
                        _context5.next = 2;
                        return _entry["default"].verify(identityProvider, entry);
                      case 2:
                        isValid = _context5.sent;
                        publicKey = entry.identity ? entry.identity.publicKey : entry.key;
                        if (isValid) {
                          _context5.next = 6;
                          break;
                        }
                        throw new Error("Could not validate signature \"".concat(entry.sig, "\" for entry \"").concat(entry.hash, "\" and key \"").concat(publicKey, "\""));
                      case 6:
                      case "end":
                        return _context5.stop();
                    }
                  }, _callee5);
                }));
                return function verify(_x4) {
                  return _ref4.apply(this, arguments);
                };
              }();
              entriesToJoin = Object.values(newItems);
              _context7.next = 14;
              return (0, _pMap["default"])(entriesToJoin, /*#__PURE__*/function () {
                var _ref5 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee6(e) {
                  return _regenerator["default"].wrap(function _callee6$(_context6) {
                    while (1) switch (_context6.prev = _context6.next) {
                      case 0:
                        _context6.next = 2;
                        return permitted(e);
                      case 2:
                        _context6.next = 4;
                        return verify(e);
                      case 4:
                      case "end":
                        return _context6.stop();
                    }
                  }, _callee6);
                }));
                return function (_x5) {
                  return _ref5.apply(this, arguments);
                };
              }(), {
                concurrency: this.joinConcurrency
              });
            case 14:
              // Update the internal next pointers index
              addToNextsIndex = function addToNextsIndex(e) {
                var entry = _this4.get(e.hash);
                if (!entry) _this4._length++; /* istanbul ignore else */
                e.next.forEach(function (a) {
                  return _this4._nextsIndex[a] = e.hash;
                });
              };
              Object.values(newItems).forEach(addToNextsIndex);

              // Update the internal entry index
              this._entryIndex.add(newItems);

              // Merge the heads
              notReferencedByNewItems = function notReferencedByNewItems(e) {
                return !nextsFromNewItems.find(function (a) {
                  return a === e.hash;
                });
              };
              notInCurrentNexts = function notInCurrentNexts(e) {
                return !_this4._nextsIndex[e.hash];
              };
              nextsFromNewItems = Object.values(newItems).map(getNextPointers).reduce(flatMap, []);
              mergedHeads = Log.findHeads(Object.values(Object.assign({}, this._headsIndex, log._headsIndex))).filter(notReferencedByNewItems).filter(notInCurrentNexts).reduce(uniqueEntriesReducer, {});
              this._headsIndex = mergedHeads;

              // Slice to the requested size
              if (size > -1) {
                tmp = this.values;
                tmp = tmp.slice(-size);
                this._entryIndex = null;
                this._entryIndex = new _entryIndex["default"](tmp.reduce(uniqueEntriesReducer, {}));
                this._headsIndex = Log.findHeads(tmp).reduce(uniqueEntriesReducer, {});
                this._length = this._entryIndex.length;
              }

              // Find the latest clock from the heads
              maxClock = Object.values(this._headsIndex).reduce(maxClockTimeReducer, 0);
              this._clock = new _lamportClock["default"](this.clock.id, Math.max(this.clock.time, maxClock));
              return _context7.abrupt("return", this);
            case 26:
            case "end":
              return _context7.stop();
          }
        }, _callee7, this);
      }));
      function join(_x2) {
        return _join.apply(this, arguments);
      }
      return join;
    }()
    /**
     * Get the log in JSON format.
     * @returns {Object} An object with the id and heads properties
     */
  }, {
    key: "toJSON",
    value: function toJSON() {
      return {
        id: this.id,
        heads: this.heads.sort(this._sortFn) // default sorting
        .reverse() // we want the latest as the first element
        .map(getHash) // return only the head hashes
      };
    }

    /**
     * Get the log in JSON format as a snapshot.
     * @returns {Object} An object with the id, heads and value properties
     */
  }, {
    key: "toSnapshot",
    value: function toSnapshot() {
      return {
        id: this.id,
        heads: this.heads,
        values: this.values
      };
    }

    /**
     * Get the log as a Buffer.
     * @returns {Buffer}
     */
  }, {
    key: "toBuffer",
    value: function toBuffer() {
      return Buffer.from(JSON.stringify(this.toJSON()));
    }

    /**
     * Returns the log entries as a formatted string.
     * @returns {string}
     * @example
     * two
     * └─one
     *   └─three
     */
  }, {
    key: "toString",
    value: function toString(payloadMapper) {
      var _this5 = this;
      return this.values.slice().reverse().map(function (e, idx) {
        var parents = _entry["default"].findChildren(e, _this5.values);
        var len = parents.length;
        var padding = new Array(Math.max(len - 1, 0));
        padding = len > 1 ? padding.fill('  ') : padding;
        padding = len > 0 ? padding.concat(['└─']) : padding;
        /* istanbul ignore next */
        return padding.join('') + (payloadMapper ? payloadMapper(e.payload) : e.payload);
      }).join('\n');
    }

    /**
     * Check whether an object is a Log instance.
     * @param {Object} log An object to check
     * @returns {boolean}
     */
  }, {
    key: "toMultihash",
    value:
    /**
     * Get the log's multihash.
     * @returns {Promise<string>} Multihash of the Log as Base58 encoded string.
     */
    function toMultihash() {
      var _ref6 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        format = _ref6.format;
      return _logIo["default"].toMultihash(this._storage, this, {
        format: format
      });
    }

    /**
     * Create a log from a hashes.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {string} hash The log hash
     * @param {Object} options
     * @param {AccessController} options.access The access controller instance
     * @param {number} options.length How many items to include in the log
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} options.onProgressCallback
     * @param {Function} options.sortFn The sort function - by default LastWriteWins
     * @returns {Promise<Log>}
     */
  }], [{
    key: "isLog",
    value: function isLog(log) {
      return log.id !== undefined && log.heads !== undefined && log._entryIndex !== undefined;
    }
  }, {
    key: "fromMultihash",
    value: function () {
      var _fromMultihash = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee8(ipfs, identity, hash) {
        var _ref7,
          access,
          _ref7$length,
          length,
          _ref7$exclude,
          exclude,
          shouldExclude,
          timeout,
          concurrency,
          sortFn,
          onProgressCallback,
          _yield$LogIO$fromMult,
          logId,
          entries,
          heads,
          _args8 = arguments;
        return _regenerator["default"].wrap(function _callee8$(_context8) {
          while (1) switch (_context8.prev = _context8.next) {
            case 0:
              _ref7 = _args8.length > 3 && _args8[3] !== undefined ? _args8[3] : {}, access = _ref7.access, _ref7$length = _ref7.length, length = _ref7$length === void 0 ? -1 : _ref7$length, _ref7$exclude = _ref7.exclude, exclude = _ref7$exclude === void 0 ? [] : _ref7$exclude, shouldExclude = _ref7.shouldExclude, timeout = _ref7.timeout, concurrency = _ref7.concurrency, sortFn = _ref7.sortFn, onProgressCallback = _ref7.onProgressCallback;
              _context8.next = 3;
              return _logIo["default"].fromMultihash(ipfs, hash, {
                length: length,
                exclude: exclude,
                shouldExclude: shouldExclude,
                timeout: timeout,
                onProgressCallback: onProgressCallback,
                concurrency: concurrency,
                sortFn: sortFn
              });
            case 3:
              _yield$LogIO$fromMult = _context8.sent;
              logId = _yield$LogIO$fromMult.logId;
              entries = _yield$LogIO$fromMult.entries;
              heads = _yield$LogIO$fromMult.heads;
              return _context8.abrupt("return", new Log(ipfs, identity, {
                logId: logId,
                access: access,
                entries: entries,
                heads: heads,
                sortFn: sortFn
              }));
            case 8:
            case "end":
              return _context8.stop();
          }
        }, _callee8);
      }));
      function fromMultihash(_x6, _x7, _x8) {
        return _fromMultihash.apply(this, arguments);
      }
      return fromMultihash;
    }()
    /**
     * Create a log from a single entry's hash.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {string} hash The entry's hash
     * @param {Object} options
     * @param {string} options.logId The ID of the log
     * @param {AccessController} options.access The access controller instance
     * @param {number} options.length How many entries to include in the log
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} options.onProgressCallback
     * @param {Function} options.sortFn The sort function - by default LastWriteWins
     * @return {Promise<Log>} New Log
     */
  }, {
    key: "fromEntryHash",
    value: function () {
      var _fromEntryHash = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee9(ipfs, identity, hash) {
        var _ref8,
          logId,
          access,
          _ref8$length,
          length,
          _ref8$exclude,
          exclude,
          shouldExclude,
          timeout,
          concurrency,
          sortFn,
          onProgressCallback,
          _yield$LogIO$fromEntr,
          entries,
          _args9 = arguments;
        return _regenerator["default"].wrap(function _callee9$(_context9) {
          while (1) switch (_context9.prev = _context9.next) {
            case 0:
              _ref8 = _args9.length > 3 && _args9[3] !== undefined ? _args9[3] : {}, logId = _ref8.logId, access = _ref8.access, _ref8$length = _ref8.length, length = _ref8$length === void 0 ? -1 : _ref8$length, _ref8$exclude = _ref8.exclude, exclude = _ref8$exclude === void 0 ? [] : _ref8$exclude, shouldExclude = _ref8.shouldExclude, timeout = _ref8.timeout, concurrency = _ref8.concurrency, sortFn = _ref8.sortFn, onProgressCallback = _ref8.onProgressCallback;
              _context9.next = 3;
              return _logIo["default"].fromEntryHash(ipfs, hash, {
                length: length,
                exclude: exclude,
                shouldExclude: shouldExclude,
                timeout: timeout,
                concurrency: concurrency,
                onProgressCallback: onProgressCallback
              });
            case 3:
              _yield$LogIO$fromEntr = _context9.sent;
              entries = _yield$LogIO$fromEntr.entries;
              return _context9.abrupt("return", new Log(ipfs, identity, {
                logId: logId,
                access: access,
                entries: entries,
                sortFn: sortFn
              }));
            case 6:
            case "end":
              return _context9.stop();
          }
        }, _callee9);
      }));
      function fromEntryHash(_x9, _x10, _x11) {
        return _fromEntryHash.apply(this, arguments);
      }
      return fromEntryHash;
    }()
    /**
     * Create a log from a Log Snapshot JSON.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {Object} json Log snapshot as JSON object
     * @param {Object} options
     * @param {AccessController} options.access The access controller instance
     * @param {number} options.length How many entries to include in the log
     * @param {function(hash, entry, parent, depth)} [options.onProgressCallback]
     * @param {Function} options.sortFn The sort function - by default LastWriteWins
     * @return {Promise<Log>} New Log
     */
  }, {
    key: "fromJSON",
    value: function () {
      var _fromJSON = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee10(ipfs, identity, json) {
        var _ref9,
          access,
          _ref9$length,
          length,
          timeout,
          sortFn,
          onProgressCallback,
          _yield$LogIO$fromJSON,
          logId,
          entries,
          _args10 = arguments;
        return _regenerator["default"].wrap(function _callee10$(_context10) {
          while (1) switch (_context10.prev = _context10.next) {
            case 0:
              _ref9 = _args10.length > 3 && _args10[3] !== undefined ? _args10[3] : {}, access = _ref9.access, _ref9$length = _ref9.length, length = _ref9$length === void 0 ? -1 : _ref9$length, timeout = _ref9.timeout, sortFn = _ref9.sortFn, onProgressCallback = _ref9.onProgressCallback;
              _context10.next = 3;
              return _logIo["default"].fromJSON(ipfs, json, {
                length: length,
                timeout: timeout,
                onProgressCallback: onProgressCallback
              });
            case 3:
              _yield$LogIO$fromJSON = _context10.sent;
              logId = _yield$LogIO$fromJSON.logId;
              entries = _yield$LogIO$fromJSON.entries;
              return _context10.abrupt("return", new Log(ipfs, identity, {
                logId: logId,
                access: access,
                entries: entries,
                sortFn: sortFn
              }));
            case 7:
            case "end":
              return _context10.stop();
          }
        }, _callee10);
      }));
      function fromJSON(_x12, _x13, _x14) {
        return _fromJSON.apply(this, arguments);
      }
      return fromJSON;
    }()
    /**
     * Create a new log from an Entry instance.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {Entry|Array<Entry>} sourceEntries An Entry or an array of entries to fetch a log from
     * @param {Object} options
     * @param {AccessController} options.access The access controller instance
     * @param {number} options.length How many entries to include. Default: infinite.
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} [options.onProgressCallback]
     * @param {Function} options.sortFn The sort function - by default LastWriteWins
     * @return {Promise<Log>} New Log
     */
  }, {
    key: "fromEntry",
    value: function () {
      var _fromEntry = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee11(ipfs, identity, sourceEntries) {
        var _ref10,
          access,
          _ref10$length,
          length,
          _ref10$exclude,
          exclude,
          timeout,
          concurrency,
          sortFn,
          onProgressCallback,
          _yield$LogIO$fromEntr2,
          logId,
          entries,
          _args11 = arguments;
        return _regenerator["default"].wrap(function _callee11$(_context11) {
          while (1) switch (_context11.prev = _context11.next) {
            case 0:
              _ref10 = _args11.length > 3 && _args11[3] !== undefined ? _args11[3] : {}, access = _ref10.access, _ref10$length = _ref10.length, length = _ref10$length === void 0 ? -1 : _ref10$length, _ref10$exclude = _ref10.exclude, exclude = _ref10$exclude === void 0 ? [] : _ref10$exclude, timeout = _ref10.timeout, concurrency = _ref10.concurrency, sortFn = _ref10.sortFn, onProgressCallback = _ref10.onProgressCallback;
              _context11.next = 3;
              return _logIo["default"].fromEntry(ipfs, sourceEntries, {
                length: length,
                exclude: exclude,
                timeout: timeout,
                concurrency: concurrency,
                onProgressCallback: onProgressCallback
              });
            case 3:
              _yield$LogIO$fromEntr2 = _context11.sent;
              logId = _yield$LogIO$fromEntr2.logId;
              entries = _yield$LogIO$fromEntr2.entries;
              return _context11.abrupt("return", new Log(ipfs, identity, {
                logId: logId,
                access: access,
                entries: entries,
                sortFn: sortFn
              }));
            case 7:
            case "end":
              return _context11.stop();
          }
        }, _callee11);
      }));
      function fromEntry(_x15, _x16, _x17) {
        return _fromEntry.apply(this, arguments);
      }
      return fromEntry;
    }()
    /**
     * Find heads from a collection of entries.
     *
     * Finds entries that are the heads of this collection,
     * ie. entries that are not referenced by other entries.
     *
     * @param {Array<Entry>} entries Entries to search heads from
     * @returns {Array<Entry>}
     */
  }, {
    key: "findHeads",
    value: function findHeads(entries) {
      var indexReducer = function indexReducer(res, entry, idx, arr) {
        var addToResult = function addToResult(e) {
          return res[e] = entry.hash;
        };
        entry.next.forEach(addToResult);
        return res;
      };
      var items = entries.reduce(indexReducer, {});
      var exists = function exists(e) {
        return items[e.hash] === undefined;
      };
      var compareIds = function compareIds(a, b) {
        return a.clock.id > b.clock.id;
      };
      return entries.filter(exists).sort(compareIds);
    }

    // Find entries that point to another entry that is not in the
    // input array
  }, {
    key: "findTails",
    value: function findTails(entries) {
      // Reverse index { next -> entry }
      var reverseIndex = {};
      // Null index containing entries that have no parents (nexts)
      var nullIndex = [];
      // Hashes for all entries for quick lookups
      var hashes = {};
      // Hashes of all next entries
      var nexts = [];
      var addToIndex = function addToIndex(e) {
        if (e.next.length === 0) {
          nullIndex.push(e);
        }
        var addToReverseIndex = function addToReverseIndex(a) {
          /* istanbul ignore else */
          if (!reverseIndex[a]) reverseIndex[a] = [];
          reverseIndex[a].push(e);
        };

        // Add all entries and their parents to the reverse index
        e.next.forEach(addToReverseIndex);
        // Get all next references
        nexts = nexts.concat(e.next);
        // Get the hashes of input entries
        hashes[e.hash] = true;
      };

      // Create our indices
      entries.forEach(addToIndex);
      var addUniques = function addUniques(res, entries, idx, arr) {
        return res.concat((0, _index.findUniques)(entries, 'hash'));
      };
      var exists = function exists(e) {
        return hashes[e] === undefined;
      };
      var findFromReverseIndex = function findFromReverseIndex(e) {
        return reverseIndex[e];
      };

      // Drop hashes that are not in the input entries
      var tails = nexts // For every hash in nexts:
      .filter(exists) // Remove undefineds and nulls
      .map(findFromReverseIndex) // Get the Entry from the reverse index
      .reduce(addUniques, []) // Flatten the result and take only uniques
      .concat(nullIndex); // Combine with tails the have no next refs (ie. first-in-their-chain)

      return (0, _index.findUniques)(tails, 'hash').sort(_entry["default"].compare);
    }

    // Find the hashes to entries that are not in a collection
    // but referenced by other entries
  }, {
    key: "findTailHashes",
    value: function findTailHashes(entries) {
      var hashes = {};
      var addToIndex = function addToIndex(e) {
        return hashes[e.hash] = true;
      };
      var reduceTailHashes = function reduceTailHashes(res, entry, idx, arr) {
        var addToResult = function addToResult(e) {
          /* istanbul ignore else */
          if (hashes[e] === undefined) {
            res.splice(0, 0, e);
          }
        };
        entry.next.reverse().forEach(addToResult);
        return res;
      };
      entries.forEach(addToIndex);
      return entries.reduce(reduceTailHashes, []);
    }
  }, {
    key: "difference",
    value: function difference(a, b) {
      var stack = Object.keys(a._headsIndex);
      var traversed = {};
      var res = {};
      var pushToStack = function pushToStack(hash) {
        if (!traversed[hash] && !b.get(hash)) {
          stack.push(hash);
          traversed[hash] = true;
        }
      };
      while (stack.length > 0) {
        var hash = stack.shift();
        var entry = a.get(hash);
        if (entry && !b.get(hash) && entry.id === b.id) {
          res[entry.hash] = entry;
          traversed[entry.hash] = true;
          entry.next.concat(entry.refs).forEach(pushToStack);
        }
      }
      return res;
    }
  }]);
  return Log;
}(_gSet["default"]);
var _default = Log;
exports["default"] = _default;