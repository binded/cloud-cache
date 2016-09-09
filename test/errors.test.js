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
  _read(size) {
    this._readCounter++
    process.nextTick(() => {
      if (this._readCounter === 3) {
        this.emit('error', new Error('simulated error'))
        return
      }
      this.push(Buffer.alloc(size, `${this._readCounter}`, 'ascii'))
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
    .on('close', t.fail)
    .on('finish', t.fail)
    .on('error', t.fail)
})

