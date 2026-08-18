import fs from 'fs'
import { fileURLToPath } from 'url'

// 默认数据结构
const defaultData = {
  projects: {},
}

const dataFilename = fileURLToPath(new URL('../data.json', import.meta.url))

if (!fs.existsSync(dataFilename)) {
  fs.writeFileSync(dataFilename, JSON.stringify(defaultData, null, '  '))
}

const baseData = JSON.parse(fs.readFileSync(dataFilename))

if (!baseData.projects) {
  baseData.projects = {}
}

export default baseData
