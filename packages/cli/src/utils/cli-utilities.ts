import {
  cancel,
  confirm,
  groupMultiselect,
  type GroupMultiSelectOptions,
  isCancel,
  note,
  type Option,
  select,
  text,
} from "@clack/prompts";
import pc from "picocolors";

async function cancelable<T>(task: () => Promise<T | symbol>) {
  const result = await task();
  if (isCancel(result)) {
    cancel("Canceled... 👋 ");
    process.exit(0);
  }
  return result;
}

function importantWarning(message: string): void {
  note(message.trim(), pc.yellow("IMPORTANT"), { format: pc.white });
}

export type MultiselectOptions<Value> = Record<string, Option<Value>[]>;

async function askMultiselect<Value>(
  message: string,
  values: MultiselectOptions<Value>,
  options?: Omit<GroupMultiSelectOptions<Value>, "message" | "options">,
): Promise<Value[]> {
  return cancelable(async () =>
    groupMultiselect({
      selectableGroups: true,
      required: false,
      ...options,
      message,
      options: values,
    }),
  );
}

type QuestionOptions = {
  placeholder?: string;
  notEmpty?: boolean;
};
async function askQuestion(
  message: string,
  { placeholder, notEmpty }: QuestionOptions = {},
): Promise<string> {
  return cancelable(() =>
    text({
      message,
      placeholder,
      validate: (input = "") =>
        notEmpty && input.length === 0 ? `Can't be empty.` : undefined,
    }),
  );
}

async function askConfirm(message: string): Promise<boolean> {
  return cancelable(() =>
    confirm({
      message,
      initialValue: true,
    }),
  );
}

async function askList<Value extends string>(
  message: string,
  choices: Value[] | Option<Value>[],
): Promise<Value> {
  return cancelable(() => {
    const options = choices.map<Option<Value>>((choice) =>
      typeof choice === "string"
        ? ({ value: choice } as Option<Value>)
        : choice,
    );
    return select({
      message,
      options,
    });
  });
}

export { askConfirm, askList, askMultiselect, askQuestion, importantWarning };
