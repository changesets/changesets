import chalk from "chalk";

export let prefix = "🦋 ";

function log(...args: Array<any>) {
  console.log(prefix, ...args);
}

function info(...args: Array<any>) {
  console.error(prefix, chalk.cyan("info"), ...args);
}

function warn(...args: Array<any>) {
  console.error(prefix, chalk.yellow("warn"), ...args);
}

function error(...args: Array<any>) {
  console.error(prefix, chalk.red("error"), ...args);
}

function success(...args: Array<any>) {
  console.log(prefix, chalk.green("success"), ...args);
}

export default {
  log,
  info,
  warn,
  error,
  success
};
