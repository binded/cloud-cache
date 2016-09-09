import test from 'blue-tape'
import getCloudCache from './utils'

const cache = getCloudCache('promise')

test('cache.set', () => (
  cache.set('somekey', 1337)
))

test('cache.get', (t) => (
  cache.get('somekey').then((val) => {
    t.equal(val, 1337)
  })
))

test('cache.del', (t) => (
  cache.del('somekey').then(() => (
    cache.get('somekey')
      .catch((err) => {
        t.ok(err instanceof cache.KeyNotExistsError)
        t.ok(err instanceof cache.CloudCacheError)
        t.equal(err.key, 'somekey')
      })
  ))
))

test('cache.getOrSet', (t) => {
  let callCount = 0
  const getLeet = () => new Promise((resolve) => {
    callCount++
    setTimeout(() => resolve(1337), 100)
  })
  return cache.getOrSet('leetkey', getLeet).then((val) => {
    t.equal(callCount, 1)
    t.equal(val, 1337)
    return cache.getOrSet('leetkey', getLeet).then((val2) => {
      t.equal(callCount, 1)
      t.equal(val2, 1337)
    })
  })
})

test('buffer', (t) => {
  const buf = Buffer.from('deadbeefcafebabe', 'hex')

  const check = (val) => {
    t.ok(Buffer.isBuffer(val))
    t.equal(val.toString('hex'), 'deadbeefcafebabe')
  }
  return cache.getOrSet('bufkey', () => buf)
    .then((val) => { check(val) })
    .then(() => cache.get('bufkey'))
    .then((val) => { check(val) })
})

test('object', (t) => {
  const obj = {
    some: 'object',
    with: {
      some: 'random',
      properties: true,
    },
  }
  return cache.set('obj', obj)
    .then(() => cache.get('obj'))
    .then((val) => {
      t.deepEqual(val, obj)
      t.notEqual(val, obj)
    })
})

test('ttl works', (t) => {
  const ttlval = '1337'

  t.plan(2)

  cache.set('ttlval', ttlval, { ttl: 0.2 })
    .then(() => cache.get('ttlval'))
    .then((val) => {
      t.equal(val, ttlval)
    })

  setTimeout(() => {
    cache.get('ttlval').catch((err) => {
      t.ok(err instanceof cache.KeyNotExistsError)
    })
  }, 300)
})

test('cache.getOrSet (refresh works)', (t) => {
  const getLeet = () => new Promise((resolve) => {
    setTimeout(() => resolve(1337), 100)
  })
  const getEleet = () => new Promise((resolve) => {
    setTimeout(() => resolve(31337), 100)
  })
  return cache.getOrSet('refresh', getLeet).then((val) => {
    t.equal(val, 1337)
    return cache.getOrSet('refresh', getEleet, { refresh: true }).then((val2) => {
      t.equal(val2, 31337)
    })
  })
})

