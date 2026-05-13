import util from "node:util";
import c from "@changesets/color";

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
  console.error(format(args, c.red("error")));
}

export function info(...args: Array<any>) {
  console.info(format(args, c.cyan("info")));
}

export function log(...args: Array<any>) {
  console.log(format(args));
}

export function success(...args: Array<any>) {
  console.log(format(args, c.green("success")));
}

export function warn(...args: Array<any>) {
  console.warn(format(args, c.yellow("warn")));
}
