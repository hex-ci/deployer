import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

import shell from 'shelljs'

import snapshot from '../helper/snapshot.js'
import json from '../helper/json.js'
import echo from '../helper/echo.js'
import excludeInclude from '../helper/exclude-include.js'
import template from '../helper/template.js'
import banner from '../helper/banner.js'
import clearBackup from '../helper/clear-backup.js'
import docker from '../helper/docker.js'

import config from '../config.js'
import baseData from '../helper/read-data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 构建语义变量交构建工具自行决定，不继承运行机 shell 的隐式值，按需扩充
const EXCLUDED_ENV_KEYS = ['NODE_ENV', 'CI']

// 构造注入 build.sh 的环境变量（config.env 键名转大写，数组项拼接 PATH 类变量）
const buildEnv = (extra = {}) => {
  const customEnv = {}

  for (const key in config.env) {
    const item = config.env[key]
    const upperKey = key.toUpperCase()
    const oldEnv = process.env[upperKey]

    if (Array.isArray(item)) {
      customEnv[upperKey] = item.join(path.delimiter) + (oldEnv ? path.delimiter + oldEnv : '')
    }
    else {
      customEnv[upperKey] = item
    }
  }

  const inheritedEnv = { ...process.env }

  for (const key of EXCLUDED_ENV_KEYS) {
    delete inheritedEnv[key]
  }

  return Object.assign({}, inheritedEnv, customEnv, {
    // 强制输出支持彩色字符(chalk 模块需要)
    FORCE_COLOR: 1,
    ...extra,
  })
}

// 执行 build.sh，继承终端 stdio 以保持交互能力；返回是否成功
const runBuildScript = (options, extra) => {
  const params = options.params && options.params.trim() ? options.params.trim().split(/\s+/) : []

  const result = spawnSync('bash', ['build.sh', ...params], {
    stdio: 'inherit',
    env: buildEnv(extra),
  })

  return result.status === 0
}

// docker 模式：构建镜像 → 推送 → 发布到回归机
const runDocker = async (options, currentData, currentUser, currentFilename, currentHistory, currentPath, project) => {
  const image = docker.resolveImage(currentData, config)
  const tag = String(currentFilename)
  const dockerfile = currentData.dockerfile || 'Dockerfile'

  echo.info(`=== 构建镜像: ${docker.imageTag(image, tag)} ===`)

  if (fs.existsSync('./repository/build.sh')) {
    shell.cd('./repository')

    if (!runBuildScript(options, { IMAGE: image, TAG: tag })) {
      echo.error('执行 build.sh 脚本失败！')

      return
    }

    shell.cd('..')
  }
  else {
    shell.cd('./repository')

    if (shell.exec(docker.buildCmd(image, tag, dockerfile)).code !== 0) {
      echo.error('构建镜像失败！')

      return
    }

    shell.cd('..')
  }

  echo.info(`=== 推送镜像: ${docker.imageTag(image, tag)} ===`)

  if (shell.exec(docker.pushCmd(image, tag)).code !== 0) {
    echo.error('推送镜像失败！')

    return
  }

  currentHistory.push({
    user: currentUser,
    image: docker.imageTag(image, tag),
    time: new Date().toLocaleString(),
  })

  json.write('./data/history.json', currentHistory)

  echo.info(`=== 发布到回归机 ===`)

  const composeFile = currentData.composeFile || 'docker-compose.yml'
  const testComposeFile = docker.composeEnvFile(composeFile, 'test')
  const finalCompose = fs.existsSync(`./repository/${testComposeFile}`) ? testComposeFile : composeFile

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

  // 清理临时目录
  shell.rm('-rf', './temp/*')

  // 清理过期备份文件
  clearBackup(`${currentPath}/history`, currentData.backupExpires)

  let rollbackCommandTips = `./index.js rollback ${project} ${currentFilename}`
  let buildCommandTips = `./index.js deploy ${project}`

  if (currentData.rollbackCommandTips) {
    rollbackCommandTips = template(currentData.rollbackCommandTips, {
      user: currentUser,
      project: project,
      versionId: currentFilename,
    })
  }

  if (currentData.buildCommandTips) {
    buildCommandTips = template(currentData.buildCommandTips, {
      user: currentUser,
      project: project,
      versionId: currentFilename,
    })
  }

  echo.info(`--- 发布到回归机完毕，执行此命令恢复原始版本: ${rollbackCommandTips}`)
  echo.info(`--- 请尽快验证效果后执行部署命令: ${buildCommandTips}`)
}

