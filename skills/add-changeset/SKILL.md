---
name: add-changeset
description: "Add a changeset to the current change. Use when preparing a PR that affects published packages, when asked to 'add a changeset' or `add cs`, or when CI reports a missing changeset. Detects monorepos and selects affected packages automatically."
---

# Add Changeset

A changeset declares which packages are affected by a change, the semver bump type, and a user-facing summary. It lives as a markdown file in `.changeset/` and is consumed automatically by CI to version and publish packages.

## When to Add One

**Add a changeset when the change:**
- Fixes a bug in a published package (`patch`)
- Adds a new feature or public API (`minor`)
- Breaks an existing API or removes something (`major`)
- Updates a dependency in a way users need to know about (`patch`)

**Do nothing when:**
- The change is `ci:`, `chore:`, `test:`, or an internal refactor with no API/behavior change
- The only changed files are in `examples/`, `docs/`, or non-published packages (check `private: true` and `"ignore"` in `.changeset/config.json`)
- The only changed files are tests or Storybook stories
- The change is build-process, CI/CD, or development tooling only
- The only dependency changes are `devDependencies`

Tell the user no changeset is needed and why.

## Steps

### 1. Detect the setup

```bash
# Confirm changesets is initialized
ls .changeset/config.json
```

Read `.changeset/config.json` to find:
- `"fixed"` — packages that share the exact same version; bumping one bumps all
- `"linked"` — packages that share the highest bump type but keep independent versions
- `"ignore"` — packages excluded from versioning
- `"access"` — `"public"` means scoped packages publish publicly

### 2. Identify affected packages

First, determine which changes to look at:

```bash
# Check for staged changes
git diff --cached --name-only

# Check for unstaged changes
git diff --name-only
```

**Scope selection rules (in priority order):**

1. **Staged changes exist** → use `git diff --cached --name-only`
2. **Only unstaged changes exist** → use `git diff --name-only`
3. **No local changes** → compare HEAD to base branch: `git diff --name-only origin/main...HEAD`

In a monorepo (has `pnpm-workspace.yaml`, `workspaces` in root `package.json`, or `bun.workspace.ts`), map changed files to their owning package (find nearest `package.json` above each changed file). Apply `fixed` group rules: if any package in a fixed group is affected, all are.

In a single-package repo, the root package is always the affected package.

### 2a. Extract context from commit messages

When scope is **no local changes** (case 3), also read recent commits for context:

```bash
# Commits on this branch not yet on base
git log origin/main..HEAD --oneline
```

Parse conventional commit prefixes to inform bump type and summary:

| Prefix | Implication |
|---|---|
| `feat:` / `feat(scope):` | at least `minor` |
| `fix:` / `fix(scope):` | at least `patch` |
| `BREAKING CHANGE:` footer or `!` after type | `major` |
| `chore:`, `ci:`, `test:`, `docs:` | no changeset needed |

Use the commit message body / subject as a starting point for the changeset summary, rewritten to be user-facing (imperative mood, no implementation details).

### 3. Determine bump type

| Change type | Bump |
|---|---|
| Removes or renames public API, breaks existing usage | `major` |
| Adds new exported function, class, option, or command | `minor` |
| Bug fix, internal refactor, dependency update | `patch` |

> **Pre-1.0 rule:** For packages on `0.x`, use `minor` for breaking changes — this is standard semver for pre-release packages. Only assign `major` to packages at `1.0.0` or higher.

When unsure between minor and patch, ask the user.

### 4. Write the changeset file

Choose a descriptive kebab-case filename that reflects the change (e.g. `fix-button-accessibility.md`, `add-retry-option.md`). Fall back to a random two-word slug (adjective + animal, e.g. `fuzzy-wolves`) when no obvious name fits or to avoid a conflict. Do not use the `changeset` CLI — write the file directly.

```markdown
---
"package-name": patch
---

Add `retry` option to fetch client.
```

- Filename: `.changeset/<name>.md`
- Each affected package gets one line in the frontmatter: `"<name>": <major|minor|patch>`
- For packages in a `fixed` group, list every package in the group with the same bump type
- The body is the user-facing summary (see summary rules below)

**Summary rules** — the body appears verbatim in `CHANGELOG.md`:
- Imperative mood: "Add support for X" not "Added support for X"
- User-facing: describe the effect, not the implementation
- End with a period (`.`)
- Wrap code identifiers (component names, prop names, function names) in backticks
- One line is enough; add bullet points only for breaking changes that need migration steps
- No references to internal file names or commit SHAs

Good: `Add \`retry\` option to fetch client.`
Bad: `Updated fetchClient.ts to handle retries in the error handler`

**Breaking change example** — include migration steps in the body:

```markdown
---
"package-name": major
---

Remove deprecated `oldOption` config key. Use `newOption` instead.

Migration:
- Replace `oldOption: true` with `newOption: true`
```

### 5. Commit the changeset

Only commit the changeset automatically when there were **no local changes** at the start (scope case 3 — branch diff). In that case:

```bash
git add .changeset/
git commit -m "docs: add changeset"
```

If staged or unstaged changes existed (scope cases 1 or 2), tell the user the changeset file has been created and let them include it in their own commit.

## What Happens Next (don't intervene)

Once the changeset is merged to the base branch, the CI release workflow (`changesets/action`) will automatically:
1. Open or update a **"Version Packages"** PR that bumps `package.json` versions and updates `CHANGELOG.md`
2. When that PR is merged, publish to npm and create GitHub releases

**Never manually edit `CHANGELOG.md`** — it is fully generated by `changeset version`. **Never add changesets to a "Version Packages" PR** — it will be overwritten.

## Verification

- [ ] File exists in `.changeset/` with a descriptive or slug filename
- [ ] Frontmatter lists all affected packages with the correct bump type
- [ ] All packages in any `fixed` group are included together
- [ ] Summary is consumer-focused — no internal file names or commit SHAs
- [ ] Code identifiers are wrapped in backticks
- [ ] Summary ends with a period
- [ ] Breaking changes include migration steps
