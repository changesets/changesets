// import getDependents from "./";

// describe("get dependents", () => {
//   it("should return a basic dependency update", () => {
//     const map = new Map();
//     map.set("cool-package", ["best-package"]);
//     map.set("best-package", []);

//     const dependents = getDependents(
//       {
//         id: "of course",
//         summary: "some string",
//         releases: [{ name: "cool-package", type: "patch" }]
//       },
//       [
//         {
//           name: "cool-package",
//           config: { name: "cool-package", version: "1.0.0" },
//           dir: ""
//         },
//         {
//           name: "best-package",
//           config: {
//             name: "best-package",
//             version: "1.0.0",
//             dependencies: {
//               "cool-package": "1.0.0"
//             }
//           },
//           dir: ""
//         }
//       ],
//       map
//     );
//     expect(dependents).toEqual([{ name: "best-package", type: "patch" }]);
//   });
//   it("should return a peerDep update", () => {
//     const map = new Map();
//     map.set("cool-package", ["best-package"]);
//     map.set("best-package", []);

//     const dependents = getDependents(
//       {
//         id: "of course",
//         summary: "some string",
//         releases: [{ name: "cool-package", type: "patch" }]
//       },
//       [
//         {
//           name: "cool-package",
//           config: { name: "cool-package", version: "1.0.0" },
//           dir: ""
//         },
//         {
//           name: "best-package",
//           config: {
//             name: "best-package",
//             version: "1.0.0",
//             peerDependencies: {
//               "cool-package": "1.0.0"
//             }
//           },
//           dir: ""
//         }
//       ],
//       map
//     );
//     expect(dependents).toEqual([{ name: "best-package", type: "major" }]);
//   });
//   it("should return an empty array when no dependencies are to be updated", () => {
//     const map = new Map();
//     map.set("cool-package", ["best-package"]);
//     map.set("best-package", []);

//     const dependents = getDependents(
//       {
//         id: "of course",
//         summary: "some string",
//         releases: [{ name: "cool-package", type: "patch" }]
//       },
//       [
//         {
//           name: "cool-package",
//           config: { name: "cool-package", version: "1.0.0" },
//           dir: ""
//         },
//         {
//           name: "best-package",
//           config: {
//             name: "best-package",
//             version: "1.0.0",
//             dependencies: {
//               "cool-package": "^1.0.0"
//             }
//           },
//           dir: ""
//         }
//       ],
//       map
//     );
//     expect(dependents).toEqual([]);
//   });
//   it("should update multiple dependencies", () => {
//     const map = new Map();
//     map.set("cool-package", ["best-package", "silly-package"]);
//     map.set("best-package", ["silly-package"]);
//     map.set("silly-package", []);

//     const dependents = getDependents(
//       {
//         id: "of course",
//         summary: "some string",
//         releases: [{ name: "cool-package", type: "patch" }]
//       },
//       [
//         {
//           name: "cool-package",
//           config: { name: "cool-package", version: "1.0.0" },
//           dir: ""
//         },
//         {
//           name: "best-package",
//           config: {
//             name: "best-package",
//             version: "1.0.0",
//             dependencies: {
//               "cool-package": "1.0.0"
//             }
//           },
//           dir: ""
//         },
//         {
//           name: "silly-package",
//           config: {
//             name: "silly-package",
//             version: "1.0.0",
//             dependencies: {
//               "best-package": "1.0.0",
//               "cool-package": "1.0.0"
//             }
//           },
//           dir: ""
//         }
//       ],
//       map
//     );
//     expect(dependents).toEqual([
//       { name: "best-package", type: "patch" },
//       { name: "silly-package", type: "patch" }
//     ]);
//   });
//   it("should update a second dependent based on updating a first dependant", () => {
//     const map = new Map();
//     map.set("cool-package", ["best-package"]);
//     map.set("best-package", ["silly-package"]);
//     map.set("silly-package", []);

//     const dependents = getDependents(
//       {
//         id: "of course",
//         summary: "some string",
//         releases: [{ name: "cool-package", type: "patch" }]
//       },
//       [
//         {
//           name: "cool-package",
//           config: { name: "cool-package", version: "1.0.0" },
//           dir: ""
//         },
//         {
//           name: "best-package",
//           config: {
//             name: "best-package",
//             version: "1.0.0",
//             dependencies: {
//               "cool-package": "1.0.0"
//             }
//           },
//           dir: ""
//         },
//         {
//           name: "silly-package",
//           config: {
//             name: "silly-package",
//             version: "1.0.0",
//             dependencies: {
//               "best-package": "1.0.0"
//             }
//           },
//           dir: ""
//         }
//       ],
//       map
//     );
//     expect(dependents).toEqual([
//       { name: "best-package", type: "patch" },
//       { name: "silly-package", type: "patch" }
//     ]);
//   });
// });

