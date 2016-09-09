import fsBlobStore from 'fs-blob-store'
import s3BlobStore from 's3-blob-store'
import aws from 'aws-sdk'
import path from 'path'
import randomstring from 'randomstring'
import rimraf from 'rimraf'
import { mkdirSync } from 'fs'
import test from 'blue-tape'

import cloudCache from '../src'

// Clean .minio directory

/*
rimraf.sync(minioDir)
mkdirSync(minioDir)
*/

const storeInit = {
  fs: () => {
    const tmpDir = path.join(__dirname, '.tmp')
    // const dir = path.join(tmpDir, name)
    const blobStore = fsBlobStore(tmpDir)
    const resetStore = () => {
      // Clean tmp directory
      rimraf.sync(tmpDir)
      mkdirSync(tmpDir)
      return Promise.resolve()
    }
    return { resetStore, blobStore }
  },
  s3: () => {
    const accessKeyId = process.env.S3_ACCESS_KEY
    const secretAccessKey = process.env.S3_SECRET_KEY
    const bucket = 'cloudcache-test'
    const client = new aws.S3({
      accessKeyId,
      secretAccessKey,
      endpoint: new aws.Endpoint(process.env.S3_ENDPOINT),
      s3ForcePathStyle: true, // needed to use minio?
      signatureVersion: 'v4',
    })
    const blobStore = s3BlobStore({ client, bucket })

    const resetStore = () => {
      const params = { Bucket: bucket }
      const clearBucket = () => (
        client
          .listObjects(params)
          .promise()
          .then(({ Contents }) => {
            const tasks = Contents.map(({ Key }) => (
              client.deleteObject({ ...params, Key }).promise()
            ))
            return Promise.all(tasks)
          })
      )

      return clearBucket()
        .then(() => (
          client.deleteBucket(params).promise()
        ))
        .then(() => (
          client.createBucket(params).promise()
        ))
    }
    return { resetStore, blobStore }
  },
}

const { resetStore, blobStore } = storeInit[process.env.STORE || 'fs']()

// @hack... this should be executed once, before any other test
test('reset store', () => resetStore())

export default (name = randomstring.generate(7)) => (
  cloudCache(blobStore, { keyPrefix: `${name}/` })
)
