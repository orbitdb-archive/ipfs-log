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
var AccessController = /*#__PURE__*/function () {
  function AccessController() {
    (0, _classCallCheck2["default"])(this, AccessController);
  }
  (0, _createClass2["default"])(AccessController, [{
    key: "canAppend",
    value: function () {
      var _canAppend = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(entry, identityProvider) {
        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              return _context.abrupt("return", true);
            case 1:
            case "end":
              return _context.stop();
          }
        }, _callee);
      }));
      function canAppend(_x, _x2) {
        return _canAppend.apply(this, arguments);
      }
      return canAppend;
    }()
  }]);
  return AccessController;
}();
var _default = AccessController;
exports["default"] = _default;