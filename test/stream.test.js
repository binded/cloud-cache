import test from 'blue-tape'
import fs from 'fs'
import concat from 'concat-stream'
import mem from 'mem'

import getCloudCache from './utils'

const cache = getCloudCache('stream')

const file = mem((name) => {
  const filepath = `${__dirname}/files/${name}`
  const rs = () => fs.createReadStream(filepath)
  const buf = fs.readFileSync(filepath)
  return { path: filepath, rs, buf }
})

const poem = file('poem.txt')
const image = file('large.jpg')

// const devnull = () => fs.createWriteStream('/dev/null')

test('cache.sets', (t) => {
  poem.rs().pipe(cache.sets('poem'))
    .on('error', t.fail)
    .on('finish', () => {
      t.end()
    })
})

test('cache.gets', (t) => {
  cache
    .gets('poem')
    .on('error', t.fail)
    .pipe(concat((buf) => {
      t.equal(buf.toString(), poem.buf.toString())
      t.end()
    }))
})

test('cache.getOrSets', (t) => {
  let callCount = 0
  const getPoemStream = () => {
    callCount++
    return poem.rs()
  }

  const check = (buf) => {
    t.equal(buf.toString(), poem.buf.toString())
    t.equal(callCount, 1, 'getPoemStream only called once')
  }

  cache
    .getOrSets('poem-get-or-sets', getPoemStream)
    .on('finish', () => {
      cache
        .getOrSets('poem-get-or-sets', getPoemStream)
        .pipe(concat((str2) => {
          check(str2)
          t.end()
        }))
    })
    .pipe(concat((str) => {
      check(str)
    }))
})

test('cache.getOrSets, pipe later', (t) => {
  let callCount = 0
  const getPoemStream = () => {
    callCount++
    return poem.rs()
  }

  const check = (str) => {
    t.equal(str.toString(), poem.buf.toString())
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

test('cache.getOrSets, refresh=true', (t) => {
  const check = ({ buf }, buf2) => {
    t.ok(Buffer.compare(buf, buf2) === 0)
  }

  const refresh = () => {
    cache.getOrSets('refresh', image.rs, { refresh: true })
      .on('error', t.fail)
      .on('finish', () => {
        cache.gets('refresh').pipe(concat((buf2) => {
          check(image, buf2)
          t.end()
        }))
      })
      .pipe(concat((buf) => {
        check(image, buf)
      }))
  }

  cache.getOrSets('refresh', poem.rs)
    .on('error', t.fail)
    .on('data', () => {}) // make sure poem.rs is consumed
    .on('finish', () => {
      cache.gets('refresh').pipe(concat((buf) => {
        check(poem, buf)
        refresh()
      }))
    })
})
