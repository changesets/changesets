import logger from "../logger";
import pLimit from "p-limit";
import chalk from "chalk";
import spawn from "spawndamnit";

const npmRequestLimit = pLimit(40);

function getCorrectRegistry() {
  let registry =
    process.env.npm_config_registry === "https://registry.yarnpkg.com"
      ? undefined
      : process.env.npm_config_registry;
  return registry;
}

export function info(pkgName: string) {
  return npmRequestLimit(async () => {
    logger.info(`npm info ${pkgName}`);

    // Due to a couple of issues with yarnpkg, we also want to override the npm registry when doing
    // npm info.
    // Issues: We sometimes get back cached responses, i.e old data about packages which causes
    // `publish` to behave incorrectly. It can also cause issues when publishing private packages
    // as they will always give a 404, which will tell `publish` to always try to publish.
    // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
    const envOverride = {
      npm_config_registry: getCorrectRegistry()
    };

    let result = await spawn("npm", ["info", pkgName, "--json"], {
      env: Object.assign({}, process.env, envOverride)
    });

    return JSON.parse(result.stdout);
  });
}

export async function infoAllow404(pkgName: string) {
  try {
    let pkgInfo = await info(pkgName);
    return { published: true, pkgInfo };
  } catch (error) {
    let output = JSON.parse(error.stdout);
    if (output.error && output.error.code === "E404") {
      logger.warn(`Recieved 404 for npm info ${chalk.cyan(`"${pkgName}"`)}`);
      return { published: false, pkgInfo: {} };
    }
    throw error;
  }
}

export function publish(
  pkgName: string,
  opts: { cwd?: string; access?: string } = {}
) {
  return npmRequestLimit(async () => {
    logger.info(`npm publish ${pkgName}`);
    let publishFlags = opts.access ? ["--access", opts.access] : [];
    try {
      // Due to a super annoying issue in yarn, we have to manually override this env variable
      // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
      const envOverride = {
        npm_config_registry: getCorrectRegistry()
      };
      let child = spawn("npm", ["publish", ...publishFlags], {
        cwd: opts.cwd,
        env: Object.assign({}, process.env, envOverride)
      });

      child.on("stdout", (data: Buffer) => {
        logger.log(
          logger.format(
            [data.toString()],
            chalk.cyan(`(${pkgName}) npm publish $ `)
          )
        );
      });

      child.on("stderr", (data: Buffer) => {
        logger.log(
          logger.format(
            [data.toString()],
            chalk.red(`(${pkgName}) npm publish $ `)
          )
        );
      });

      await child;
      return { published: true };
    } catch (error) {
      // Publish failed
      return { published: false };
    }
  });
}
