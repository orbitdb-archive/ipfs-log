"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var _pMap = _interopRequireDefault(require("p-map"));
var _pDoWhilst = _interopRequireDefault(require("p-do-whilst"));
var _entry = _interopRequireDefault(require("./entry.js"));
var isEntry = _entry["default"].isEntry,
  fromMultihash = _entry["default"].fromMultihash;
var hasItems = function hasItems(arr) {
  return arr && arr.length > 0;
};
var EntryIO = /*#__PURE__*/function () {
  function EntryIO() {
    (0, _classCallCheck2["default"])(this, EntryIO);
  }
  (0, _createClass2["default"])(EntryIO, null, [{
    key: "fetchParallel",
    value: // Fetch log graphs in parallel
    function () {
      var _fetchParallel = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2(ipfs, hashes, _ref) {
        var length, _ref$exclude, exclude, shouldExclude, timeout, concurrency, onProgressCallback, fetchOne, concatArrays, flatten, res;
        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              length = _ref.length, _ref$exclude = _ref.exclude, exclude = _ref$exclude === void 0 ? [] : _ref$exclude, shouldExclude = _ref.shouldExclude, timeout = _ref.timeout, concurrency = _ref.concurrency, onProgressCallback = _ref.onProgressCallback;
              fetchOne = /*#__PURE__*/function () {
                var _ref2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(hash) {
                  return _regenerator["default"].wrap(function _callee$(_context) {
                    while (1) switch (_context.prev = _context.next) {
                      case 0:
                        return _context.abrupt("return", EntryIO.fetchAll(ipfs, hash, {
                          length: length,
                          exclude: exclude,
                          shouldExclude: shouldExclude,
                          timeout: timeout,
                          onProgressCallback: onProgressCallback,
                          concurrency: concurrency
                        }));
                      case 1:
                      case "end":
                        return _context.stop();
                    }
                  }, _callee);
                }));
                return function fetchOne(_x4) {
                  return _ref2.apply(this, arguments);
                };
              }();
              concatArrays = function concatArrays(arr1, arr2) {
                return arr1.concat(arr2);
              };
              flatten = function flatten(arr) {
                return arr.reduce(concatArrays, []);
              };
              _context2.next = 6;
              return (0, _pMap["default"])(hashes, fetchOne, {
                concurrency: Math.max(concurrency || hashes.length, 1)
              });
            case 6:
              res = _context2.sent;
              return _context2.abrupt("return", flatten(res));
            case 8:
            case "end":
              return _context2.stop();
          }
        }, _callee2);
      }));
      function fetchParallel(_x, _x2, _x3) {
        return _fetchParallel.apply(this, arguments);
      }
      return fetchParallel;
    }()
    /**
     * Fetch log entries
     *
     * @param {IPFS} [ipfs] An IPFS instance
     * @param {string} [hash] Multihash of the entry to fetch
     * @param {string} [parent] Parent of the node to be fetched
     * @param {Object} [all] Entries to skip
     * @param {Number} [amount=-1] How many entries to fetch
     * @param {Number} [depth=0] Current depth of the recursion
     * @param {function(entry)} shouldExclude A function that can be passed to determine whether a specific hash should be excluded, ie. not fetched. The function should return true to indicate exclusion, otherwise return false.
     * @param {function(entry)} onProgressCallback Called when an entry was fetched
     * @returns {Promise<Array<Entry>>}
     */
  }, {
    key: "fetchAll",
    value: function () {
      var _fetchAll = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee6(ipfs, hashes) {
        var _ref3,
          _ref3$length,
          length,
          _ref3$exclude,
          exclude,
          shouldExclude,
          timeout,
          onProgressCallback,
          onStartProgressCallback,
          _ref3$concurrency,
          concurrency,
          _ref3$delay,
          delay,
          result,
          cache,
          loadingCache,
          loadingQueue,
          running,
          maxClock,
          minClock,
          loadingQueueHasMore,
          addToLoadingQueue,
          getNextFromQueue,
          addToExcludeCache,
          fetchEntry,
          _processQueue,
          _args6 = arguments;
        return _regenerator["default"].wrap(function _callee6$(_context6) {
          while (1) switch (_context6.prev = _context6.next) {
            case 0:
              _ref3 = _args6.length > 2 && _args6[2] !== undefined ? _args6[2] : {}, _ref3$length = _ref3.length, length = _ref3$length === void 0 ? -1 : _ref3$length, _ref3$exclude = _ref3.exclude, exclude = _ref3$exclude === void 0 ? [] : _ref3$exclude, shouldExclude = _ref3.shouldExclude, timeout = _ref3.timeout, onProgressCallback = _ref3.onProgressCallback, onStartProgressCallback = _ref3.onStartProgressCallback, _ref3$concurrency = _ref3.concurrency, concurrency = _ref3$concurrency === void 0 ? 32 : _ref3$concurrency, _ref3$delay = _ref3.delay, delay = _ref3$delay === void 0 ? 0 : _ref3$delay;
              result = [];
              cache = {};
              loadingCache = {};
              loadingQueue = Array.isArray(hashes) ? {
                0: hashes.slice()
              } : {
                0: [hashes]
              };
              running = 0; // keep track of how many entries are being fetched at any time
              maxClock = 0; // keep track of the latest clock time during load
              minClock = 0; // keep track of the minimum clock time during load
              shouldExclude = shouldExclude || function () {
                return false;
              }; // default fn returns false to not exclude any hash

              // Does the loading queue have more to process?
              loadingQueueHasMore = function loadingQueueHasMore() {
                return Object.values(loadingQueue).find(hasItems) !== undefined;
              }; // Add a multihash to the loading queue
              addToLoadingQueue = function addToLoadingQueue(e, idx) {
                if (!loadingCache[e] && !shouldExclude(e)) {
                  if (!loadingQueue[idx]) loadingQueue[idx] = [];
                  if (!loadingQueue[idx].includes(e)) {
                    loadingQueue[idx].push(e);
                  }
                  loadingCache[e] = true;
                }
              }; // Get the next items to process from the loading queue
              getNextFromQueue = function getNextFromQueue() {
                var length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
                var getNext = function getNext(res, key, idx) {
                  var nextItems = loadingQueue[key];
                  while (nextItems.length > 0 && res.length < length) {
                    var hash = nextItems.shift();
                    res.push(hash);
                  }
                  if (nextItems.length === 0) {
                    delete loadingQueue[key];
                  }
                  return res;
                };
                return Object.keys(loadingQueue).reduce(getNext, []);
              }; // Add entries that we don't need to fetch to the "cache"
              addToExcludeCache = function addToExcludeCache(e) {
                cache[e.hash || e] = true;
              }; // Fetch one entry and add it to the results
              fetchEntry = /*#__PURE__*/function () {
                var _ref4 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(hash) {
                  return _regenerator["default"].wrap(function _callee4$(_context4) {
                    while (1) switch (_context4.prev = _context4.next) {
                      case 0:
                        if (!(!hash || cache[hash] || shouldExclude(hash))) {
                          _context4.next = 2;
                          break;
                        }
                        return _context4.abrupt("return");
                      case 2:
                        return _context4.abrupt("return", new Promise( /*#__PURE__*/function () {
                          var _ref5 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3(resolve, reject) {
                            var timer, addToResults, entry, sleep;
                            return _regenerator["default"].wrap(function _callee3$(_context3) {
                              while (1) switch (_context3.prev = _context3.next) {
                                case 0:
                                  // Resolve the promise after a timeout (if given) in order to
                                  // not get stuck loading a block that is unreachable
                                  timer = timeout && timeout > 0 ? setTimeout(function () {
                                    console.warn("Warning: Couldn't fetch entry '".concat(hash, "', request timed out (").concat(timeout, "ms)"));
                                    resolve();
                                  }, timeout) : null;
                                  addToResults = function addToResults(entry) {
                                    if (isEntry(entry) && !cache[entry.hash] && !shouldExclude(entry.hash)) {
                                      var ts = entry.clock.time;

                                      // Update min/max clocks
                                      maxClock = Math.max(maxClock, ts);
                                      minClock = result.length > 0 ? Math.min(result[result.length - 1].clock.time, minClock) : maxClock;
                                      var isLater = result.length >= length && ts >= minClock;
                                      var calculateIndex = function calculateIndex(idx) {
                                        return maxClock - ts + (idx + 1) * idx;
                                      };

                                      // Add the entry to the results if
                                      // 1) we're fetching all entries
                                      // 2) results is not filled yet
                                      // the clock of the entry is later than current known minimum clock time
                                      if ((length < 0 || result.length < length || isLater) && !shouldExclude(entry.hash) && !cache[entry.hash]) {
                                        result.push(entry);
                                        cache[entry.hash] = true;
                                        if (onProgressCallback) {
                                          onProgressCallback(entry);
                                        }
                                      }
                                      if (length < 0) {
                                        // If we're fetching all entries (length === -1), adds nexts and refs to the queue
                                        entry.next.forEach(addToLoadingQueue);
                                        if (entry.refs) entry.refs.forEach(addToLoadingQueue);
                                      } else {
                                        // If we're fetching entries up to certain length,
                                        // fetch the next if result is filled up, to make sure we "check"
                                        // the next entry if its clock is later than what we have in the result
                                        if (result.length < length || ts > minClock || ts === minClock && !cache[entry.hash] && !shouldExclude(entry.hash)) {
                                          entry.next.forEach(function (e) {
                                            return addToLoadingQueue(e, calculateIndex(0));
                                          });
                                        }
                                        if (entry.refs && result.length + entry.refs.length <= length) {
                                          entry.refs.forEach(function (e, i) {
                                            return addToLoadingQueue(e, calculateIndex(i));
                                          });
                                        }
                                      }
                                    }
                                  };
                                  if (onStartProgressCallback) {
                                    onStartProgressCallback(hash, null, 0, result.length);
                                  }
                                  _context3.prev = 3;
                                  _context3.next = 6;
                                  return fromMultihash(ipfs, hash);
                                case 6:
                                  entry = _context3.sent;
                                  if (!(delay > 0)) {
                                    _context3.next = 11;
                                    break;
                                  }
                                  sleep = function sleep() {
                                    var ms = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
                                    return new Promise(function (resolve) {
                                      return setTimeout(resolve, ms);
                                    });
                                  };
                                  _context3.next = 11;
                                  return sleep(delay);
                                case 11:
                                  // Add it to the results
                                  addToResults(entry);
                                  resolve();
                                  _context3.next = 18;
                                  break;
                                case 15:
                                  _context3.prev = 15;
                                  _context3.t0 = _context3["catch"](3);
                                  reject(_context3.t0);
                                case 18:
                                  _context3.prev = 18;
                                  clearTimeout(timer);
                                  return _context3.finish(18);
                                case 21:
                                case "end":
                                  return _context3.stop();
                              }
                            }, _callee3, null, [[3, 15, 18, 21]]);
                          }));
                          return function (_x8, _x9) {
                            return _ref5.apply(this, arguments);
                          };
                        }()));
                      case 3:
                      case "end":
                        return _context4.stop();
                    }
                  }, _callee4);
                }));
                return function fetchEntry(_x7) {
                  return _ref4.apply(this, arguments);
                };
              }(); // One loop of processing the loading queue
              _processQueue = /*#__PURE__*/function () {
                var _ref6 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee5() {
                  var nexts;
                  return _regenerator["default"].wrap(function _callee5$(_context5) {
                    while (1) switch (_context5.prev = _context5.next) {
                      case 0:
                        if (!(running < concurrency)) {
                          _context5.next = 6;
                          break;
                        }
                        nexts = getNextFromQueue(concurrency);
                        running += nexts.length;
                        _context5.next = 5;
                        return (0, _pMap["default"])(nexts, fetchEntry, {
                          concurrency: concurrency
                        });
                      case 5:
                        running -= nexts.length;
                      case 6:
                      case "end":
                        return _context5.stop();
                    }
                  }, _callee5);
                }));
                return function _processQueue() {
                  return _ref6.apply(this, arguments);
                };
              }(); // Add entries to exclude from processing to the cache before we start
              exclude.forEach(addToExcludeCache);

              // Fetch entries
              _context6.next = 18;
              return (0, _pDoWhilst["default"])(_processQueue, loadingQueueHasMore);
            case 18:
              return _context6.abrupt("return", result);
            case 19:
            case "end":
              return _context6.stop();
          }
        }, _callee6);
      }));
      function fetchAll(_x5, _x6) {
        return _fetchAll.apply(this, arguments);
      }
      return fetchAll;
    }()
  }]);
  return EntryIO;
}();
var _default = EntryIO;
exports["default"] = _default;