import initDebug from 'debug'
import duplexify from 'duplexify'
import { PassThrough } from 'stream'

import { getType } from './types'
import { readMetadata, writeMetadata, readValue, writeValue } from './metadata'
import * as errors from './errors'

const { KeyNotExistsError, CloudCacheError } = errors

const emptyBuf = Buffer.from([])

export { KeyNotExistsError, CloudCacheError }

const debug = initDebug('cloud-cache')

const isExpired = (metadata) => {
  const { ttl, createdAt } = metadata
  // TODO: make sure there is no timezone issue
  if (!Number.isInteger(ttl)) return false
  const age = Date.now() - createdAt
  return age > ttl
}

export default (store, {
  keyPrefix = 'cloud-cache/',
} = {}) => {
  debug('init cache')

  const fullKey = (key) => `${keyPrefix}${key}`

  const exists = (key) => new Promise((resolve, reject) => {
    store.exists(fullKey(key), (err, keyExists) => {
      if (err) return reject(err)
      resolve(keyExists)
    })
  })

  const throwIfNotExists = (key) => exists(key).then((keyExists) => {
    if (!keyExists) throw new KeyNotExistsError(key)
  })

  // idempotent
  const del = (key) => new Promise((resolve, reject) => {
    store.remove(fullKey(key), (err) => {
      if (err) return reject(err)
      resolve()
    })
  })

  // TODO: We could do an optimistic read and only call exists() on error
  const get = (key, { stream = false } = {}) => throwIfNotExists(key).then(() => {
    const readStream = store.createReadStream(fullKey(key))
    return readMetadata(readStream)
      .then((metadata) => {
        // delete key if expired and throw KeyNotExists error
        if (isExpired(metadata)) {
          return del(key).then(() => {
            const err = new KeyNotExistsError(key)
            err.expired = true
            throw err
          })
        }
        if (stream) {
          // TODO: warning if metadata.type !== 'buffer' ?
          return readStream
        }
        return readValue(readStream, metadata.type)
      })
  })

  const set = (key, value, {
    ttl = Infinity,
    stream = false,
  } = {}) => new Promise((resolve, reject) => {
    const type = getType(stream ? emptyBuf : value)
    const metadata = {
      type: type.name,
      ttl: ttl * 1000, // convert to milliseconds
      createdAt: Date.now(),
    }
    const writeStream = store.createWriteStream(fullKey(key), (err) => {
      if (stream) return
      if (err) return reject(err)
      resolve()
    })

    writeMetadata(metadata, writeStream)
      .then(() => {
        if (stream) {
          return resolve(writeStream)
        }
        return writeValue(writeStream, value)
      })
      .catch(reject)
  })

  const getOrSet = (key, fn, opts) => get(key)
    .catch((err) => {
      if (!(err instanceof KeyNotExistsError)) throw err
      // evaluate function as promise
      return Promise.resolve().then(() => fn())
        .then((value) => set(key, value, opts).then(() => value))
    })

  // Streaming API
  const getStream = (key) => {
    const proxy = duplexify()
    get(key, { stream: true })
      .then((rs) => {
        proxy.setReadable(rs)
      })
      .catch((err) => {
        proxy.destroy(err)
      })
    return proxy
  }

  const setStream = (key, opts = {}) => {
    const proxy = duplexify()
    set(key, null, { ...opts, stream: true })
      .then((ws) => {
        proxy.setWritable(ws)
      })
      .catch((err) => {
        proxy.destroy(err)
      })
    return proxy
  }

  const getOrSetStream = (key, getStreamFn, opts = {}) => {
    const proxy = duplexify()
    const onError = (err) => {
      proxy.destroy(err)
    }
    get(key, { stream: true })
      .then((rs) => {
        proxy.setReadable(rs)
      })
      .catch((err) => {
        if (err instanceof KeyNotExistsError) {
          Promise.resolve().then(() => getStreamFn()).then((rs) => {
            const ws = setStream(key, opts)
            const through = new PassThrough()
            proxy.setReadable(through)
            rs.pipe(through)
            rs.pipe(ws)
          })
          return
        }
        onError(err)
      })
    return proxy
  }

  return {
    get,
    set,
    del,
    getOrSet,
    getStream,
    setStream,
    getOrSetStream,
    gets: getStream,
    sets: setStream,
    getOrSets: getOrSetStream,
    ...errors,
  }
}
