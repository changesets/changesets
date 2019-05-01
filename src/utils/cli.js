import uuid from "uuid/v1";
import inquirer from "inquirer";
import fuzzy from "fuzzy";

inquirer.registerPrompt(
  "checkbox-plus",
  require("inquirer-checkbox-plus-prompt")
);

/* Notes on using inquirer:
 * Each question needs a key, as inquirer is assembling an object behind-the-scenes.
 * At each call, the entire responses object is returned, so we need a unique
 * identifier for the name every time. This is why we are using UUIDs.
 */

async function askCheckboxPlus(message, choices) {
  const name = `CheckboxPlus-${uuid()}`;

  // wraps fuzzyfilter, and removes inquirer sepearators/other data invalid to
  // fuzzy.
  function fuzzySearch(answersSoFar, input) {
    return new Promise(resolve => {
      if (!input) return resolve(choices);
      const fuzzyResult = fuzzy.filter(
        input,
        choices.filter(choice => typeof choice === "string")
      );
      const data = fuzzyResult.map(element => element.original);

      return resolve(data);
    });
  }

  return inquirer
    .prompt([
      {
        message,
        name,
        searchable: true,
        pageSize: 10,
        type: "checkbox-plus",
        // TODO: allow chaining this to a custom sort function that is run first
        source: fuzzySearch
      }
    ])
    .then(responses => responses[name]);
}

async function askQuestion(message) {
  const name = `Question-${uuid()}`;

  return inquirer
    .prompt([
      {
        message,
        name
      }
    ])
    .then(responses => responses[name]);
}

async function askConfirm(message) {
  const name = `Confirm-${uuid()}`;

  return inquirer
    .prompt([
      {
        message,
        name,
        type: "confirm"
      }
    ])
    .then(responses => responses[name]);
}

async function askList(message, choices) {
  const name = `List-${uuid()}`;

  return inquirer
    .prompt([
      {
        choices,
        message,
        name,
        type: "list"
      }
    ])
    .then(responses => responses[name]);
}

async function askCheckbox(message, choices) {
  const name = `Checkbox-${uuid()}`;

  return inquirer
    .prompt([
      {
        choices,
        message,
        name,
        type: "checkbox"
      }
    ])
    .then(responses => responses[name])
    .catch(e => console.log("can we do this?", e));
}

export { askCheckboxPlus, askQuestion, askConfirm, askList, askCheckbox };
