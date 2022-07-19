const shell = require('shelljs');
const fs = require('fs');
const path = require('path');

const snapshot = require('../helper/snapshot');
const json = require('../helper/json');
const echo = require('../helper/echo');
const excludeInclude = require('../helper/exclude-include');
const template = require('../helper/template');
const banner = require('../helper/banner');
const clearBackup = require('../helper/clear-backup');

const config = require('../config');
const baseData = require('../helper/read-data');

const run = async (options) => {

  banner();

  const project = options.project;

  if (!baseData.projects[project]) {
    echo.warning(`项目 ${project} 不存在！`);

    return;
  }

  const now = new Date();
  const currentFilename = now.getTime();
  const currentData = baseData.projects[project];
  const currentUser = options.user || process.env.USER;

  const currentPath = path.resolve(__dirname + '/../' + config.projectPath + '/' + currentData.name);

  shell.cd(currentPath);

  let currentHistory = [];

  // 读取历史记录
  if (fs.existsSync('./data/history.json')) {
    currentHistory = json.read('./data/history.json');
  }

  // 检查锁定状态
  if (fs.existsSync('./data/lock')) {
    const lockUser = fs.readFileSync('./data/lock');

    if (currentUser != lockUser) {
      echo.warning(`当前项目已被 ${lockUser} 锁定！请等待上线完毕，以解锁项目。`);

      return;
    }
  }

  // 清理临时目录
  shell.rm('-rf', './temp/*');

  // 锁定项目
  shell.rm('-rf', './data/lock');
  fs.writeFileSync('./data/lock', currentUser.trim());

  echo.info(`=== 更新代码 ===`);

  shell.cd('repository');
  if (currentData.repositoryType === 'svn') {
    if (shell.exec(`svn up > /dev/null`).code !== 0) {
      echo.error(`svn 执行出错！`);

      return;
    }
  }
  else {
    if (shell.exec(`git pull > /dev/null`).code !== 0) {
      echo.error(`git 执行出错！`);

      return;
    }
  }
  shell.cd('..');

  echo.info(`=== 检查未部署的文件 ===`);

  if (currentData.repositoryType === 'svn') {
    shell.exec('svn export ./repository ./temp/snapshot --force > /dev/null');
  }
  else {
    shell.cd('repository');
    shell.mkdir('../temp/snapshot');
    shell.exec('git archive HEAD | tar -x -m -C ../temp/snapshot');
    shell.cd('..');
  }

  if (fs.existsSync('./data/snapshot.json')) {
    const deployFiles = json.read('./data/snapshot.json');
    const diffResult = snapshot.check(deployFiles, './temp/snapshot');

    Object.keys(diffResult).forEach((value) => {
      console.log('.' + value);
    });
  }

  echo.info(`=== 执行 build.sh ===`);

  // 执行 build.sh 脚本
  if (fs.existsSync('./repository/build.sh')) {
    shell.cd('./repository');

    const customEnv = {};

    for (const key in config.env) {
      const item = config.env[key];
      const upperKey = key.toUpperCase();
      const oldEnv = process.env[upperKey];

      if (Array.isArray(item)) {
        customEnv[upperKey] = item.join(path.delimiter) + (oldEnv ? path.delimiter + oldEnv : '');
      }
      else {
        customEnv[upperKey] = item;
      }
    }

    if (shell.exec(`bash build.sh ${options.params || ''}`, {
      env: Object.assign(customEnv, {
        // 强制输出支持彩色字符(chalk 模块需要)
        FORCE_COLOR: 1
      })
    }).code !== 0) {
      echo.error('执行 build.sh 脚本失败！');

      return;
    }

    shell.cd('..');
  }

  if (!fs.existsSync(`./repository/${currentData.distPath}`)) {
    echo.error(`目标目录 ${currentData.distPath} 不存在！`);

    return;
  }

  // 源文件打包
  const srcTgz = `./temp/source.${currentFilename}.tgz`;
  const uploadedSrcTgz = `./history/${currentFilename}-up.tgz`;
  const backupSrcTgz = `${currentFilename}-bak.tgz`;

  currentHistory.push({
    user: currentUser,
    file: backupSrcTgz,
    time: now.toLocaleString()
  });

  // 待上线的代码打包
  echo.info(`=== 打包源文件: source.${currentFilename}.tgz ===`);

  const excludeVcs = process.platform === 'linux' ? '--exclude-vcs' : '';

  if (shell.exec(`tar czf ${srcTgz} ${excludeVcs} -C ./repository/${currentData.distPath} ./ > /dev/null`).code !== 0) {
    echo.error('文件打包失败！');

    return;
  }

  echo.info(`=== 备份文件: ${backupSrcTgz} ===`);

  if (shell.exec(`tar czf ./history/${backupSrcTgz} ${excludeVcs} -C ./destination ./`).code !== 0) {
    echo.error('备份文件失败！');

    return;
  }

  // 清理已发布代码
  shell.rm('-rf', './destination/*');

  echo.info(`=== 发布文件 ===`);

  shell.cp(srcTgz, uploadedSrcTgz);

  if (shell.exec(`tar xzf ${uploadedSrcTgz} -C ./destination`).code !== 0) {
    echo.error('发布文件失败！');

    return;
  }

  json.write('./data/history.json', currentHistory);

  echo.info(`=== 生成快照 ===`);

  const deployFiles = snapshot.make('./temp/snapshot');
  json.write('./data/snapshot.json', deployFiles);

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

  shell.rm('-rf', './data/lock');

  // 清理临时目录
  shell.rm('-rf', './temp/*');

  // 清理过期备份文件
  clearBackup(`${currentPath}/history`, currentData.backupExpires);

  let rollbackCommandTips = `./index.js rollback ${project} ${currentFilename}`;
  let buildCommandTips = `./index.js deploy ${project}`;

  if (currentData.rollbackCommandTips) {
    rollbackCommandTips = template(currentData.rollbackCommandTips, {
      user: currentUser,
      project: project,
      versionId: currentFilename
    });
  }

  if (currentData.buildCommandTips) {
    buildCommandTips = template(currentData.buildCommandTips, {
      user: currentUser,
      project: project,
      versionId: currentFilename
    });
  }

  echo.info(`--- 发布到回归机完毕，执行此命令恢复原始版本: ${rollbackCommandTips}`);
  echo.info(`--- 请尽快验证效果后执行部署命令: ${buildCommandTips}`);
};

exports.command = 'build <project> [params]'
exports.describe = '构建项目'
exports.builder = {
};

exports.handler = (argv) => {
  run(argv);
}
