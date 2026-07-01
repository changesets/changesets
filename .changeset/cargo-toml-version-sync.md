---
"@changesets/apply-release-plan": minor
---

Update the `version` field of a sibling `Cargo.toml` when versioning a package, if one exists in the package's directory. This lets `changeset version` keep a Rust crate's version (e.g. napi-rs/wasm-bindgen bindings living alongside their `package.json`) in sync with the npm package version. Workspace-inherited versions (`version.workspace = true`) are not supported and will cause `changeset version` to error for that package.
