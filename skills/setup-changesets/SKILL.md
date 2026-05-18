---
name: setup-changesets
description: "Set up changesets in a new or existing repository. Use when asked to 'add changesets', 'set up releases', or 'configure versioning'. Handles single packages and monorepos. Optionally sets up a shared reusable workflow in a <user/org>/.github repo."
---

# Setup Changesets

Changesets automates versioning and changelog generation. Contributors add changeset files describing their changes; CI consumes them to bump versions, update changelogs, and publish packages.

## Step 1 — Gather context

Before doing anything, detect or ask:

**Detect automatically:**

| Check | How |
|---|---|
| Package manager | Look for `pnpm-lock.yaml`, `bun.lock`/`bun.lockb`, `yarn.lock`, `package-lock.json` |
| Monorepo | `pnpm-workspace.yaml`, `workspaces` field in root `package.json`, or `bun.workspace.ts` |
| Already initialized | `.changeset/` directory exists |

**Ask the user:**

1. "Do you want to also create a reusable workflow in a `<org-or-user>/.github` repo, so other repos can share the same release pipeline?"
   - Yes → follow [Shared workflow setup](#shared-workflow-setup) after completing local setup
   - No → inline the workflow in `.github/workflows/release.yml`

2. If monorepo: "Are any packages versioned together (always share the same version)?" → `fixed` groups
3. "Are any packages private/internal and should be excluded from publishing?" → `ignore` list

## Step 2 — Initialize

```bash
# pnpm
pnpm dlx @changesets/cli init

# bun
bunx @changesets/cli init

# npm / yarn
npx @changesets/cli init
```

This creates `.changeset/config.json` and `.changeset/README.md`.

## Step 3 — Configure `.changeset/config.json`

Replace the generated config with appropriate settings:

**Single package:**
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main"
}
```

**Monorepo with grouped packages:**
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main",
  "fixed": [["package-a", "package-b"]],
  "linked": [],
  "ignore": ["internal-tools"],
  "updateInternalDependencies": "patch"
}
```

Key decisions:
- `"access": "public"` — required for publishing scoped packages (`@scope/name`) publicly; private packages ignore this
- `"fixed"` — packages that must always share the exact same version number
- `"linked"` — packages that share the highest bump type but keep independent version numbers
- `"ignore"` — packages excluded from changeset versioning entirely (e.g. `examples`, internal CLIs)
- `"commit": false` — recommended; `changeset version` won't auto-commit, giving you control

## Step 4 — Add scripts to `package.json`

```json
{
  "scripts": {
    "version": "changeset version",
    "release": "changeset publish",
    "cs": "changeset"
  }
}
```

`cs` is a shorthand for adding changesets during development. `version` and `release` are called by CI.

If the project has a build step that must run before publishing, update `release`:
```json
"release": "pnpm build && changeset publish"
```

## Step 5 — Set up the CI release workflow

### Option A — Inline workflow (simpler, self-contained)

Create `.github/workflows/release.yml`:

```yaml
name: release
on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Insert package manager setup here (see below)

      - run: <install-command>
      - run: <build-command>        # remove if no build step

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          version: <pm> run version
          publish: <pm> run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Replace `<pm>` with `pnpm`, `bun`, `npm`, or `yarn`. Replace `<install-command>` with `pnpm install --frozen-lockfile`, `bun install`, etc.

**Package manager setup snippets:**

pnpm:
```yaml
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
```

bun:
```yaml
- uses: oven-sh/setup-bun@v2
- uses: actions/setup-node@v4
  with:
    node-version: 22
```

npm/yarn:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm   # or: yarn
```

**Token note:** `GITHUB_TOKEN` is sufficient for most setups. If your repo has branch protection rules that require CI status checks on the "Version Packages" PR, you'll need a PAT with `repo` scope stored as a secret (e.g. `RELEASE_TOKEN`) and passed as `GITHUB_TOKEN: ${{ secrets.RELEASE_TOKEN }}` — this lets the action's commits trigger CI.

### Option B — Shared workflow <a name="shared-workflow-setup"></a>

Use this when you want all your repos to share one release pipeline definition. Changes to the shared workflow apply to all repos at once.

**In the `<user-or-org>/.github` repo**, create `.github/workflows/release-changeset.yml`:

```yaml
name: release-changeset
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '22'
    outputs:
      published:
        description: 'Whether packages were published'
        value: ${{ jobs.release.outputs.published }}

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    outputs:
      published: ${{ steps.changesets.outputs.published }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      # Add your standard setup steps here (package manager, node, install, build)
      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          version: <pm> run version
          publish: <pm> run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**In each consuming repo**, create `.github/workflows/release.yml`:

```yaml
name: release
on:
  push:
    branches: [main]

jobs:
  release:
    uses: <user-or-org>/.github/.github/workflows/release-changeset.yml@main
    secrets: inherit
```

## Step 6 — Add secrets to the repository

Go to **Settings → Secrets and variables → Actions** and add:

- `NPM_TOKEN` — an npm automation token (create at npmjs.com → Access Tokens → Generate New Token → Automation)
- `RELEASE_TOKEN` — optional PAT, only needed if branch protection requires CI on the "Version Packages" PR

## Step 7 — Verify

```bash
# Add a test changeset
npx changeset add --empty

# Check it was created
ls .changeset/

# Check the release workflow is valid (if using GitHub CLI)
gh workflow list
```

## What the automated flow looks like

Once set up, the full cycle is:

1. Developer adds a changeset file to their PR (see `add-changeset` skill)
2. PR merges to main
3. CI runs `changesets/action` — detects new changesets, opens/updates a **"Version Packages"** PR
4. When ready to release, merge the "Version Packages" PR
5. CI runs again — no pending changesets, so it runs `release` and publishes to npm

The "Version Packages" PR is fully managed by the action. Do not manually edit `CHANGELOG.md` or the version numbers it touches.
