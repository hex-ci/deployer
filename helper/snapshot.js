import fs from 'fs'
import crypto from 'crypto'
import _ from 'lodash'
import path from 'path'

// 递归获取文件列表
const walk = (dir) => {
  let results = []
  const list = fs.readdirSync(dir)

  list.forEach((file) => {
    file = dir + '/' + file
    const stat = fs.statSync(file)

    if (stat && stat.isDirectory()) {
      // 递归进入子目录
      results = results.concat(walk(file))
    }
    else {
      results.push(file)
    }
  })

  return results
}

const md5 = (str) => {
  return crypto.createHash('md5').update(str).digest('hex')
}

export default {
  check(manifest, filepath) {
    filepath = path.resolve(filepath)

    const files = walk(filepath)
    const result = {}

    files.forEach((file) => {
      const fileContent = fs.readFileSync(file)
      const newFile = file.replace(filepath, '')

      result[newFile] = md5(fileContent)
    })

    const diffResult = _.omitBy(result, (v, k) => {
      return manifest[k] === v
    })

    return diffResult
  },

  make(filepath) {
    filepath = path.resolve(filepath)

    const files = walk(filepath)
    const result = {}

    files.forEach((file) => {
      const fileContent = fs.readFileSync(file)
      const newFile = file.replace(filepath, '')

      result[newFile] = md5(fileContent)
    })

    return result
  },
}
