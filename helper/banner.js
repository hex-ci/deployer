const echo = require('./echo');
const pkg = require('../package.json');

const banner = () => {
  echo.info(`===== 欢迎使用轻量级部署工具 Deployer Ver ${pkg.version} =====`);
}

module.exports = banner;
