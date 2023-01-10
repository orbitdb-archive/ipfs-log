# ipfs-log

[![npm](https://img.shields.io/npm/v/ipfs-log.svg)](https://www.npmjs.com/package/ipfs-log)
[![CircleCI Status](https://circleci.com/gh/orbitdb/ipfs-log.svg?style=shield)](https://circleci.com/gh/orbitdb/ipfs-log)
[![Gitter](https://img.shields.io/gitter/room/nwjs/nw.js.svg)](https://gitter.im/orbitdb/Lobby) [![Matrix](https://img.shields.io/badge/matrix-%23orbitdb%3Apermaweb.io-blue.svg)](https://riot.permaweb.io/#/room/#orbitdb:permaweb.io) 


> An append-only log on IPFS.

`ipfs-log` is an immutable, operation-based conflict-free replicated data structure ([CRDT](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)) for distributed systems. It's an append-only log that can be used to model a mutable, shared state between peers in p2p applications.

Every entry in the log is saved in IPFS and each points to a hash of previous entry(ies) forming a graph. Logs can be forked and joined back together.

The module works in **Node.js** and **Browsers**.

```
           Log A                Log B
             |                    |
     logA.append("one")   logB.append("hello")
             |                    |
             v                    v
          +-----+             +-------+
          |"one"|             |"hello"|
          +-----+             +-------+
             |                    |
     logA.append("two")   logB.append("world")
             |                    |
             v                    v
       +-----------+       +---------------+
       |"one","two"|       |"hello","world"|
       +-----------+       +---------------+
             |                    |
             |                    |
       logA.join(logB) <----------+
             |
             v
+---------------------------+
|"one","hello","two","world"|
+---------------------------+
```


## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Tests](#tests)
- [Benchmarking](#benchmarking)
- [Build](#build)
- [Contribute](#contribute)
- [License](#license)

## Background

IPFS Log has a few use cases:

- CRDTs
- Database operations log
- Feed of data
- Track a version of a file
- Messaging

It was originally created for, and currently used in, [orbit-db](https://github.com/orbitdb/orbit-db) - a distributed peer-to-peer database on [IPFS](https://github.com/ipfs/ipfs).

## Requirements

- Node.js v8.6.0 or newer (uses `...` spread syntax)
- Preferably you should use an LTS version of node.js (even numbered 8, 10, etc)

## Install

This project uses [npm](http://npmjs.com/) and [nodejs](https://nodejs.org/).

```
npm install ipfs-log
```

## Usage

See the [API documentation](#api) and [examples](https://github.com/orbitdb/ipfs-log/tree/master/examples) for more details.

### Quick Start

Install dependencies:

```
npm install ipfs-log ipfs
```

Run a simple program:

```javascript

// For js-ipfs >= 0.38

import from Log 'ipfs-log'
import IdentityProvider from 'orbit-db-identity-provider'
import * as IPFS from 'ipfs'

const start = async () => {
  const identity = await IdentityProvider.createIdentity({ id: "peerid" })
  const ipfs = await IPFS.create({ repo: "./path-for-js-ipfs-repo" })
  const log = new Log(ipfs, identity)

  await log.append({ some: "data" })
  await log.append("text")
  console.log(log.values.map((e) => e.payload))
}

start()

// [ { some: 'data' }, 'text' ]
```

### Node.js

See [examples](https://github.com/orbitdb/ipfs-log/tree/master/examples) for details.

*If your platforms requires ES5-compatible JavaScript, there's a build in `lib/es5/`.*

### Browser

See [examples/browser](https://github.com/orbitdb/ipfs-log/tree/master/examples/browser) for details.

*The distribution package for browsers is located in [dist/ipfslog.min.js](https://github.com/orbitdb/ipfs-log/tree/master/dist)*

*If your platforms requires ES5-compatible JavaScript, there's a build in `lib/es5/`.*

## API

See [API Documentation](https://github.com/orbitdb/ipfs-log/tree/master/API.md) for full details.

- [Log](https://github.com/orbitdb/ipfs-log/tree/master/API.md#log)
  - [Constructor](https://github.com/orbitdb/ipfs-log/tree/master/API.md##constructor)
    - [new Log(ipfs, identity, [{ logId, access, entries, heads, clock, sortFn }])](https://github.com/orbitdb/ipfs-log/tree/master/API.md##new-log-ipfs-id)
  - [Properties](https://github.com/orbitdb/ipfs-log/tree/master/API.md##properties)
    - [id](https://github.com/orbitdb/ipfs-log/tree/master/API.md##id)
    - [values](https://github.com/orbitdb/ipfs-log/tree/master/API.md##values)
    - [length](https://github.com/orbitdb/ipfs-log/tree/master/API.md##length)
    - [clock](https://github.com/orbitdb/ipfs-log/tree/master/API.md##length)
    - [heads](https://github.com/orbitdb/ipfs-log/tree/master/API.md##heads)
    - [tails](https://github.com/orbitdb/ipfs-log/tree/master/API.md##tails)
  - [Methods](https://github.com/orbitdb/ipfs-log/tree/master/API.md##methods)
    - [append(data)](https://github.com/orbitdb/ipfs-log/tree/master/API.md##appenddata)
    - [join(log)](https://github.com/orbitdb/ipfs-log/tree/master/API.md##joinlog)
    - [toMultihash()](https://github.com/orbitdb/ipfs-log/tree/master/API.md##tomultihash)
    - [toBuffer()](https://github.com/orbitdb/ipfs-log/tree/master/API.md##tobuffer)
    - [toString()](https://github.com/orbitdb/ipfs-log/tree/master/API.md##toString)
  - [Static Methods](https://github.com/orbitdb/ipfs-log/tree/master/API.md##static-methods)
    - [Log.fromEntry()]()
    - [Log.fromEntryCid()]()
    - [Log.fromCID()]()
    - [Log.fromMultihash()]()

## Tests

Run all tests:
```
npm test
```

Run tests with js-ipfs only (default):
```
mocha
```

Run tests with go-ipfs only:
```
TEST=go mocha
```

## Benchmarking

To use the benchmark runner:

```JavaScript
node --expose-gc benchmarks/runner/index.js -r --grep append-stress --stress-limit Infinity
```

This will run the `append-stress` benchmarks until it is canceled. For more information, see the [Benchmarking README](./benchmarks/README.md).

## Build

Run the following command before you commit.

```
make rebuild
```

This will ensure that dependencies and built files are all based on the current code base.

## Benchmarks

There's a benchmark suite in [benchmarks/](https://github.com/orbitdb/ipfs-log/blob/master/benchmarks) that can be run with:

```
node benchmarks/benchmark-append.js
node benchmarks/benchmark-join.js
node benchmarks/benchmark-expand.js
```

There's `append` and `join` benchmarks for browsers in [benchmarks/browser/](https://github.com/orbitdb/ipfs-log/blob/master/benchmarks/browser) which you can run by opening the `.html` files in your browser.

## Contribute

If you find a bug or something is broken, let us know! PRs and [issues](https://github.com/orbitdb/ipfs-log/issues) are gladly accepted too. Take a look at the open issues, too, to see if there is anything that you could do or someone else has already done. Here are some things I know I need:

### TODO

- Support for payload encryption

## License

[MIT](LICENSE) © 2016-2018 Protocol Labs Inc.,
2016-2019 Haja Networks Oy
