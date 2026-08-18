import chalk from 'chalk'

export default {
  info(msg) {
    console.log()
    console.log(chalk.cyanBright(msg))
    console.log()
  },

  error(msg) {
    console.log()
    console.log(chalk.redBright(msg))
    console.log()
  },

  warning(msg) {
    console.log()
    console.log(chalk.yellowBright(msg))
    console.log()
  },
}
