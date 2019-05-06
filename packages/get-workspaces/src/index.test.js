import { getFixturePath } from "jest-fixtures";

describe.skip("get-workspaces", () => {
  it("should resolve yarn workspaces if the yarn option is passed", () =>
    false);
  it("should resolve bolt workspaces if the bolt option is passed", () =>
    false);
  it("should resolve main package if root option is passed", () => false);
  it("should by default resolve yarn workspaces", () => false);
  it("should by default resolve bolt workspaces if yarn workspaces are absent", () =>
    false);
  it("should by return an empty array if no workspaces are found", () => false);
});
