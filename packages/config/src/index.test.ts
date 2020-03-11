import fixturez from "fixturez";
import { read, parse } from "./";
import jestInCase from "jest-in-case";
import * as logger from "@changesets/logger";
import { Packages } from "@manypkg/get-packages";

jest.mock("@changesets/logger");

let f = fixturez(__dirname);

let defaultPackages: Packages = {
  root: {
    packageJson: { name: "", version: "" },
    dir: "/"
  },
  packages: [],
  tool: "yarn"
};

test("read reads the config", async () => {
  let dir = f.find("new-config");
  let config = await read(dir, defaultPackages);
  expect(config).toEqual({
    linked: [],
    changelog: false,
    commit: true,
    access: "restricted",
    baseBranch: "master"
  });
});

let defaults = {
  linked: [],
  changelog: ["@changesets/cli/changelog", null],
  commit: false,
  access: "restricted",
  baseBranch: "master"
} as const;

let correctCases = {
  defaults: {
    input: {},
    output: defaults
  },
  "changelog string": {
    input: {
      changelog: "some-module"
    },
    output: {
      ...defaults,
      changelog: ["some-module", null]
    }
  },
  "changelog false": {
    input: {
      changelog: false
    },
    output: {
      ...defaults,
      changelog: false
    }
  },
  "changelog tuple": {
    input: {
      changelog: ["some-module", { something: true }]
    },
    output: {
      ...defaults,
      changelog: ["some-module", { something: true }]
    }
  },
  "commit false": {
    input: {
      commit: false
    },
    output: {
      ...defaults,
      commit: false
    }
  },
  "commit true": {
    input: {
      commit: true
    },
    output: {
      ...defaults,
      commit: true
    }
  },
  "access private": {
    input: {
      access: "restricted"
    },
    output: {
      ...defaults,
      access: "restricted"
    }
  },
  "access public": {
    input: {
      access: "public"
    },
    output: {
      ...defaults,
      access: "public"
    }
  },
  linked: {
    input: {
      linked: [["pkg-a", "pkg-b"]]
    },
    output: {
      ...defaults,
      linked: [["pkg-a", "pkg-b"]]
    }
  }
} as const;

jestInCase(
  "parse",
  testCase => {
    expect(
      parse(testCase.input, {
        ...defaultPackages,
        packages: [
          {
            packageJson: { name: "pkg-a", version: "" },
            dir: "dir"
          },
          {
            packageJson: { name: "pkg-b", version: "" },
            dir: "dir"
          }
        ]
      })
    ).toEqual(testCase.output);
  },
  correctCases
);

let unsafeParse = parse as any;

describe("parser errors", () => {
  test("changelog invalid value", () => {
    expect(() => {
      unsafeParse({ changelog: {} });
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The \`changelog\` option is set as {} when the only valid values are undefined, a module path(e.g. \\"@changesets/cli/changelog\\" or \\"./some-module\\") or a tuple with a module path and config for the changelog generator(e.g. [\\"@changesets/cli/changelog\\", { someOption: true }])"
`);
  });
  test("changelog array with 3 values", () => {
    expect(() => {
      unsafeParse({ changelog: ["some-module", "something", "other"] });
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The \`changelog\` option is set as [
  \\"some-module\\",
  \\"something\\",
  \\"other\\"
] when the only valid values are undefined, a module path(e.g. \\"@changesets/cli/changelog\\" or \\"./some-module\\") or a tuple with a module path and config for the changelog generator(e.g. [\\"@changesets/cli/changelog\\", { someOption: true }])"
`);
  });
  test("changelog array with first value not string", () => {
    expect(() => {
      unsafeParse({ changelog: [false, "something"] });
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The \`changelog\` option is set as [
  false,
  \\"something\\"
] when the only valid values are undefined, a module path(e.g. \\"@changesets/cli/changelog\\" or \\"./some-module\\") or a tuple with a module path and config for the changelog generator(e.g. [\\"@changesets/cli/changelog\\", { someOption: true }])"
`);
  });
  test("access other string", () => {
    expect(() => {
      unsafeParse({ access: "something" });
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The \`access\` option is set as \\"something\\" when the only valid values are undefined, \\"public\\" or \\"restricted\\""
`);
  });
  test("commit non-boolean", () => {
    expect(() => {
      unsafeParse({ commit: "something" });
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The \`commit\` option is set as \\"something\\" when the only valid values are undefined or a boolean"
`);
  });
  test("linked non-array", () => {
    expect(() => {
      unsafeParse({ linked: {} });
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The \`linked\` option is set as {} when the only valid values are undefined or an array of arrays of package names"
`);
  });
  test("linked array of non array", () => {
    expect(() => {
      unsafeParse({ linked: [{}] });
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The \`linked\` option is set as [
  {}
] when the only valid values are undefined or an array of arrays of package names"
`);
  });
  test("linked array of array of non-string", () => {
    expect(() => {
      unsafeParse({ linked: [[{}]] });
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The \`linked\` option is set as [
  [
    {}
  ]
] when the only valid values are undefined or an array of arrays of package names"
`);
  });
  test("linked pacakge that does not exist", () => {
    expect(() => {
      parse({ linked: [["pkg-a"]] }, defaultPackages);
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The package \\"pkg-a\\" is specified in the \`linked\` option but it is not found in the project. You may have misspelled the package name."
`);
  });
  test("linked package in two linked groups", () => {
    expect(() => {
      parse(
        { linked: [["pkg-a"], ["pkg-a"]] },
        {
          ...defaultPackages,
          packages: [
            {
              packageJson: { name: "pkg-a", version: "" },
              dir: "dir"
            }
          ]
        }
      );
    }).toThrowErrorMatchingInlineSnapshot(`
"Some errors occurred when validating the changesets config:
The package \\"pkg-a\\" is in multiple sets of linked packages. Packages can only be in a single set of linked packages."
`);
  });
  test("access private warns and sets to restricted", () => {
    let config = unsafeParse({ access: "private" }, []);
    expect(config).toEqual(defaults);
    expect(logger.warn).toBeCalledWith(
      'The `access` option is set as "private", but this is actually not a valid value - the correct form is "restricted".'
    );
  });
});
