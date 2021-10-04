"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var CID = require('cids');

var dagPB = require('ipld-dag-pb');

var pify = require('pify');

var createPbDagNode = pify(dagPB.DAGNode.create);

var cidToCborLink = function cidToCborLink(cid) {
  if (!cid) {
    return cid;
  }

  if (Array.isArray(cid)) {
    return cid.map(cidToCborLink);
  }

  return {
    '/': cid
  };
};

var stringifyCid = function stringifyCid(cid) {
  if (!cid) {
    return cid;
  }

  if (Array.isArray(cid)) {
    return cid.map(stringifyCid);
  }

  return cid.toString();
};

var writePb =
/*#__PURE__*/
function () {
  var _ref = (0, _asyncToGenerator2.default)(
  /*#__PURE__*/
  _regenerator.default.mark(function _callee(ipfs, obj) {
    var buffer, dagNode, cid;
    return _regenerator.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            buffer = Buffer.from(JSON.stringify(obj));
            _context.next = 3;
            return createPbDagNode(buffer);

          case 3:
            dagNode = _context.sent;
            _context.next = 6;
            return ipfs.dag.put(dagNode, {
              format: 'dag-pb',
              hashAlg: 'sha2-256'
            });

          case 6:
            cid = _context.sent;
            return _context.abrupt("return", cid.toV0().toString());

          case 8:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function writePb(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();

var readPb =
/*#__PURE__*/
function () {
  var _ref2 = (0, _asyncToGenerator2.default)(
  /*#__PURE__*/
  _regenerator.default.mark(function _callee2(ipfs, cid) {
    var result, dagNode;
    return _regenerator.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return ipfs.dag.get(cid);

          case 2:
            result = _context2.sent;
            dagNode = result.value;
            return _context2.abrupt("return", JSON.parse(dagNode.toJSON().data));

          case 5:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  return function readPb(_x3, _x4) {
    return _ref2.apply(this, arguments);
  };
}();

var writeCbor =
/*#__PURE__*/
function () {
  var _ref3 = (0, _asyncToGenerator2.default)(
  /*#__PURE__*/
  _regenerator.default.mark(function _callee3(ipfs, obj, links) {
    var dagNode, cid;
    return _regenerator.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            dagNode = Object.assign({}, obj);
            links.forEach(function (prop) {
              dagNode[prop] = cidToCborLink(dagNode[prop]);
            });
            _context3.next = 4;
            return ipfs.dag.put(dagNode);

          case 4:
            cid = _context3.sent;
            return _context3.abrupt("return", cid.toString());

          case 6:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  return function writeCbor(_x5, _x6, _x7) {
    return _ref3.apply(this, arguments);
  };
}();

var readCbor =
/*#__PURE__*/
function () {
  var _ref4 = (0, _asyncToGenerator2.default)(
  /*#__PURE__*/
  _regenerator.default.mark(function _callee4(ipfs, cid, links) {
    var result, obj;
    return _regenerator.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _context4.next = 2;
            return ipfs.dag.get(cid);

          case 2:
            result = _context4.sent;
            obj = result.value;
            links.forEach(function (prop) {
              obj[prop] = stringifyCid(obj[prop]);
            });
            return _context4.abrupt("return", obj);

          case 6:
          case "end":
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  return function readCbor(_x8, _x9, _x10) {
    return _ref4.apply(this, arguments);
  };
}();

var formats = {
  'dag-pb': {
    read: readPb,
    write: writePb
  },
  'dag-cbor': {
    write: writeCbor,
    read: readCbor
  }
};

var write = function write(ipfs, codec, obj, links) {
  var format = formats[codec];
  if (!format) throw new Error('Unsupported codec');
  return format.write(ipfs, obj, links);
};

var read = function read(ipfs, cid, links) {
  cid = new CID(cid);
  var format = formats[cid.codec];
  if (!format) throw new Error('Unsupported codec');
  return format.read(ipfs, cid, links);
};

module.exports = {
  read: read,
  write: write
};
