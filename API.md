# ipfs-log - API Documentation

# Log

To use `ipfs-log`, require the module in your project:

```javascript
const Log = require('ipfs-log')
```

### Constructor

#### new Log(ipfs, identity, [{ logId, access, entries, heads, clock, sortFn, hashIndex }])

Create a log. Each log gets a unique ID, which can be passed in the `options` as `logId`. Returns a `Log` instance.

```javascript
const IdentityProvider = require('orbit-db-identity-provider')
const identity = await IdentityProvider.createIdentity({ id: 'peerid' })
const ipfs = new IPFS()
const log = new Log(ipfs, identity, { logId: 'logid' })

console.log(log.id)
// 'logId'
```

`ipfs` is an instance of IPFS. `identity` is an instance of [Identity](https://github.com/orbitdb/orbit-db-identity-provider/blob/master/src/identity.js), used to sign entries. `logId` is a unique log identifier. Usually this should be a user id or similar. `access` is an instance of `AccessController`, which by default allows any one to append to the log.

### Properties

#### id

Returns the ID of the log.

#### length

Returns the number of entries in the log.

#### clock

Returns the current timestamp of the log.

#### heads

Returns the heads of the log. Heads are the entries that are not referenced by other entries in the log.

```javascript
const heads = log.heads
// TODO: output example
```

### Methods

#### values

Returns a *Promise* that resolves to an `Array` of [entries](https://github.com/orbitdb/ipfs-log/blob/master/src/entry.js) in the log. The values are in linearized order according to their [Lamport clocks](https://en.wikipedia.org/wiki/Lamport_timestamps).

```javascript
const values = await log.values()
// TODO: output example
```

#### tails

Returns a *Promise* that resolves to the tails of the log. Tails are the entries that reference other entries that are not in the log.

```javascript
const tails = await log.tails()
// TODO: output example
```

#### append(data)

Append an entry to the log. Returns a *Promise* that resolves to the latest `Entry`.

`ipfs` IPFS instance.

`log` Log to append to.

`data` can be any type of data: Number, String, Object, etc. It can also be an instance of [Entry](https://github.com/orbtidb/ipfs-log/blob/master/src/entry.js).

```javascript
await log.append({ some: 'data' })
await log.append('text'))
console.log(log.values)
// [
// { hash: 'zdpuArZdzymC6zRTMGd5xw4Dw2Q2VCYjuaHAekTSyXS1GmSKs',
//     id: 'logId',
//     payload: { some: 'data' },
//     next: [],
//     v: 1,
//     clock:
//      LamportClock {
//        id:
//         '04d1b23b1efe6c4d91cd639caf443528b88358369fa552fe8dd9cda17d6c77c42969c688ec0d201e3f8a128334a3b0806ece694b55892b036c0781ce18d35a374b',
//        time: 1 },
//     key:
//      '04d1b23b1efe6c4d91cd639caf443528b88358369fa552fe8dd9cda17d6c77c42969c688ec0d201e3f8a128334a3b0806ece694b55892b036c0781ce18d35a374b',
//     identity: ...
//   },
//   { hash: 'zdpuAuDmVuEfgcUja7SCuNuqkiLCPXVutFTkSE8k8b9oLCVcR',
//     id: 'logId',
//     payload: 'text',
//     next: [ 'zdpuArZdzymC6zRTMGd5xw4Dw2Q2VCYjuaHAekTSyXS1GmSKs' ],
//     v: 1,
//     clock:
//      LamportClock {
//        id:
//         '04d1b23b1efe6c4d91cd639caf443528b88358369fa552fe8dd9cda17d6c77c42969c688ec0d201e3f8a128334a3b0806ece694b55892b036c0781ce18d35a374b',
//        time: 2 },
//     key:
//      '04d1b23b1efe6c4d91cd639caf443528b88358369fa552fe8dd9cda17d6c77c42969c688ec0d201e3f8a128334a3b0806ece694b55892b036c0781ce18d35a374b',
//     identity:
//      { ... }
// ]
```

#### get(hash)

Returns a *Promise* that resolves to an entry if it exists, otherwise undefined.

```javascript
const entry = await get(hash)
```

#### has(hash)

Returns true if the hash exists in the log, otherwise false.

#### join(log, [length])

Join the log with another log. Returns a Promise that resolves to a `Log` instance. The size of the joined log can be specified by giving `length` argument.

```javascript
// log1.values ==> ['A', 'B', 'C']
// log2.values ==> ['C', 'D', 'E']

log1.join(log2)
  .then(() => console.log(log1.values))
// ['A', 'B', 'C', 'D', 'E']
```

### toMultihash({ format })

Returns the multihash of the log.

Converting the log to a multihash will persist the contents of `log.toJSON` to IPFS, thus causing side effects.

You can specify the `format` with which to write the content to IPFS. By default `dag-cbor` is used, returning a [CIDv1](https://github.com/multiformats/cid#how-does-it-work) string. To return a  CIDv0 string, set `format` to `dag-pb`.

```javascript
log1.toMultihash()
  .then(hash => console.log(hash))

// zdpuAsfLFPAYJ41C2bZYZCKZxGkYUD9Wt7mcXHWcR19Jjko9B

log1.toMultihash({format: 'dag-pb' })
  .then(hash => console.log(hash))

// QmR8rV2Ph2yUaw7eW7e86TZF4XDjb13QbPAN83YEpYHxiw
```

### toBuffer()

Converts the log to a `Buffer` that contains the log as JSON.stringified `string`. Returns a `Buffer`.

```javascript
const buffer = log1.toBuffer()
```

### toString

Returns a *Promise* that resolves to the log values as a nicely formatted string.

```javascript
console.log(log.toString())
// two
// └─one
//   └─three
```

## Static methods

#### Log.isLog(log)

Check if an object is a `Log` instance.

```javascript
Log.isLog(log1)
// true
Log.isLog('hello')
// false
```

#### Log.fromEntry(ipfs, identity, sourceEntries, [{ access, length=-1, exclude, onProgressCallback, sortFn }])

Create a `Log` from an `Entry`.

Creating a log from an entry will retrieve entries from IPFS, thus causing side effects.

#### Log.fromEntryHash(ipfs, identity, hash, [{ logId, length=-1, access, exclude, onProgressCallback, sortFn }])

Create a `Log` from a hash of an `Entry`

Creating a log from a hash will retrieve entries from IPFS, thus causing side effects.

#### Log.fromMultihash(ipfs, identity, hash, [{ access, length=-1, exclude, onProgressCallback, sortFn }])

Create a `Log` from a hash.

Creating a log from a hash will retrieve entries from IPFS, thus causing side effects.
