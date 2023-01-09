"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NotALogError = exports.LtOrLteMustBeStringOrArray = exports.LogNotDefinedError = exports.IPFSNotDefinedError = exports.CannotJoinWithDifferentId = void 0;
var IPFSNotDefinedError = function IPFSNotDefinedError() {
  return new Error('IPFS instance not defined');
};
exports.IPFSNotDefinedError = IPFSNotDefinedError;
var LogNotDefinedError = function LogNotDefinedError() {
  return new Error('Log instance not defined');
};
exports.LogNotDefinedError = LogNotDefinedError;
var NotALogError = function NotALogError() {
  return new Error('Given argument is not an instance of Log');
};
exports.NotALogError = NotALogError;
var CannotJoinWithDifferentId = function CannotJoinWithDifferentId() {
  return new Error('Can\'t join logs with different IDs');
};
exports.CannotJoinWithDifferentId = CannotJoinWithDifferentId;
var LtOrLteMustBeStringOrArray = function LtOrLteMustBeStringOrArray() {
  return new Error('lt or lte must be a string or array of Entries');
};
exports.LtOrLteMustBeStringOrArray = LtOrLteMustBeStringOrArray;