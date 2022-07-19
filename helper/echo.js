const chalk = require('chalk');

const log = console.log;

module.exports = {
  info(msg) {
    log();
    log(chalk.cyanBright(msg));
    log();
  },

  error(msg) {
    log();
    log(chalk.redBright(msg));
    log();
  },

  warning(msg) {
    log();
    log(chalk.yellowBright(msg));
    log();
  }
};
