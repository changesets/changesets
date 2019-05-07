import chalk from "chalk";

function log() {
  console.log.apply(this, arguments);
}

function info() {
  console.error.apply(this, [chalk.cyan("info"), ...arguments]);
}

function warn() {
  console.error.apply(this, [chalk.yellow("warn"), ...arguments]);
}

function error() {
  console.error.apply(this, [chalk.red("error"), ...arguments]);
}

function success() {
  console.log.apply(this, [chalk.green("success"), ...arguments]);
}

export default {
  log,
  info,
  warn,
  error,
  success
};
