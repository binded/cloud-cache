export class CloudCacheError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'CloudCacheError'
  }
}

export class KeyNotExistsError extends CloudCacheError {
  constructor(key) {
    super(`Key ${key} does not exist`)
    this.name = 'KeyNotExistsError'
    this.key = key
  }
}

