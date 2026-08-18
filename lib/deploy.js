import path from 'path'
import { fileURLToPath } from 'url'

import shell from 'shelljs'

import echo from '../helper/echo.js'
import excludeInclude from '../helper/exclude-include.js'
import banner from '../helper/banner.js'

import config from '../config.js'
import baseData from '../helper/read-data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const run = (options) => {
  banner()

  const project = options.project

  if (!baseData.projects[project]) {
    echo.warning(`项目 ${project} 不存在！`)

    return
  }

  const currentData = baseData.projects[project]

  const currentPath = path.resolve(__dirname, '..', config.projectPath, currentData.name)

  shell.cd(currentPath)

  echo.info(`=== 开始部署 ===`)

  const ei = excludeInclude.get(currentData)

  const fullSync = currentData.isFullSync === true ? '--delete' : ''

  currentData.onlineServers.forEach((host) => {
    echo.info(`====== ${host} ======`)

    shell.exec(`rsync -azh --stats ${fullSync} ${ei.include} ${ei.exclude} ./destination/ ${config.sshUser}@${host}:${currentData.onlineDeployPath}/`)
  })

  echo.info(`--- 完成 ---`)
}

export const command = 'deploy <project>'
export const describe = '部署项目'
export const builder = {
}

export const handler = (argv) => {
  run(argv)
}
