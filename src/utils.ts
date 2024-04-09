import crypto from 'crypto'
import fs from 'fs'

export function calcSha512(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512')
    const readStream = fs.createReadStream(filePath)
    readStream.pipe(hash)
    readStream.on('end', () => {
      const sha512Hash = hash.digest('hex')
      resolve(sha512Hash)
    })
    readStream.on('error', (err) => {
      reject(err)
    })
  })
}
