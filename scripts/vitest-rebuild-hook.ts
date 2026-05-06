import { build } from "tsdown";
import type { TestProject } from "vitest/node";

// eslint-disable-next-line import-lite/no-default-export
export default function setup(project: TestProject) {
  if (!process.env.VITEST_SKIP_REBUILD) {
    project.onTestsRerun(async () => {
      console.log("rebuilding...");
      await build({ logLevel: "silent", publint: false });
    });
  }
}
