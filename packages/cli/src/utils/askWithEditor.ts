import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import launchEditor from "launch-editor";
import { confirm, isCancel } from "@clack/prompts";

// Does not exit the process if canceled but returns an empty string instead
// This is because we often want to handle the case rather than exiting immediately
export async function askWithEditor(
  initialContents = "",
): Promise<"" | string> {
  const tmpDir = await fs.mkdtemp(tmpdir());
  const tmpFile = path.join(tmpDir, "changeset.md");

  await fs.writeFile(tmpFile, initialContents);
  launchEditor(tmpFile);

  const done = await confirm({
    message: "Opening external editor...",
    active: "Continue",
    inactive: "Cancel",
    initialValue: true,
  });
  if (!done || isCancel(done)) {
    await fs.rm(tmpDir, { recursive: true });
    return "";
  }

  const contents = await fs.readFile(tmpFile, "utf8");
  await fs.rm(tmpDir, { recursive: true });

  return contents
    .replace(/^#.*\n?/gm, "")
    .replace(/\n+$/g, "")
    .trim();
}
