import fs from 'fs'

export default {
  read(filepath) {
    let result

    try {
      result = JSON.parse(fs.readFileSync(filepath))
    }
    catch {
      result = {}
    }

    return result
  },

  write(filepath, data) {
    return fs.writeFileSync(filepath, JSON.stringify(data, null, '  '))
  },
}
