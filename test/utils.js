import fsBlobStore from 'fs-blob-store'
import path from 'path'
import randomstring from 'randomstring'
import rimraf from 'rimraf'
import { mkdirSync } from 'fs'

import cloudCache from '../src'

const tmpDir = path.join(__dirname, '.tmp')

// Clean tmp directory
rimraf.sync(tmpDir)
mkdirSync(tmpDir)

export default (name = randomstring.generate(7)) => {
  const dir = path.join(tmpDir, name)
  const blobStore = fsBlobStore(dir)
  const cache = cloudCache(blobStore)
  return cache
}
