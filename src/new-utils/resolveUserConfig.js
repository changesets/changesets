import path from "path";
import fs from "fs-extra";

async function resolveConfig(config) {
  const changesetBase = await path.join(config.cwd, ".changeset");

  const configPath = path.resolve(changesetBase, "config.js");
  const hasConfigFile = await fs.pathExists(configPath);

  if (hasConfigFile) {
    try {
      // eslint-disable-next-line
      const loadedConfig = require(configPath);
      return loadedConfig;
    } catch (error) {
      console.error("There was an error reading your changeset config", error);
      throw error;
    }
  } else {
    return {};
  }
}

module.exports = resolveConfig;
