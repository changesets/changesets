import chalk from "chalk";
import util from "util";

export let prefix = "🦋 ";

function format(args: Array<any>, customPrefix?: string) {
  let fullPrefix =
    prefix + (customPrefix === undefined ? "" : " " + customPrefix);
  return (
    fullPrefix +
    util
      .format("", ...args)
      .split("\n")
      .join("\n" + fullPrefix + " ")
  );
}

function log(...args: Array<any>) {
  console.log(format(args));
}

function info(...args: Array<any>) {
  console.error(format(args, chalk.cyan("info")));
}

function warn(...args: Array<any>) {
  console.error(format(args, chalk.yellow("warn")));
}

function error(...args: Array<any>) {
  console.error(format(args, chalk.red("error")));
}

function success(...args: Array<any>) {
  console.log(format(args, chalk.green("success")));
}

export default {
  log,
  info,
  warn,
  error,
  success
};
