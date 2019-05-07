import { getFixturePath } from "jest-fixtures";
import getWorkspaces from "./";

describe("get-workspaces", () => {
  it("should resolve yarn workspaces if the yarn option is passed", async () => {
    let cwd = await getFixturePath(__dirname, "yarn-workspace-base");
    const workspaces = await getWorkspaces({ cwd, tools: ["yarn"] });
    expect(workspaces[0].name).toEqual("yarn-workspace-base-pkg-a");
    expect(workspaces[1].name).toEqual("yarn-workspace-base-pkg-b");
  });
  it("should resolve yarn workspaces if the yarn option is passed and package field is used", async () => {
    let cwd = await getFixturePath(__dirname, "yarn-workspace-package");
    const workspaces = await getWorkspaces({ cwd, tools: ["yarn"] });
    expect(workspaces[0].name).toEqual("yarn-workspace-package-pkg-a");
    expect(workspaces[1].name).toEqual("yarn-workspace-package-pkg-b");
  });
  it("should resolve bolt workspaces if the bolt option is passed", async () => {
    let cwd = await getFixturePath(__dirname, "bolt-workspace");
    const workspaces = await getWorkspaces({ cwd, tools: ["bolt"] });
    expect(workspaces[0].name).toEqual("bolt-workspace-pkg-a");
    expect(workspaces[1].name).toEqual("bolt-workspace-pkg-b");
  });
  it("should resolve main package if root option is passed", async () => {
    let cwd = await getFixturePath(__dirname, "root-only");
    const workspaces = await getWorkspaces({ cwd, tools: ["root"] });
    expect(workspaces.length).toEqual(1);
  });
  it("should by default resolve yarn workspaces", async () => {
    let cwd = await getFixturePath(__dirname, "yarn-workspace-base");
    const workspaces = await getWorkspaces({ cwd });
    expect(workspaces[0].name).toEqual("yarn-workspace-base-pkg-a");
    expect(workspaces[1].name).toEqual("yarn-workspace-base-pkg-b");
  });
  it("should by default resolve bolt workspaces if yarn workspaces are absent", async () => {
    let cwd = await getFixturePath(__dirname, "bolt-workspace");
    const workspaces = await getWorkspaces({ cwd });
    expect(workspaces[0].name).toEqual("bolt-workspace-pkg-a");
    expect(workspaces[1].name).toEqual("bolt-workspace-pkg-b");
  });
  it("should return an empty array if no workspaces are found", async () => {
    let cwd = await getFixturePath(__dirname, "root-only");
    const workspaces = await getWorkspaces({ cwd });
    expect(workspaces).toEqual(null);
  });
});
