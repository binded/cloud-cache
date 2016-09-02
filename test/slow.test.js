import test from 'blue-tape'
import request from 'request'

import getCloudCache from './utils'

const cache = getCloudCache('slow')

test('issue #1', (t) => {
  const getBody = (url) => new Promise((resolve, reject) => {
    request({
      url,
      encoding: null,
    }, (err, res, body) => {
      if (err) {
        return reject(err)
      }
      resolve(body)
    })
  })

  const url = 'https://raw.githubusercontent.com/maxogden/abstract-blob-store/master/badge.png'
  let firstBody
  let secondBody
  let callCount = 0

  const getOrSet = () => cache.getOrSet('badge', () => {
    callCount++
    return getBody(url)
  })

  return getOrSet()
    .then((body) => {
      firstBody = body
    })
    .then(() => getOrSet())
    .then((body) => {
      secondBody = body
    })
    .then(() => {
      t.ok(Buffer.isBuffer(firstBody))
      t.ok(Buffer.isBuffer(secondBody))
      t.equal(callCount, 1)
      t.deepEqual(firstBody, secondBody)
    })
})
