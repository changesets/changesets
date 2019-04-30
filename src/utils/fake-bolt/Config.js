// @flow
import pkgUp from "pkg-up";
import detectIndent from "detect-indent";
import parseJson from "parse-json";
// import type { JSONValue, DependencySet } from './types';
import * as fs from "./utils/fs";
import * as path from "path";
import * as globs from "./utils/globs";
import * as logger from "./utils/logger";
import * as messages from "./utils/messages";
import { BoltError } from "./utils/errors";

async function getPackageStack(cwd: string) {
  let stack = [];
  let searching = cwd;

  while (searching) {
    let filePath = await Config.findConfigFile(searching);

    if (filePath) {
      let config = await Config.init(filePath);
      stack.unshift({ filePath, config });
      searching = path.dirname(path.dirname(filePath));
    } else {
      searching = null;
    }
  }

  return stack;
}

function toArrayOfStrings(value: JSONValue, message: string) {
  if (!Array.isArray(value)) {
    throw new BoltError(message);
  }

  return value.map(item => {
    if (typeof item !== "string") {
      throw new BoltError(message);
    } else {
      return item;
    }
  });
}

function toObject(value: JSONValue, message: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BoltError(message);
  } else {
    return value;
  }
}

function toObjectOfStrings(value: JSONValue, message: string) {
  let safeRef = toObject(value, message);
  let safeCopy = {};

  Object.keys(safeRef).forEach(k => {
    if (typeof safeRef[k] !== "string") {
      throw new BoltError(message);
    } else {
      safeCopy[k] = safeRef[k];
    }
  });

  return safeCopy;
}

export default class Config {
  filePath: string;
  fileContents: string;
  json: JSONValue;
  indent: string;
  invalid: boolean;

  constructor(filePath: string, fileContents: string) {
    this.filePath = filePath;
    this.fileContents = fileContents;
    try {
      this.indent = detectIndent(fileContents).indent || "  ";
      this.json = parseJson(fileContents);
    } catch (e) {
      if (e.name === "JSONError") {
        logger.error(messages.errorParsingJSON(filePath), {
          emoji: "💥",
          prefix: false
        });
      }
      throw e;
    }
  }

  static async findConfigFile(filePath: string): Promise<?string> {
    return await pkgUp(filePath);
  }

  static async init(filePath: string): Promise<Config> {
    let fileContents;
    try {
      fileContents = await fs.readFile(filePath);
    } catch (e) {
      if (e.code === "ENOENT") {
        logger.error(messages.cannotInitConfigMissingPkgJSON(filePath));
      }
      throw e;
    }
    return new Config(filePath, fileContents.toString());
  }

  async write(json: JSONValue) {
    let fileContents = JSON.stringify(json, null, this.indent);
    await fs.writeFile(this.filePath, fileContents);
    this.fileContents = fileContents;
    this.json = json;
  }

  static async getProjectConfig(cwd: string) {
    let stack = await getPackageStack(cwd);
    if (stack.length === 0) return null;

    let highest = stack.pop();
    let matches = [highest];

    while (stack.length) {
      let current = stack.pop();
      let patterns = current.config.getWorkspaces();

      if (patterns) {
        let filePaths = matches.map(match => {
          return path.relative(
            path.dirname(current.filePath),
            path.dirname(match.filePath)
          );
        });

        let found = globs.matchWorkspaces(filePaths, patterns);

        if (found.length) {
          matches.push(current);
          highest = current;
        }
      }
    }

    return highest.filePath;
  }

  getConfig(): { [key: string]: JSONValue } {
    if (this.invalid) {
      throw new BoltError(
        `You need to refresh the Config object for ${this.filePath}`
      );
    }
    let config = this.json;

    if (
      typeof config !== "object" ||
      config === null ||
      Array.isArray(config)
    ) {
      throw new BoltError(
        `package.json must be an object. See: "${this.filePath}"`
      );
    }

    return config;
  }

  invalidate() {
    this.invalid = true;
  }

  getDescriptor(): string {
    if (this.json && typeof this.json.name === "string") {
      return this.json.name;
    } else {
      return this.filePath;
    }
  }

  getName(): string {
    let config = this.getConfig();
    let name = config.name;
    if (typeof name !== "string") {
      throw new BoltError(
        `package.json#name must be a string. See "${this.filePath}"`
      );
    }
    return name;
  }

  getVersion(): string {
    let config = this.getConfig();
    let version = config.version;
    if (typeof version !== "string") {
      throw new BoltError(
        `package.json#version must be a string. See "${this.filePath}"`
      );
    }
    return version;
  }

  getPrivate(): boolean | void {
    let config = this.getConfig();
    let priv = config.private;
    if (typeof priv !== "undefined" && typeof priv !== "boolean") {
      throw new BoltError(
        `package.json#private must be a boolean. See "${this.filePath}"`
      );
    }
    return priv;
  }

  getBoltConfig(): { [key: string]: JSONValue } | void {
    let config = this.getConfig();
    let boltConfig = config.bolt;
    if (typeof boltConfig === "undefined") return;
    return toObject(
      boltConfig,
      `package.json#bolt must be an object. See "${this.filePath}"`
    );
  }

  getBoltConfigVersion(): string | void {
    let config = this.getBoltConfig();
    let boltVersion = config && config.version;
    if (typeof boltVersion === "string") {
      return boltVersion;
    }
    return;
  }

  getWorkspaces(): Array<string> | void {
    let boltConfig = this.getBoltConfig();
    if (typeof boltConfig === "undefined") return;
    let workspaces = boltConfig.workspaces;
    if (typeof workspaces === "undefined") return;
    return toArrayOfStrings(
      workspaces,
      `package.json#bolt.workspaces must be an array of globs. See "${
        this.filePath
      }"`
    );
  }

  getDeps(depType: string): DependencySet | void {
    let config = this.getConfig();
    let deps = config[depType];
    if (typeof deps === "undefined") return;
    return toObjectOfStrings(
      deps,
      `package.json#${depType} must be an object of strings. See "${
        this.filePath
      }"`
    );
  }

  getScripts() {
    let config = this.getConfig();
    let scripts = config.scripts;
    if (typeof scripts === "undefined") return;
    return toObjectOfStrings(
      scripts,
      `package.json#scripts must be an object of strings. See "${
        this.filePath
      }"`
    );
  }

  getBin() {
    let config = this.getConfig();
    let bin = config.bin;
    if (typeof bin === "undefined") return;
    if (typeof bin === "string") return bin;
    return toObjectOfStrings(
      bin,
      `package.json#bin must be an object of strings or a string. See "${
        this.filePath
      }"`
    );
  }
}
