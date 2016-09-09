import { Writable } from 'stream'

const SIGNAL_LAST_WRITE = new Buffer([0])

/**
 * Wraps a write stream and waits until stream.unblock([err]) has been called
 * before ending and emitting the 'finish' event.
 */
export default class extends Writable {
  constructor(dest) {
    super()
    this.dest = dest
    this.blockingState = {
      blocked: true,
      err: null,
      cb: false,
    }
  }

  _write(chunk, encoding, cb) {
    if (chunk === SIGNAL_LAST_WRITE) return this._lastWrite(cb)
    this.dest.write(chunk, encoding, cb)
  }

  _lastWrite(cb) {
    const { blockingState } = this
    this.dest.end((err) => {
      if (err) return cb(err)
      if (blockingState.blocked) {
        blockingState.cb = cb
      } else {
        cb(blockingState.err)
      }
    })
  }

  unblock(err) {
    const { blockingState } = this
    if (blockingState.cb) return blockingState.cb(err)
    blockingState.blocked = false
    blockingState.err = err
  }

  end(data, enc, cb) {
    if (typeof data === 'function') return this.end(null, null, data)
    if (typeof enc === 'function') return this.end(data, null, enc)
    if (data) this.write(data)
    this.write(SIGNAL_LAST_WRITE)
    super.end(cb)
  }
}
