# Workflow dependencies

Action versions are pinned by `.github/workflows/actions.lock`, including the
dependencies of our shared `$/` setup action. Keep readable version tags in
`uses:` references and let the lockfile record the exact commits.

After adding or changing a workflow or an action dependency, regenerate and
verify the lockfile from the repository root:

```sh
gh extension install github/gh-actions-lock --pin v0.5.0
gh actions-lock
gh actions-lock --verify
```
