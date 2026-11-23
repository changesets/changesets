import { describe, expect, it } from "vitest";
import { mdLink } from "./utils.ts";

describe("mdLink", () => {
  it("should build a markdown link", () => {
    expect(mdLink("test", "https://example.com")).toEqual(
      "[test](https://example.com)",
    );
  });

  it("should join path parts in rest parameters", () => {
    expect(mdLink("test", "https://example.com", "foo", "bar")).toEqual(
      "[test](https://example.com/foo/bar)",
    );
  });

  it("should clean up extra slashes", () => {
    expect(mdLink("test", "https://example.com", "/foo/", "/bar")).toEqual(
      "[test](https://example.com/foo/bar)",
    );
  });
});
