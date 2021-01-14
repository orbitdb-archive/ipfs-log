'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var Entry = require('./entry');

var EntryIO = require('./entry-io');

var Sorting = require('./log-sorting');

var LastWriteWins = Sorting.LastWriteWins,
    NoZeroes = Sorting.NoZeroes;

var LogError = require('./log-errors');

var _require = require('./utils'),
    isDefined = _require.isDefined,
    findUniques = _require.findUniques,
    difference = _require.difference,
    io = _require.io;

var IPLD_LINKS = ['heads'];

var last = function last(arr, n) {
  return arr.slice(arr.length - Math.min(arr.length, n), arr.length);
};

var LogIO = /*#__PURE__*/function () {
  function LogIO() {
    (0, _classCallCheck2["default"])(this, LogIO);
  }

  (0, _createClass2["default"])(LogIO, null, [{
    key: "toMultihash",
    value: //

    /**
     * Get the multihash of a Log.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Log} log Log to get a multihash for
     * @returns {Promise<string>}
     * @deprecated
     */
    function () {
      var _toMultihash = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(ipfs, log) {
        var _ref,
            format,
            values,
            _args = arguments;

        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _ref = _args.length > 2 && _args[2] !== undefined ? _args[2] : {}, format = _ref.format;

                if (isDefined(ipfs)) {
                  _context.next = 3;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 3:
                if (isDefined(log)) {
                  _context.next = 5;
                  break;
                }

                throw LogError.LogNotDefinedError();

              case 5:
                if (!isDefined(format)) format = 'dag-cbor';
                _context.next = 8;
                return log.values();

              case 8:
                values = _context.sent;

                if (!(values.length < 1)) {
                  _context.next = 11;
                  break;
                }

                throw new Error('Can\'t serialize an empty log');

              case 11:
                return _context.abrupt("return", io.write(ipfs, format, log.toJSON(), {
                  links: IPLD_LINKS
                }));

              case 12:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }));

      function toMultihash(_x, _x2) {
        return _toMultihash.apply(this, arguments);
      }

      return toMultihash;
    }()
    /**
     * Create a log from a hashes.
     * @param {IPFS} ipfs An IPFS instance
     * @param {string} hash The hash of the log
     * @param {Object} options
     * @param {number} options.length How many items to include in the log
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} options.onProgressCallback
     */

  }, {
    key: "fromMultihash",
    value: function () {
      var _fromMultihash = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2(ipfs, hash, _ref2) {
        var _ref2$length, length, _ref2$exclude, exclude, timeout, concurrency, sortFn, onProgressCallback, logData, isHead, all, logId, entries, heads;

        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _ref2$length = _ref2.length, length = _ref2$length === void 0 ? -1 : _ref2$length, _ref2$exclude = _ref2.exclude, exclude = _ref2$exclude === void 0 ? [] : _ref2$exclude, timeout = _ref2.timeout, concurrency = _ref2.concurrency, sortFn = _ref2.sortFn, onProgressCallback = _ref2.onProgressCallback;

                if (isDefined(ipfs)) {
                  _context2.next = 3;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 3:
                if (isDefined(hash)) {
                  _context2.next = 5;
                  break;
                }

                throw new Error("Invalid hash: ".concat(hash));

              case 5:
                _context2.next = 7;
                return io.read(ipfs, hash, {
                  links: IPLD_LINKS
                });

              case 7:
                logData = _context2.sent;

                if (!(!logData.heads || !logData.id)) {
                  _context2.next = 10;
                  break;
                }

                throw LogError.NotALogError();

              case 10:
                // Use user provided sorting function or the default one
                sortFn = sortFn || NoZeroes(LastWriteWins);

                isHead = function isHead(e) {
                  return logData.heads.includes(e.hash);
                };

                _context2.next = 14;
                return EntryIO.fetchAll(ipfs, logData.heads, {
                  length: length,
                  exclude: exclude,
                  timeout: timeout,
                  concurrency: concurrency,
                  onProgressCallback: onProgressCallback
                });

              case 14:
                all = _context2.sent;
                logId = logData.id;
                entries = length > -1 ? last(all.sort(sortFn), length) : all;
                heads = entries.filter(isHead);
                return _context2.abrupt("return", {
                  logId: logId,
                  entries: entries,
                  heads: heads
                });

              case 19:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }));

      function fromMultihash(_x3, _x4, _x5) {
        return _fromMultihash.apply(this, arguments);
      }

      return fromMultihash;
    }()
    /**
     * Create a log from an entry hash.
     * @param {IPFS} ipfs An IPFS instance
     * @param {string} hash The hash of the entry
     * @param {Object} options
     * @param {number} options.length How many items to include in the log
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} options.onProgressCallback
     */

  }, {
    key: "fromEntryHash",
    value: function () {
      var _fromEntryHash = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3(ipfs, hash, _ref3) {
        var _ref3$length, length, _ref3$exclude, exclude, timeout, concurrency, sortFn, onProgressCallback, hashes, all, entries;

        return _regenerator["default"].wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _ref3$length = _ref3.length, length = _ref3$length === void 0 ? -1 : _ref3$length, _ref3$exclude = _ref3.exclude, exclude = _ref3$exclude === void 0 ? [] : _ref3$exclude, timeout = _ref3.timeout, concurrency = _ref3.concurrency, sortFn = _ref3.sortFn, onProgressCallback = _ref3.onProgressCallback;

                if (isDefined(ipfs)) {
                  _context3.next = 3;
                  break;
                }

                throw LogError.IpfsNotDefinedError();

              case 3:
                if (isDefined(hash)) {
                  _context3.next = 5;
                  break;
                }

                throw new Error("'hash' must be defined");

              case 5:
                // Convert input hash(s) to an array
                hashes = Array.isArray(hash) ? hash : [hash]; // Fetch given length, return size at least the given input entries

                length = length > -1 ? Math.max(length, 1) : length;
                _context3.next = 9;
                return EntryIO.fetchParallel(ipfs, hashes, {
                  length: length,
                  exclude: exclude,
                  timeout: timeout,
                  concurrency: concurrency,
                  onProgressCallback: onProgressCallback
                });

              case 9:
                all = _context3.sent;
                // Cap the result at the right size by taking the last n entries,
                // or if given length is -1, then take all
                sortFn = sortFn || NoZeroes(LastWriteWins);
                entries = length > -1 ? last(all.sort(sortFn), length) : all;
                return _context3.abrupt("return", {
                  entries: entries
                });

              case 13:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3);
      }));

      function fromEntryHash(_x6, _x7, _x8) {
        return _fromEntryHash.apply(this, arguments);
      }

      return fromEntryHash;
    }()
    /**
     * Creates a log data from a JSON object, to be passed to a Log constructor
     *
     * @param {IPFS} ipfs An IPFS instance
     * @param {json} json A json object containing valid log data
     * @param {Object} options
     * @param {number} options.length How many entries to include
     * @param {function(hash, entry, parent, depth)} options.onProgressCallback
     **/

  }, {
    key: "fromJSON",
    value: function () {
      var _fromJSON = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(ipfs, json, _ref4) {
        var _ref4$length, length, timeout, concurrency, onProgressCallback, id, heads, headHashes, all, entries;

        return _regenerator["default"].wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _ref4$length = _ref4.length, length = _ref4$length === void 0 ? -1 : _ref4$length, timeout = _ref4.timeout, concurrency = _ref4.concurrency, onProgressCallback = _ref4.onProgressCallback;

                if (isDefined(ipfs)) {
                  _context4.next = 3;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 3:
                id = json.id, heads = json.heads;
                headHashes = heads.map(function (e) {
                  return e.hash;
                });
                _context4.next = 7;
                return EntryIO.fetchParallel(ipfs, headHashes, {
                  length: length,
                  timeout: timeout,
                  concurrency: concurrency,
                  onProgressCallback: onProgressCallback
                });

              case 7:
                all = _context4.sent;
                entries = all.sort(Entry.compare);
                return _context4.abrupt("return", {
                  logId: id,
                  entries: entries,
                  heads: heads
                });

              case 10:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4);
      }));

      function fromJSON(_x9, _x10, _x11) {
        return _fromJSON.apply(this, arguments);
      }

      return fromJSON;
    }()
    /**
     * Create a new log starting from an entry.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Entry|Array<Entry>} sourceEntries An entry or an array of entries to fetch a log from
     * @param {Object} options
     * @param {number} options.length How many entries to include
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} options.onProgressCallback
     */

  }, {
    key: "fromEntry",
    value: function () {
      var _fromEntry = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee5(ipfs, sourceEntries, _ref5) {
        var _ref5$length, length, _ref5$exclude, exclude, timeout, concurrency, onProgressCallback, hashes, all, combined, uniques, sliced, missingSourceEntries, replaceInFront, entries, logId;

        return _regenerator["default"].wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _ref5$length = _ref5.length, length = _ref5$length === void 0 ? -1 : _ref5$length, _ref5$exclude = _ref5.exclude, exclude = _ref5$exclude === void 0 ? [] : _ref5$exclude, timeout = _ref5.timeout, concurrency = _ref5.concurrency, onProgressCallback = _ref5.onProgressCallback;

                if (isDefined(ipfs)) {
                  _context5.next = 3;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 3:
                if (isDefined(sourceEntries)) {
                  _context5.next = 5;
                  break;
                }

                throw new Error("'sourceEntries' must be defined");

              case 5:
                if (!(!Array.isArray(sourceEntries) && !Entry.isEntry(sourceEntries))) {
                  _context5.next = 7;
                  break;
                }

                throw new Error('\'sourceEntries\' argument must be an array of Entry instances or a single Entry');

              case 7:
                if (!Array.isArray(sourceEntries)) {
                  sourceEntries = [sourceEntries];
                } // Fetch given length, return size at least the given input entries


                length = length > -1 ? Math.max(length, sourceEntries.length) : length; // Make sure we pass hashes instead of objects to the fetcher function

                hashes = sourceEntries.map(function (e) {
                  return e.hash;
                }); // Fetch the entries

                _context5.next = 12;
                return EntryIO.fetchParallel(ipfs, hashes, {
                  length: length,
                  exclude: exclude,
                  timeout: timeout,
                  concurrency: concurrency,
                  onProgressCallback: onProgressCallback
                });

              case 12:
                all = _context5.sent;
                // Combine the fetches with the source entries and take only uniques
                combined = sourceEntries.concat(all).concat(exclude);
                uniques = findUniques(combined, 'hash').sort(Entry.compare); // Cap the result at the right size by taking the last n entries

                sliced = uniques.slice(length > -1 ? -length : -uniques.length); // Make sure that the given input entries are present in the result
                // in order to not lose references

                missingSourceEntries = difference(sliced, sourceEntries, 'hash');

                replaceInFront = function replaceInFront(a, withEntries) {
                  var sliced = a.slice(withEntries.length, a.length);
                  return withEntries.concat(sliced);
                }; // Add the input entries at the beginning of the array and remove
                // as many elements from the array before inserting the original entries


                entries = replaceInFront(sliced, missingSourceEntries);
                logId = entries[entries.length - 1].id;
                return _context5.abrupt("return", {
                  logId: logId,
                  entries: entries
                });

              case 21:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5);
      }));

      function fromEntry(_x12, _x13, _x14) {
        return _fromEntry.apply(this, arguments);
      }

      return fromEntry;
    }()
  }]);
  return LogIO;
}();

module.exports = LogIO;