// describe("stolen from add, we need to validate these cases", () => {
//   it("should patch a single pinned dependent", async () => {
//     const cwd = await copyFixtureIntoTempDir(
//       __dirname,
//       "pinned-caret-tilde-dependents"
//     );
//     mockUserResponses({ releases: { "depended-upon": "patch" } });
//     await addChangeset({ cwd });

//     const expectedChangeset = {
//       summary: "summary message mock",
//       releases: [{ name: "depended-upon", type: "patch" }],
//       dependents: [
//         { name: "pinned-dep", type: "patch", dependencies: ["depended-upon"] }
//       ]
//     };
//     const call = writeChangeset.mock.calls[0][0];
//     expect(call).toEqual(expectedChangeset);
//   });

//   it("should patch pinned and tilde dependents when minor bumping", async () => {
//     const cwd = await copyFixtureIntoTempDir(
//       __dirname,
//       "pinned-caret-tilde-dependents"
//     );
//     mockUserResponses({ releases: { "depended-upon": "minor" } });
//     await addChangeset({ cwd });

//     const expectedChangeset = {
//       summary: "summary message mock",
//       releases: [{ name: "depended-upon", type: "minor" }],
//       dependents: [
//         { name: "pinned-dep", type: "patch", dependencies: ["depended-upon"] },
//         { name: "tilde-dep", type: "patch", dependencies: ["depended-upon"] }
//       ]
//     };
//     const call = writeChangeset.mock.calls[0][0];
//     expect(call).toEqual(expectedChangeset);
//   });

//   it("should patch pinned, tilde and caret deps when major bumping", async () => {
//     const cwd = await copyFixtureIntoTempDir(
//       __dirname,
//       "pinned-caret-tilde-dependents"
//     );
//     mockUserResponses({ releases: { "depended-upon": "major" } });
//     await addChangeset({ cwd });

//     const expectedChangeset = {
//       summary: "summary message mock",
//       releases: [{ name: "depended-upon", type: "major" }],
//       dependents: [
//         { name: "caret-dep", type: "patch", dependencies: ["depended-upon"] },
//         { name: "pinned-dep", type: "patch", dependencies: ["depended-upon"] },
//         { name: "tilde-dep", type: "patch", dependencies: ["depended-upon"] }
//       ]
//     };
//     const call = writeChangeset.mock.calls[0][0];
//     expect(call).toEqual(expectedChangeset);
//   });

//   it("should patch a transitively bumped dependent that leaves range", async () => {
//     // Here we have a project where b -> a and c -> b, all pinned, so bumping a should bump b and c
//     const cwd = await copyFixtureIntoTempDir(
//       __dirname,
//       "simplest-transitive-dependents"
//     );
//     mockUserResponses({ releases: { "pkg-a": "patch" } });
//     await addChangeset({ cwd });

//     const expectedChangeset = {
//       summary: "summary message mock",
//       releases: [{ name: "pkg-a", type: "patch" }],
//       dependents: [
//         { name: "pkg-b", type: "patch", dependencies: ["pkg-a"] },
//         { name: "pkg-c", type: "patch", dependencies: ["pkg-b"] }
//       ]
//     };

//     const call = writeChangeset.mock.calls[0][0];
//     expect(call).toEqual(expectedChangeset);
//   });

//   it("should patch a previously checked transitive dependent", async () => {
//     // Here we use project where b->a (caret) and c->a (pinned) and b -> c (pinned)
//     // Therefore bumping a will bump c (but not b), but bumping c will bump b anyway
//     const cwd = await copyFixtureIntoTempDir(
//       __dirname,
//       "previously-checked-transitive-dependent"
//     );
//     mockUserResponses({ releases: { "pkg-a": "patch" } });
//     await addChangeset({ cwd });

//     const expectedChangeset = {
//       summary: "summary message mock",
//       releases: [{ name: "pkg-a", type: "patch" }],
//       dependents: [
//         { name: "pkg-c", type: "patch", dependencies: ["pkg-a"] },
//         { name: "pkg-b", type: "patch", dependencies: ["pkg-c", "pkg-a"] }
//       ]
//     };
//     const call = writeChangeset.mock.calls[0][0];
//     expect(call).toEqual(expectedChangeset);
//   });
// });

test("we need to fix this", () => {});
