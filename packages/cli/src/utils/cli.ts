import uuid from "uuid/v1";
import inquirer from "inquirer";
import fuzzy from "fuzzy";
import { prefix } from "./logger";

inquirer.registerPrompt(
  "checkbox-plus",
  require("inquirer-checkbox-plus-prompt")
);

/* Notes on using inquirer:
 * Each question needs a key, as inquirer is assembling an object behind-the-scenes.
 * At each call, the entire responses object is returned, so we need a unique
 * identifier for the name every time. This is why we are using UUIDs.
 */

async function askCheckboxPlus(
  message: string,
  choices: Array<any>
): Promise<Array<string>> {
  const name = `CheckboxPlus-${uuid()}`;

  // wraps fuzzyfilter, and removes inquirer sepearators/other data invalid to
  // fuzzy.
  async function fuzzySearch(answersSoFar: any, input: string) {
    if (!input) return choices;
    const fuzzyResult = fuzzy.filter(
      input,
      choices.filter(choice => typeof choice === "string")
    );
    const data = fuzzyResult.map(element => element.original);

    return data;
  }

  return inquirer
    .prompt([
      {
        message,
        name,
        prefix,
        // @ts-ignore
        searchable: true,
        pageSize: 10,
        type: "checkbox-plus",
        // TODO: allow chaining this to a custom sort function that is run first
        source: fuzzySearch
      }
    ])
    .then((responses: any) => responses[name]);
}

async function askQuestion(message: string): Promise<string> {
  const name = `Question-${uuid()}`;

  return inquirer
    .prompt([
      {
        message,
        name,
        prefix
      }
    ])
    .then((responses: any) => responses[name]);
}

async function askConfirm(message: string): Promise<boolean> {
  const name = `Confirm-${uuid()}`;

  return inquirer
    .prompt([
      {
        message,
        name,
        prefix,
        type: "confirm"
      }
    ])
    .then((responses: any) => responses[name]);
}

async function askList(
  message: string,
  choices: Array<string>
): Promise<string> {
  const name = `List-${uuid()}`;

  return inquirer
    .prompt([
      {
        choices,
        message,
        name,
        prefix,
        type: "list"
      }
    ])
    .then((responses: any) => responses[name]);
}

async function askCheckbox(
  message: string,
  choices: Array<string>
): Promise<Array<string>> {
  const name = `Checkbox-${uuid()}`;

  return inquirer
    .prompt([
      {
        choices,
        message,
        name,
        prefix,
        type: "checkbox"
      }
    ])
    .then((responses: any) => responses[name]);
}

export { askCheckboxPlus, askQuestion, askConfirm, askList, askCheckbox };
