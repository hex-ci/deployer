#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import shell from 'shelljs'

import config from './config.js'
import * as create from './lib/create.js'
import * as build from './lib/build.js'
import * as deploy from './lib/deploy.js'
import * as rollback from './lib/rollback.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const projectDir = path.join(__dirname, config.projectPath)

if (!fs.existsSync(projectDir)) {
  shell.mkdir(projectDir)
}

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

yargs(hideBin(process.argv))
  .usage('用法: $0 <命令> [选项]')
  .command(create)
  .command(build)
  .command(deploy)
  .command(rollback)
  .option('user', {
    alias: 'u',
    description: '执行操作的用户，默认值为当前登录用户',
    type: 'string',
  })
  .demandCommand(1, '请输入有效的命令')
  .help('help')
  .alias('h', 'help')
  .version('version', '显示版本信息', pkg.version)
  .alias('v', 'version')
  // show examples of application in action.
  .example('$0 build demo_project', '构建项目')
  .strict()
  .locale('zh_CN')
  .parse()
