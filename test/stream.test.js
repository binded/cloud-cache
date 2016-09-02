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
