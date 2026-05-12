import util from "node:util";
import color from "@changesets/color";

export const prefix: string = "🦋 ";

function format(args: Array<any>, customPrefix?: string) {
  const fullPrefix = prefix + (customPrefix == null ? "" : " " + customPrefix);
  return (
    fullPrefix +
    util
      .format("", ...args)
      .split("\n")
      .join("\n" + fullPrefix + " ")
  );
}

export function error(...args: Array<any>) {
  console.error(format(args, color.red("error")));
}

export function info(...args: Array<any>) {
  console.info(format(args, color.cyan("info")));
}

export function log(...args: Array<any>) {
  console.log(format(args));
}

export function success(...args: Array<any>) {
  console.log(format(args, color.green("success")));
}

export function warn(...args: Array<any>) {
  console.warn(format(args, color.yellow("warn")));
}
