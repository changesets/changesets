import { getFixturePath } from "jest-fixtures";

describe("get-workspaces", () => {
  it("should resolve yarn workspaces if the yarn option is passed");
  it("should resolve bolt workspaces if the bolt option is passed");
  it("should resolve main package if root option is passed");
  it("should by default resolve yarn workspaces");
  it("should by default resolve bolt workspaces if yarn workspaces are absent");
  it("should by return an empty array if no workspaces are found");
});
