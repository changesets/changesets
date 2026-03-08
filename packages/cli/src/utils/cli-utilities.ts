import {
  cancel,
  confirm,
  groupMultiselect,
  isCancel,
  note,
  Option,
  select,
  text,
} from "@clack/prompts";
import pc from "picocolors";

function cancelFlow(): never {
  cancel("Cancelled... 👋 ");
  process.exit(0);
}

function importantWarning(message: string): void {
  note(message.trim(), pc.yellow("IMPORTANT"), { format: pc.white });
}

export type MultiselectOptions<Value> = Record<string, Option<Value>[]>;
async function askMultiselect<Value>(
  message: string,
  options: MultiselectOptions<Value>,
): Promise<Value[]> {
  const result = await groupMultiselect({
    message,
    selectableGroups: true,
    options,
    required: false,
  });

  if (isCancel(result)) {
    return cancelFlow();
  }
  return result;
}

type QuestionOptions = {
  placeholder?: string;
  notEmpty?: boolean;
};
async function askQuestion(
  message: string,
  { placeholder, notEmpty }: QuestionOptions = {},
): Promise<string> {
  const result = await text({
    message,
    placeholder,
    validate: (input = "") =>
      notEmpty && input.length === 0 ? `Can't be empty.` : undefined,
  });

  if (isCancel(result)) {
    return cancelFlow();
  }
  return result;
}

async function askConfirm(message: string): Promise<boolean> {
  const result = await confirm({
    message,
    initialValue: true,
  });

  if (isCancel(result)) {
    return cancelFlow();
  }
  return result;
}

async function askList<Value extends string>(
  message: string,
  choices: Value[] | Option<Value>[],
): Promise<Value> {
  const options = choices.map<Option<Value>>((choice) =>
    typeof choice === "string" ? ({ value: choice } as Option<Value>) : choice,
  );

  const result = await select({
    message,
    options,
  });

  if (isCancel(result)) {
    return cancelFlow();
  }
  return result as Value;
}

export {
  askConfirm,
  askList,
  askMultiselect,
  askQuestion,
  cancelFlow,
  importantWarning,
};
