import { PassThrough } from 'stream'
import BlockingWritable from './blocking-writable'

/**
 * asbtract-blob-store's API requires waiting for a callback on writes.
 *
 * Cloud-cache however does not have this requirement and instead uses a pure
 * sync streaming/event API. Since we cannot rely on abstract-blob-store's
 * 'finish' events, we must wait for the callback before our own write stream
 * ends and emits 'finish'.
 */
export default (store, key, cb) => {
  // go to normal mode with callback
  if (typeof cb === 'function') return store.createWriteStream(key, cb)
  // no call back mode...

  const through = new PassThrough()
  const ws = new BlockingWritable(through)

  through.pipe(store.createWriteStream(key, (err) => {
    ws.unblock(err)
  }))

  return ws
}
