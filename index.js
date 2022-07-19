#!/usr/bin/env node

const yargs = require('yargs');
const shell = require('shelljs');
const fs = require('fs');

const config = require('./config');

if (!fs.existsSync(__dirname + '/' + config.projectPath)) {
  shell.mkdir(__dirname + '/' + config.projectPath);
}

yargs.usage('用法: $0 <命令> [选项]')
  .command(require('./lib/create'))
  .command(require('./lib/build'))
  .command(require('./lib/deploy'))
  .command(require('./lib/rollback'))
  .option('user', {
    alias: 'u',
    description: '执行操作的用户，默认值为当前登录用户',
    type: 'string'
  })
  .option('help', {
    alias: 'h',
    description: '显示帮助信息'
  })
  .demandCommand(1, '请输入有效的命令')
  .help('help')
  .version('version', '显示版本信息', require(__dirname + '/package.json').version)
  .alias('version', 'v')
  // show examples of application in action.
  .example('$0 build demo_project', '构建项目')
  .strict()
  .locale('zh_CN')
  .argv;
