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

  options.testServers = options.testServers.trim()
  options.exclude = options.exclude.trim()
  options.include = options.include.trim()

  baseData.projects[options.projectName] = {
    name: options.projectName,
    repositoryType: options.repositoryType,
    distPath: options.distPath,
    exclude: options.exclude ? options.exclude.split(/\s*,\s*/) : [],
    include: options.include ? options.include.split(/\s*,\s*/) : [],
    testServers: options.testServers ? options.testServers.split(/\s*,\s*/) : [],
    testDeployPath: options.testDeployPath,
    onlineServers: options.onlineServers.trim().split(/\s*,\s*/),
    onlineDeployPath: options.onlineDeployPath,
    isFullSync: options.isFullSync,
  }

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
      type: 'input',
      name: 'distPath',
      default: 'dist',
      message: '请输入要部署的文件所在路径，请使用相对路径，相对于源码根目录:',
    },
    {
      type: 'input',
      name: 'exclude',
      message: '请输入要排除的目录和文件，多个项目请用逗号分隔:',
    },
    {
      type: 'input',
      name: 'include',
      message: '请输入必须要包含的目录和文件(即使在排除列表中)，多个项目请用逗号分隔:',
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
    },
  ]

  const answers = await inquirer.prompt(questions)

  run(answers)
}
