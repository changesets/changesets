# Auto Mode

The auto mode feature allows Changesets to automatically generate changesets based on conventional commit analysis. This eliminates the need to manually create changesets.

## Overview

Auto mode analyzes conventional commits since the last tag for each package and automatically generates appropriate changesets. It uses the [`@semantic-release/commit-analyzer`](https://github.com/semantic-release/commit-analyzer) to determine the recommended version bump (patch, minor, or major) using the [`conventionalcommits`](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-conventionalcommits) preset.

## Usage

### Basic Usage

```bash
npx changeset add --auto
```

This command will:
1. Analyze all conventional commits since the last tag for each package
2. Determine the appropriate version bump based on commit types
3. Generate changesets automatically for packages that need versioning
4. Skip packages with no relevant commits

### Configuration

Auto mode can be configured in your `.changeset/config.json`:

```json
{
  "auto": {
    "maxCommits": 100,
    "preset": "conventionalcommits",
    "analyzer": "custom-analyzer-function"
  }
}
```

#### Configuration Options

- **`maxCommits`** (optional): Maximum number of commits to analyze per package. Default: `100`
- **`preset`** (optional): Preset for commit analysis. Default: `"conventionalcommits"`
- **`analyzer`** (optional): Custom analyzer function for testing or advanced use cases

### Conventional Commit Types

[Semantic Versioning](https://semver.org/)

## Limitations

- **Committed Changes Only**: Auto mode only analyzes committed changes. Uncommitted changes are ignored.
- **Conventional Commits**: Only conventional commits are analyzed. Non-conventional commits are ignored.
- **Git Tags**: Requires proper git tagging for package versions to work correctly.
- **Monorepo Structure**: Works best with standard monorepo structures where packages are in subdirectories.

## Related Documentation

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Changesets Configuration](./config-file-options.md)
- [Changelog Generation](./modifying-changelog-format.md)
