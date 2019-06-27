import uuid from "uuid/v1";
// @ts-ignore it's not worth writing a TS declaration file in this repo for a tiny module we use once like this
import termSize from "term-size";
import logger, { prefix } from "./logger";
// @ts-ignore
import { prompt } from "enquirer";

/* Notes on using inquirer:
 * Each question needs a key, as inquirer is assembling an object behind-the-scenes.
 * At each call, the entire responses object is returned, so we need a unique
 * identifier for the name every time. This is why we are using UUIDs.
 */

const limit = Math.max(termSize().rows - 5, 10);

let cancelFlow = () => {
  logger.success("Cancelled... 👋 ");
  process.exit();
};

async function askCheckboxPlus(
  message: string,
  choices: Array<any>,
  format?: (arg: any) => any
): Promise<Array<string>> {
  const name = `CheckboxPlus-${uuid()}`;

  return prompt({
    type: "autocomplete",
    name,
    message,
    // @ts-ignore
    prefix,
    multiple: true,
    choices,
    format,
    limit,
    onCancel: cancelFlow
  })
    .then((responses: any) => responses[name])
    .catch((err: unknown) => {
      logger.error(err);
    });
}

async function askQuestion(message: string): Promise<string> {
  const name = `Question-${uuid()}`;

  return prompt([
    {
      type: "input",
      message,
      name,
      // @ts-ignore
      prefix,
      onCancel: cancelFlow
    }
  ])
    .then((responses: any) => responses[name])
    .catch((err: unknown) => {
      logger.error(err);
    });
}

async function askConfirm(message: string): Promise<boolean> {
  const name = `Confirm-${uuid()}`;

  return prompt([
    {
      message,
      name,
      // @ts-ignore
      prefix,
      type: "confirm",
      initial: true,
      onCancel: cancelFlow
    }
  ])
    .then((responses: any) => responses[name])
    .catch((err: unknown) => {
      logger.error(err);
    });
}

async function askList(
  message: string,
  choices: Array<string>
): Promise<string> {
  const name = `List-${uuid()}`;

  return prompt([
    {
      choices,
      message,
      name,
      // @ts-ignore
      prefix,
      type: "select",
      onCancel: cancelFlow
    }
  ])
    .then((responses: any) => responses[name])
    .catch((err: unknown) => {
      logger.error(err);
    });
}

export { askCheckboxPlus, askQuestion, askConfirm, askList };
