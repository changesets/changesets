import chalk from "chalk";
import meow from "meow";
import check from "../api/check";
import {
  InternalMismatch,
  ExternalMismatch,
  ErrorObj,
  MissingDep
} from "../types";
import { fix } from "../api";

const getInternalErrorMessage = ({
  pkgName,
  dependency,
  version
}: InternalMismatch) =>
  chalk`{green ${pkgName}} needs to update its dependency on {green ${dependency}} to be compatible with {yellow ${version}}`;

const getMissingDepErrorMessage = ({ pkgName, dependency }: MissingDep) =>
  chalk`{yellow ${dependency}} is a dependency of {green ${pkgName}}, but is not found in the project root.`;

const getExternalErrorMessage = ({
  pkgName,
  dependency,
  rootVersion,
  pkgVersion
}: ExternalMismatch) =>
  chalk`{yellow ${pkgName}} relies on {green ${dependency}} at {red ${pkgVersion}}, but your project relies on  {green ${dependency}} at {green ${rootVersion}}.`;

const rootContainsDevDepsMessage = chalk`the root package.json contains {yellow devDependencies}, this is disallowed as {yellow devDependencies} vs {green dependencies} in a private package does not affect anything and creates confusion.`;

// TODO: This function could sort, and order these errors to make nicer output. Not doing that for now.
let printErrors = (errors: ErrorObj[]) => {
  errors.forEach(error => {
    switch (error.type) {
      case "internalMismatch":
        console.error(getInternalErrorMessage(error));
        break;
      case "externalMismatch":
        console.error(getExternalErrorMessage(error));
        break;
      case "missingDependency":
        console.error(getMissingDepErrorMessage(error));
        break;
      case "rootContainsDevDeps":
        console.error(rootContainsDevDepsMessage);
        break;
      default:
        throw new Error(
          `the error type "${
            // @ts-ignore TS understands that this case will never happen with the current code but it won't throw an error if there is an unhandled case
            error.type
          }" is not handled in printErrors, this is likely a bug in bolt-check, please open an issue`
        );
    }
  });
};

const { flags } = meow(
  `
    Usage
      $ bolt-check
        Performs the bolt-check action. See readme for full details.
        Will exit with code 1 if errors are found.
    Options
      --cwd="some/path"
        Provie a custom current working directory from which to run.
      --fix
        Automatically fixes (most) errors we detect.
      --silent
        Do not show any console warnings.

    `,
  {
    flags: {
      cwd: {
        type: "string",
        default: process.cwd()
      },
      fix: {
        type: "boolean"
      },
      silent: {
        type: "boolean"
      }
    }
  }
);

(async () => {
  const config = { cwd: flags.cwd };
  const errors = await check(config);

  if (errors.length > 0 && !flags.fix) {
    if (!flags.silent) {
      console.error(chalk.red("there are errors in your config!"));
      console.log(
        chalk.cyan("these errors may be fixable with `bolt-check --fix`")
      );

      printErrors(errors);
    }
    process.exit(1);
  } else if (errors.length > 0 && flags.fix) {
    fix(errors, config);
  } else {
    console.log("Looks like your dependencies are fine");
  }
})();
