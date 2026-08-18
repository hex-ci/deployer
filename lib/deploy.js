import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import shell from 'shelljs'

import echo from '../helper/echo.js'
import excludeInclude from '../helper/exclude-include.js'
import banner from '../helper/banner.js'
import json from '../helper/json.js'
import docker from '../helper/docker.js'

import config from '../config.js'
import baseData from '../helper/read-data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// docker 模式：取最近一次构建的版本，部署到生产服务器
const runDocker = (currentData) => {
  let tag

  if (fs.existsSync('./data/history.json')) {
    const history = json.read('./data/history.json')

    if (history.length) {
      tag = history[history.length - 1].tag
    }
  }

  if (!tag) {
    echo.error('尚未构建镜像，请先执行 build 命令')

    return
  }

  const image = docker.resolveImage(currentData, config)
  const composeFile = currentData.composeFile || 'docker-compose.yml'
  const onlineComposeFile = docker.composeEnvFile(composeFile, 'online')
  const finalCompose = fs.existsSync(`./repository/${onlineComposeFile}`) ? onlineComposeFile : composeFile

  currentData.onlineServers.forEach((host) => {
    echo.info(`====== ${host} ======`)

    shell.exec(`rsync -azh ./repository/${finalCompose} ${config.sshUser}@${host}:${currentData.onlineDeployPath}/`)
    shell.exec(docker.sshCmd(config.sshUser, host, docker.deployCmd(image, tag, currentData.onlineDeployPath, finalCompose)))
    shell.exec(docker.sshCmd(config.sshUser, host, docker.pruneCmd()))
  })
}

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

  if (currentData.deployType === 'docker') {
    runDocker(currentData)

    echo.info(`--- 完成 ---`)

    return
  }

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
