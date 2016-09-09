# cloud-cache

[![Build Status](https://travis-ci.org/blockai/cloud-cache.svg?branch=master)](https://travis-ci.org/blockai/cloud-cache)

Node.js caching library with pluggable backing store via
[abstract-blob-store](https://github.com/maxogden/abstract-blob-store).
[Streaming support](#stream-api) makes it particularly useful for
caching larger values like resized/cropped images or transcoded videos.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
  - [Setting up the client](#setting-up-the-client)
  - [Promise API](#promise-api)
  - [Stream API](#stream-api)
    - [Error Handling](#error-handling)
  - [Errors](#errors)
- [How it works](#how-it-works)
- [TODO](#todo)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Features

- [Promise](#promise-api) and [Stream](#stream-api) based APIs
- Supported backing stores:
  - [AWS S3](https://github.com/jb55/s3-blob-store)
  - [Google Cloud Storage](https://github.com/maxogden/google-cloud-storage)
  - [Azure Storage](https://github.com/svnlto/azure-blob-store)
  - [LevelDB](https://github.com/diasdavid/level-blob-store)
  - [PostgreSQL](https://github.com/finnp/postgres-blob-store)
  - [Local file system](https://github.com/mafintosh/fs-blob-store)
  - [IPFS](https://github.com/ipfs/ipfs-blob-store)
  - [etc.](https://github.com/maxogden/abstract-blob-store)
- Supported data types:
  - Buffer
  - JSON types
    - Number
    - String
    - Boolean
    - Array
    - Object

## Install

```bash
npm install --save cloud-cache
```

Requires Node v6+

## Usage

See [./test](./test) directory for usage examples.

### Setting up the client

```javascript
import cloudCache from 'cloud-cache'
const cache = cloudCache(blobStore [, opts])
```

* `blobStore`: **blobStore** [abstract-blob-store](https://www.npmjs.com/package/abstract-blob-store) instance
* `opts.keyPrefix`: **String** `cloudcache/` global key prefix that will be automatically prepended to all keys

### Promise API

All methods return [promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).

**cache.get(key)** Get a key.

* `key`: **String** the key to get

Throws a `KeyNotExistsError` error if the key doesn't exist or value has
expired.

```javascript
cache.get('key')
```

**cache.set(key, value [, opts])** Stores a new value in the cache.

* `key`: **String** the key to set
* `value`: **Mixed** Buffer or any JSON compatible value.
* `opts.ttl`: **Number**, `Infinity` Time to live: how long the data needs to be stored measured in `seconds`

```javascript
cache.set('foo', 'bar', { ttl: 60 * 60 })
```

**cache.del(key)** Delete a key.

* `key`: **String** the key to delete

```javascript
cache.del('key')
```

**cache.getOrSet(key, getValueFn [, opts])** Returns cached value, storing and returning value on cache misses.

* `key`: **String** the key to get
* `getValueFn`: **Function** function to evaluate on cache misses
* `opts`: **Object** same as `cache.set`
* `opts.refresh`: **Boolean** `false` forces a cache miss

The arguments are the same as **cache.set**, except that `value` must be
a **function** or a **promise returning function** that evaluates / resolves
to a valid **cache.set** value. The function will only be evaluated on cache misses.

```javascript
cache.getOrSet('google.com', () => (
  fetch('http://google.com/').then(body => body.text())
))
```

### Stream API

**cache.getStream(key)**

* `key`: **String** the key to read

Returns a Readable Stream.

Emits a `KeyNotExistsError` error if the key doesn't exist or value has
expired.

Alias: `cache.gets(key)`

```javascript
cache.getStream('olalonde/avatar.png').pipe(req)
```

**cache.setStream(key [, opts])**

* `key`: **String** the key to set
* `opts`: **Object** same as `cache.set`

Returns a Writable Stream.

Alias: `cache.sets(key)`

```javascript
resizeImage('/tmp/avatar.png').pipe(cache.setStream('olalonde/avatar.png'))
```

**cache.getOrSetStream(key, getStreamFn [, opts])**

* `key`: **String** the key to get
* `getStreamFn`: **Function** Read Stream returning function that will
    be called on cache misses.
* `opts`: **Object** same as `cache.getOrSet`

Returns a Readable Stream.

Important:

- The stream returned by `getStreamFn` might not be cached if the
    returned read stream is not fully consumed (e.g. by piping it).
- A `finish` event is fired to indicate that the stream was completely
    saved to the cache.

```javascript
cache.getOrSetStream('olalonde/avatar.png', () => resizeImage('/tmp/avatar.png')).pipe(req)
```

#### Error Handling

The streams returned by cache may emit `error` events. We recommend
using [pipe() from the mississippi module](https://github.com/maxogden/mississippi#pipe)
to avoid unhandled errors and make sure the cache stream closes properly
if the destination has an error.

e.g.:

```javascript
import { pipe } from 'mississippi'
// ...
pipe(cache.getOrSetStream('key', getReadStream), req, (err) => {
  if (err) return next(err)
})
```

### Errors

- `CloudCacheError` this base class is inherited by the errors below
- `KeyNotExistsError` thrown/emitted when trying to get a non existent / expired key. Exposes a `key` property

The error classes can be accessed through import or as a property on the cache object,
e.g.:

```javascript
import { CloudCacheError, KeyNotExistsError } from 'cloud-cache'
// ...
cache.CloudCacheError === CloudCacheError // true
cache.KeyNotExistsError === KeyNotExistsError // true
KeyNotExistsError instanceof CloudCacheError // true
```

## How it works

Cloud-cache encodes each cached value as a file stored on a storage
provider (S3, file system, etc.). The files start with a small JSON
header which contains metadata (e.g. `creation time, ttl, data type,
etc.`), followed by a newline character (`\n`)  and finally, the actual
cached value. Values are encoded as JSON, except for buffers or streams
which are stored as raw bytes.

This means that cached values aren't very useful to applications which
are unaware of the header.

If you are caching transformed images to S3 for example, you couldn't
reference the S3 URL directly from an HTML image tag for example
(because the browser wouldn't know it needs to ignore everything before
the first newline character).

You could however serve the images from a Node.js HTTP server and use
the stream API to stream the image from S3 (e.g.
`cache.gets('olalonde/avatar.png').pipe(res)`).

Cloud-cache evicts expired values on read which means that expired
values will remain stored as long as they are not read.

## TODO

- Detect/correct partial writes?
