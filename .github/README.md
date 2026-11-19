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

Commit the workflow changes and generated lockfile together. CI verifies all
workflows, and Dependabot updates the corresponding locks when it bumps actions.

Review changed commits as dependency updates. Investigate changes to `owner_id`
or `repo_id`, which identify the source repository. Do not edit the lockfile by
hand or accept moved references without reviewing the upstream history.
