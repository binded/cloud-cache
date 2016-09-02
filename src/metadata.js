import concat from 'concat-stream'
import { getTypeByName, getType } from './types'

// todo: prefix metadata with magic hex string to throw error if invalid
// format?

// Reads metadata header from stream and returns metadata object and a stream
// which starts immediately after the header
export const readMetadata = (readStream) => new Promise((resolve, reject) => {
  const rs = readStream
  let header = ''
  const onReadable = () => {
    let chunk
    /* eslint-disable no-cond-assign */
    while ((chunk = rs.read()) !== null) {
      const str = chunk.toString()
      const match = str.match(/\n/)
      if (match) {
        rs.removeListener('readable', onReadable)
        // found the header boundary
        const split = str.split(/\n/)
        header += split.shift()
        const remaining = chunk.slice(match.index + '\n'.length)
        if (remaining.length) {
          rs.unshift(remaining)
        }
        // now the body of the message can be read from the stream.
        let metadata
        try {
          metadata = JSON.parse(header)
        } catch (err) {
          return reject(err)
        }
        return resolve(metadata)
      }
      // still reading the header.
      header += str
    }
  }
  rs.once('error', reject)
  rs.on('readable', onReadable)
})

// Write metadata to stream
export const writeMetadata = (metadata, writeStream) => new Promise((resolve, reject) => {
  let metadataStr
  try {
    metadataStr = JSON.stringify(metadata)
  } catch (err) {
    return reject(err)
  }
  writeStream.write(`${metadataStr}\n`, 'utf8')
  resolve()
})

export const readValue = (readStream, type) => new Promise((resolve) => {
  readStream.pipe(concat((buf) => {
    resolve(getTypeByName(type).decode(buf))
  }))
})

export const writeValue = (writeStream, value) => new Promise((resolve, reject) => {
  try {
    writeStream.end(getType(value).encode(value))
    resolve()
  } catch (err) {
    reject(err)
  }
})

