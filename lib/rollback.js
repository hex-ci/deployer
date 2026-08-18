import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import shell from 'shelljs'

import echo from '../helper/echo.js'
import excludeInclude from '../helper/exclude-include.js'
import banner from '../helper/banner.js'
import docker from '../helper/docker.js'

import config from '../config.js'
import baseData from '../helper/read-data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// docker 模式：用指定版本 tag 回滚到回归机
const runDocker = (currentData, versionId) => {
  const image = docker.resolveImage(currentData, config)
  const tag = versionId
  const composeFile = currentData.composeFile || 'docker-compose.yml'
  const testComposeFile = docker.composeEnvFile(composeFile, 'test')
  const finalCompose = fs.existsSync(`./repository/${testComposeFile}`) ? testComposeFile : composeFile

  echo.info(`=== 发布到回归机 ===`)

  if (currentData.testServers.length) {
    currentData.testServers.forEach((host) => {
      echo.info(`====== ${host} ======`)

      shell.exec(`rsync -azh ./repository/${finalCompose} ${config.sshUser}@${host}:${currentData.testDeployPath}/`)
      shell.exec(docker.sshCmd(config.sshUser, host, docker.deployCmd(image, tag, currentData.testDeployPath, finalCompose)))
      shell.exec(docker.sshCmd(config.sshUser, host, docker.pruneCmd()))
    })
  }
  else {
    shell.exec(`rsync -azh ./repository/${finalCompose} ${currentData.testDeployPath}/`)
    shell.exec(docker.deployCmd(image, tag, currentData.testDeployPath, finalCompose))
    shell.exec(docker.pruneCmd())
  }
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

  echo.info(`=== 开始回滚 ===`)

  if (currentData.deployType === 'docker') {
    runDocker(currentData, options.versionId)

    echo.info(`--- 完成 ---`)

    return
  }

  // 检查回滚文件
  if (!fs.existsSync(`./history/${options.versionId}-bak.tgz`)) {
    echo.error('错误：回滚文件无效')

    return
  }

  // 清理已发布代码
  shell.rm('-rf', './destination/*')

  if (shell.exec(`tar xfz ./history/${options.versionId}-bak.tgz -C ./destination`).code !== 0) {
    echo.error('文件解压缩失败！')

    return
  }

  echo.info(`=== 发布到回归机 ===`)

  const ei = excludeInclude.get(currentData)

  const fullSync = currentData.isFullSync === true ? '--delete' : ''

  if (currentData.testServers.length) {
    currentData.testServers.forEach((host) => {
      echo.info(`====== ${host} ======`)

      shell.exec(`rsync -azh --stats ${fullSync} ${ei.include} ${ei.exclude} ./destination/ ${config.sshUser}@${host}:${currentData.testDeployPath}/`)
    })
  }
  else {
    shell.exec(`rsync -azh --stats ${fullSync} ${ei.include} ${ei.exclude} ./destination/ ${currentData.testDeployPath}/`)
  }

  echo.info(`--- 完成 ---`)
}

export const command = 'rollback <project> <versionId>'
export const describe = '回滚项目'
export const builder = {
}

export const handler = (argv) => {
  run(argv)
}
