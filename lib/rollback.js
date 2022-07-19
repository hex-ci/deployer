const shell = require('shelljs');
const fs = require('fs');
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

  echo.info(`=== 开始回滚 ===`);

  // 检查回滚文件
  if (!fs.existsSync(`./history/${options.versionId}-bak.tgz`)) {
    echo.error('错误：回滚文件无效');

    return;
  }

  // 清理已发布代码
  shell.rm('-rf', './destination/*');

  if (shell.exec(`tar xfz ./history/${options.versionId}-bak.tgz -C ./destination`).code !== 0) {
    echo.error('文件解压缩失败！');

    return;
  }

  echo.info(`=== 发布到回归机 ===`);

  const ei = excludeInclude.get(currentData);

  const fullSync = currentData.isFullSync === true ? '--delete' : '';

  if (currentData.testServers.length) {
    currentData.testServers.forEach((host) => {
      echo.info(`====== ${host} ======`);

      shell.exec(`rsync -azh --stats ${fullSync} ${ei.include} ${ei.exclude} ./destination/ ${config.sshUser}@${host}:${currentData.testDeployPath}/`);
    });
  }
  else {
    shell.exec(`rsync -azh --stats ${fullSync} ${ei.include} ${ei.exclude} ./destination/ ${currentData.testDeployPath}/`);
  }

  echo.info(`--- 完成 ---`);
};

exports.command = 'rollback <project> <versionId>'
exports.describe = '回滚项目'
exports.builder = {
};

exports.handler = (argv) => {
  run(argv);
}
