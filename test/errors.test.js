import test from 'blue-tape'
// import fs from 'fs'
import { Readable } from 'stream'
// import concat from 'concat-stream'

import getCloudCache from './utils'

const cache = getCloudCache('errors')

class BrokenReadStream extends Readable {
  constructor() {
    super()
    this._readCounter = 0
  }
  _read() {
    this._readCounter++
    const i = this._readCounter
    process.nextTick(() => {
      if (i === 3) {
        this.emit('error', new Error('simulated error'))
        return
      }
      this.push(Buffer.from(`test ${i}`))
    })
  }
}

const brokenRs = new BrokenReadStream()

test('cache.sets, reader emits error', (t) => {
  brokenRs
    .on('error', (err) => {
      t.equal(err.message, 'simulated error')
      t.end()
    })
    .pipe(cache.sets('broken-read-stream'))
    .on('finish', t.fail)
})

// ONLY SUPPORTED IF STORE SUPPORTS ATOMICITY
if (['s3'].includes(process.env.STORE || 'fs')) {
  test('cache.gets, previous value was not cached', (t) => (
    cache.get('broken-read-stream')
      .then(() => t.fail())
      .catch((err) => {
        t.equal(err.name, 'KeyNotExistsError')
      })
  ))
}
