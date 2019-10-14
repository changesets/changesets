import { copyFixtureIntoTempDir } from "jest-fixtures";
import prerelease from "./index";
import { defaultConfig } from "@changesets/config";

let cwd: string;

const consoleError = console.error;

beforeEach(async () => {
  cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
  console.error = jest.fn();
});

afterEach(async () => {
  jest.clearAllMocks();
  console.error = consoleError;
});

it("should work", async () => {
  await prerelease(cwd, { tag: "next" }, defaultConfig);
});
