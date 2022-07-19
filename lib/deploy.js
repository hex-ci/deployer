const shell = require('shelljs');
const path = require('path');

const echo = require('../helper/echo');
const excludeInclude = require('../helper/exclude-include');
const banner = require('../helper/banner');

const config = require('../config');
const baseData = require('../helper/read-data');

const run = (options) => {

  banner();

  const project = options.project;

  if (!baseData.projects[project]) {
    echo.warning(`项目 ${project} 不存在！`);

    return;
  }

  const currentData = baseData.projects[project];

  const currentPath = path.resolve(__dirname + '/../' + config.projectPath + '/' + currentData.name);

  shell.cd(currentPath);

  echo.info(`=== 开始部署 ===`);

  const ei = excludeInclude.get(currentData);

  const fullSync = currentData.isFullSync === true ? '--delete' : '';

  currentData.onlineServers.forEach((host) => {
    echo.info(`====== ${host} ======`);

    shell.exec(`rsync -azh --stats ${fullSync} ${ei.include} ${ei.exclude} ./destination/ ${config.sshUser}@${host}:${currentData.onlineDeployPath}/`);
  });

  echo.info(`--- 完成 ---`);
};

exports.command = 'deploy <project>'
exports.describe = '部署项目'
exports.builder = {
};

exports.handler = (argv) => {
  run(argv);
}
