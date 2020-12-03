/* eslint-disable import/no-commonjs */
/* eslint-disable import/no-extraneous-dependencies */
const git = require("@changesets/git");

console.log("🦋 New tag: pkg-a@1.0.0");
console.log("🦋 New tag: pkg-b@1.0.0");

git.tag("pkg-a@1.0.0", process.cwd());
git.tag("pkg-b@1.0.0", process.cwd());
