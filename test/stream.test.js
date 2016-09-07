import test from 'blue-tape'
import fs from 'fs'
import concat from 'concat-stream'

import getCloudCache from './utils'

const cache = getCloudCache('stream')

const poemPath = `${__dirname}/files/poem.txt`
const poem = () => fs.createReadStream(poemPath)
const poemStr = fs.readFileSync(poemPath)
// const devnull = () => fs.createWriteStream('/dev/null')

test('cache.sets', (t) => {
  poem().pipe(cache.sets('poem')).on('finish', () => {
    t.end()
  })
})

test('cache.gets', (t) => {
  cache
    .gets('poem')
    .on('error', t.fail)
    .pipe(concat((str) => {
      t.equal(str.toString(), poemStr.toString())
      t.end()
    }))
})

test('cache.getOrSets', (t) => {
  let callCount = 0
  const getPoemStream = () => {
    callCount++
    return poem()
  }

  const check = (str) => {
    t.equal(str.toString(), poemStr.toString())
    t.equal(callCount, 1)
  }

  cache
    .getOrSets('poem-get-or-sets', getPoemStream)
    .pipe(concat((str) => {
      check(str)
      cache
        .getOrSets('poem-get-or-sets', getPoemStream)
        .pipe(concat((str2) => {
          check(str2)
          t.end()
        }))
    }))
})

test('cache.getOrSets, pipe later', (t) => {
  let callCount = 0
  const getPoemStream = () => {
    callCount++
    return poem()
  }

  const check = (str) => {
    t.equal(str.toString(), poemStr.toString())
    t.equal(callCount, 1)
  }

  const rs = cache.getOrSets('poem-get-or-sets-pipe-later', getPoemStream)

  setTimeout(() => {
    rs.pipe(concat((buf) => {
      check(buf)
      cache
        .get('poem-get-or-sets-pipe-later')
        .then((buf2) => {
          check(buf2)
          t.end()
        })
        .catch(t.fail)
    }))
  }, 300)
})
