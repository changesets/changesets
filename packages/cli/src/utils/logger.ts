import chalk from "chalk";

function log(...args: Array<any>) {
  console.log(...args);
}

function info(...args: Array<any>) {
  console.error(chalk.cyan("info"), ...args);
}

function warn(...args: Array<any>) {
  console.error(chalk.yellow("warn"), ...args);
}

function error(...args: Array<any>) {
  console.error(chalk.red("error"), ...args);
}

function success(...args: Array<any>) {
  console.log(chalk.green("success"), ...args);
}

export default {
  log,
  info,
  warn,
  error,
  success
};
