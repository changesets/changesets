import uuid from "uuid/v1";
import { prefix } from "./logger";
// @ts-ignore
import { prompt } from "enquirer";

/* Notes on using inquirer:
 * Each question needs a key, as inquirer is assembling an object behind-the-scenes.
 * At each call, the entire responses object is returned, so we need a unique
 * identifier for the name every time. This is why we are using UUIDs.
 */

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
    format
  }).then((responses: any) => responses[name]);
}

async function askQuestion(message: string): Promise<string> {
  const name = `Question-${uuid()}`;

  return prompt([
    {
      type: "input",
      message,
      name,
      // @ts-ignore
      prefix
    }
  ]).then((responses: any) => responses[name]);
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
      initial: true
    }
  ]).then((responses: any) => responses[name]);
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
      type: "select"
    }
  ]).then((responses: any) => responses[name]);
}

export { askCheckboxPlus, askQuestion, askConfirm, askList };
