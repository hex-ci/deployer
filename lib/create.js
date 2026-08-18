import path from 'path'
import { fileURLToPath } from 'url'

import inquirer from 'inquirer'
import shell from 'shelljs'

import json from '../helper/json.js'
import echo from '../helper/echo.js'
import banner from '../helper/banner.js'

import config from '../config.js'
import baseData from '../helper/read-data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const run = (options) => {
  shell.cd(path.join(__dirname, '..', config.projectPath))

  shell.mkdir(options.projectName)
  shell.mkdir(options.projectName + '/repository')
  shell.mkdir(options.projectName + '/destination')
  shell.mkdir(options.projectName + '/history')
  shell.mkdir(options.projectName + '/data')
  shell.mkdir(options.projectName + '/temp')

  options.testServers = options.testServers ? options.testServers.trim() : ''
  options.exclude = options.exclude ? options.exclude.trim() : ''
  options.include = options.include ? options.include.trim() : ''

  const project = {
    name: options.projectName,
    repositoryType: options.repositoryType,
    deployType: options.deployType,
    testServers: options.testServers ? options.testServers.split(/\s*,\s*/) : [],
    testDeployPath: options.testDeployPath,
    onlineServers: options.onlineServers.trim().split(/\s*,\s*/),
    onlineDeployPath: options.onlineDeployPath,
  }

  if (options.deployType === 'docker') {
    project.imageName = options.imageName.trim()
    project.registry = options.registry ? options.registry.trim() : ''
    project.dockerfile = options.dockerfile.trim() || 'Dockerfile'
    project.composeFile = options.composeFile.trim() || 'docker-compose.yml'
  }
  else {
    project.distPath = options.distPath
    project.exclude = options.exclude ? options.exclude.split(/\s*,\s*/) : []
    project.include = options.include ? options.include.split(/\s*,\s*/) : []
    project.isFullSync = options.isFullSync
  }

  baseData.projects[options.projectName] = project

  json.write(path.join(__dirname, '..', 'data.json'), baseData)

  echo.info(`项目 ${options.projectName} 创建成功！`)

  if (options.repositoryType === 'svn') {
    echo.info('请执行命令初始化代码库: svn co <svn地址> ' + path.resolve(options.projectName + '/repository'))
  }
  else {
    echo.info('请执行命令初始化代码库: git clone <git地址> ' + path.resolve(options.projectName + '/repository'))
  }
}

export const command = 'create'
export const describe = '创建项目'
export const builder = {
}

export const handler = async () => {
  banner()

  const questions = [
    {
      type: 'input',
      name: 'projectName',
      message: '请输入项目名称(只支持小写字母、数字、减号和下划线)，3 至 50 个字符长度:',
      validate: (value) => {
        value = value.trim()

        const pass = value.match(/^[a-z0-9_-]{3,50}$/)

        if (pass) {
          if (baseData.projects[value]) {
            return '项目已存在，请重新输入项目名称'
          }
          else {
            return true
          }
        }

        return '请输入正确的项目名称'
      },
    },
    {
      type: 'select',
      name: 'repositoryType',
      message: '请选择源码仓库类型:',
      choices: ['git', 'svn'],
    },
    {
      type: 'select',
      name: 'deployType',
      message: '请选择部署类型:',
      choices: ['file', 'docker'],
      default: 'file',
    },
    {
      type: 'input',
      name: 'distPath',
      default: 'dist',
      message: '请输入要部署的文件所在路径，请使用相对路径，相对于源码根目录:',
      when: answers => answers.deployType === 'file',
    },
    {
      type: 'input',
      name: 'exclude',
      message: '请输入要排除的目录和文件，多个项目请用逗号分隔:',
      when: answers => answers.deployType === 'file',
    },
    {
      type: 'input',
      name: 'include',
      message: '请输入必须要包含的目录和文件(即使在排除列表中)，多个项目请用逗号分隔:',
      when: answers => answers.deployType === 'file',
    },
    {
      type: 'input',
      name: 'imageName',
      message: '请输入镜像名(不含 tag，可写全路径如 harbor.example.com/team/demo):',
      validate: value => value.trim() ? true : '请输入镜像名',
      when: answers => answers.deployType === 'docker',
    },
    {
      type: 'input',
      name: 'registry',
      message: '请输入镜像仓库地址(可留空，将使用全局默认或镜像名自身):',
      when: answers => answers.deployType === 'docker',
    },
    {
      type: 'input',
      name: 'dockerfile',
      default: 'Dockerfile',
      message: '请输入 Dockerfile 路径，请使用相对路径，相对于源码根目录:',
      when: answers => answers.deployType === 'docker',
    },
    {
      type: 'input',
      name: 'composeFile',
      default: 'docker-compose.yml',
      message: '请输入 docker-compose 文件路径，请使用相对路径，相对于源码根目录:',
      when: answers => answers.deployType === 'docker',
    },
    {
      type: 'input',
      name: 'testServers',
      message: '请输入测试服务器 IP 地址，多个地址请用逗号分隔(不填则发布到本地):',
    },
    {
      type: 'input',
      name: 'testDeployPath',
      message: '请输入测试服务器部署目录，请使用绝对路径:',
      validate: value => value.trim() ? true : '请输入目录',
    },
    {
      type: 'input',
      name: 'onlineServers',
      message: '请输入生产服务器 IP 地址，多个地址请用逗号分隔:',
      validate: value => value.trim() ? true : '请输入 IP 地址',
    },
    {
      type: 'input',
      name: 'onlineDeployPath',
      message: '请输入生产服务器部署目录，请使用绝对路径:',
      validate: value => value.trim() ? true : '请输入目录',
    },
    {
      type: 'confirm',
      name: 'isFullSync',
      default: false,
      message: '是否使用全同步？（全同步是指删除目标目录多余的文件）',
      when: answers => answers.deployType === 'file',
    },
  ]

  let answers

  try {
    answers = await inquirer.prompt(questions)
  }
  catch (error) {
    // 用户在问答中按 Ctrl+C 主动取消输入
    if (error.name === 'ExitPromptError') {
      echo.info('已取消创建项目')

      return
    }

    throw error
  }

  run(answers)
}