// 实际构建流程：更新代码 → 构建 → 打包/推送 → 发布到回归机
const performBuild = async (options, currentData, currentUser, currentFilename, currentHistory, currentPath, project) => {
  echo.info(`=== 更新代码 ===`)

  shell.cd('repository')
  if (currentData.repositoryType === 'svn') {
    if (shell.exec(`svn up > /dev/null`).code !== 0) {
      echo.error(`svn 执行出错！`)

      return
    }
  }
  else {
    if (shell.exec(`git pull > /dev/null`).code !== 0) {
      echo.error(`git 执行出错！`)

      return
    }
  }
  shell.cd('..')

  echo.info(`=== 检查未部署的文件 ===`)

  if (currentData.repositoryType === 'svn') {
    shell.exec('svn export ./repository ./temp/snapshot --force > /dev/null')
  }
  else {
    shell.cd('repository')
    shell.mkdir('../temp/snapshot')
    shell.exec('git archive HEAD | tar -x -m -C ../temp/snapshot')
    shell.cd('..')
  }

  if (fs.existsSync('./data/snapshot.json')) {
    const deployFiles = json.read('./data/snapshot.json')
    const diffResult = snapshot.check(deployFiles, './temp/snapshot')

    Object.keys(diffResult).forEach((value) => {
      console.log('.' + value)
    })
  }

  // docker 模式：构建镜像并推送、发布到回归机
  if (currentData.deployType === 'docker') {
    await runDocker(options, currentData, currentUser, currentFilename, currentHistory, currentPath, project)

    return
  }

  echo.info(`=== 执行 build.sh ===`)

  // 执行 build.sh 脚本
  if (fs.existsSync('./repository/build.sh')) {
    shell.cd('./repository')

    if (!runBuildScript(options)) {
      echo.error('执行 build.sh 脚本失败！')

      return
    }

    shell.cd('..')
  }

  if (!fs.existsSync(`./repository/${currentData.distPath}`)) {
    echo.error(`目标目录 ${currentData.distPath} 不存在！`)

    return
  }

  // 源文件打包
  const srcTgz = `./temp/source.${currentFilename}.tgz`
  const uploadedSrcTgz = `./history/${currentFilename}-up.tgz`
  const backupSrcTgz = `${currentFilename}-bak.tgz`

  currentHistory.push({
    user: currentUser,
    file: backupSrcTgz,
    time: new Date(currentFilename).toLocaleString(),
  })

  // 待上线的代码打包
  echo.info(`=== 打包源文件: source.${currentFilename}.tgz ===`)

  const excludeVcs = process.platform === 'linux' ? '--exclude-vcs' : ''

  if (shell.exec(`tar czf ${srcTgz} ${excludeVcs} -C ./repository/${currentData.distPath} ./ > /dev/null`).code !== 0) {
    echo.error('文件打包失败！')

    return
  }

  echo.info(`=== 备份文件: ${backupSrcTgz} ===`)

  if (shell.exec(`tar czf ./history/${backupSrcTgz} ${excludeVcs} -C ./destination ./`).code !== 0) {
    echo.error('备份文件失败！')

    return
  }

  // 清理已发布代码
  shell.rm('-rf', './destination/*')

  echo.info(`=== 发布文件 ===`)

  shell.cp(srcTgz, uploadedSrcTgz)

  if (shell.exec(`tar xzf ${uploadedSrcTgz} -C ./destination`).code !== 0) {
    echo.error('发布文件失败！')

    return
  }

  json.write('./data/history.json', currentHistory)

  echo.info(`=== 生成快照 ===`)

  const deployFiles = snapshot.make('./temp/snapshot')
  json.write('./data/snapshot.json', deployFiles)

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

  // 清理临时目录
  shell.rm('-rf', './temp/*')

  // 清理过期备份文件
  clearBackup(`${currentPath}/history`, currentData.backupExpires)

  let rollbackCommandTips = `./index.js rollback ${project} ${currentFilename}`
  let buildCommandTips = `./index.js deploy ${project}`

  if (currentData.rollbackCommandTips) {
    rollbackCommandTips = template(currentData.rollbackCommandTips, {
      user: currentUser,
      project: project,
      versionId: currentFilename,
    })
  }

  if (currentData.buildCommandTips) {
    buildCommandTips = template(currentData.buildCommandTips, {
      user: currentUser,
      project: project,
      versionId: currentFilename,
    })
  }

  echo.info(`--- 发布到回归机完毕，执行此命令恢复原始版本: ${rollbackCommandTips}`)
  echo.info(`--- 请尽快验证效果后执行部署命令: ${buildCommandTips}`)
}

const run = async (options) => {
  banner()

  const project = options.project

  if (!baseData.projects[project]) {
    echo.warning(`项目 ${project} 不存在！`)

    return
  }

  const currentFilename = new Date().getTime()
  const currentData = baseData.projects[project]
  const currentUser = options.user || process.env.USER

  const currentPath = path.resolve(__dirname, '..', config.projectPath, currentData.name)

  shell.cd(currentPath)

  let currentHistory = []

  // 读取历史记录
  if (fs.existsSync('./data/history.json')) {
    currentHistory = json.read('./data/history.json')
  }

  // 检查锁定状态
  if (fs.existsSync('./data/lock')) {
    const lockUser = fs.readFileSync('./data/lock')

    if (currentUser != lockUser) {
      echo.warning(`当前项目已被 ${lockUser} 锁定！请等待上线完毕，以解锁项目。`)

      return
    }
  }

  // 清理临时目录
  shell.rm('-rf', './temp/*')

  // 锁定项目
  shell.rm('-rf', './data/lock')
  fs.writeFileSync('./data/lock', currentUser.trim())

  // Ctrl+C 中断时释放锁，避免他人被误拦
  const onSigint = () => {
    echo.warning('构建已中断，已释放项目锁')
    shell.rm('-rf', './data/lock')
    shell.rm('-rf', './temp/*')
    process.exit(130)
  }
  process.on('SIGINT', onSigint)

  try {
    await performBuild(options, currentData, currentUser, currentFilename, currentHistory, currentPath, project)
  }
  finally {
    // 无论成败都释放锁（并发锁只应存在于执行期间）
    process.removeListener('SIGINT', onSigint)
    shell.rm('-rf', './data/lock')
  }
}

export const command = 'build <project> [params]'
export const describe = '构建项目'
export const builder = {
}

export const handler = async (argv) => {
  await run(argv)
}
