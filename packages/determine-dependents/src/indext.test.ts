import getDependents from "./";

describe("get dependents", () => {
  it("should return a basic dependency update", () => {
    const map = new Map();
    map.set("cool-package", ["best-package"]);
    map.set("best-package", []);

    const dependents = getDependents(
      {
        id: "of course",
        summary: "some string",
        releases: [{ name: "cool-package", type: "patch" }]
      },
      [
        {
          name: "cool-package",
          config: { name: "cool-package", version: "1.0.0" },
          dir: ""
        },
        {
          name: "best-package",
          config: {
            name: "best-package",
            version: "1.0.0",
            dependencies: {
              "cool-package": "1.0.0"
            }
          },
          dir: ""
        }
      ],
      map
    );
    expect(dependents).toEqual([{ name: "best-package", type: "patch" }]);
  });
  it("should return a peerDep update", () => {
    const map = new Map();
    map.set("cool-package", ["best-package"]);
    map.set("best-package", []);

    const dependents = getDependents(
      {
        id: "of course",
        summary: "some string",
        releases: [{ name: "cool-package", type: "patch" }]
      },
      [
        {
          name: "cool-package",
          config: { name: "cool-package", version: "1.0.0" },
          dir: ""
        },
        {
          name: "best-package",
          config: {
            name: "best-package",
            version: "1.0.0",
            peerDependencies: {
              "cool-package": "1.0.0"
            }
          },
          dir: ""
        }
      ],
      map
    );
    expect(dependents).toEqual([{ name: "best-package", type: "major" }]);
  });
  it("should return nothing if none of the depenents need updating", () => {
    const map = new Map();
    map.set("cool-package", ["best-package"]);
    map.set("best-package", []);

    const dependents = getDependents(
      {
        id: "of course",
        summary: "some string",
        releases: [{ name: "cool-package", type: "patch" }]
      },
      [
        {
          name: "cool-package",
          config: { name: "cool-package", version: "1.0.0" },
          dir: ""
        },
        {
          name: "best-package",
          config: {
            name: "best-package",
            version: "1.0.0",
            dependencies: {
              "cool-package": "^1.0.0"
            }
          },
          dir: ""
        }
      ],
      map
    );
    expect(dependents).toEqual([]);
  });
  it("should update multiple dependencies", () => {
    throw "no-test";
  });
  it("should return an empty array when no dependencies are to be updated", () => {
    throw "no-test";
  });
  it("should update a second dependent based on updating a first dependant", () => {
    throw "no-test";
  });
});
