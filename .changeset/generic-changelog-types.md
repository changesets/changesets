---
"@changesets/types": minor
"@changesets/changelog-github": patch
---

Add generic type parameters to ChangelogFunctions for better type safety

This change introduces generic type parameters to `ChangelogFunctions`, `GetReleaseLine`, and `GetDependencyReleaseLine` types, allowing plugin authors to specify exact option types for better type safety and IDE support.

**New features:**

- Added `DefaultChangelogOptions` type for backward compatibility
- Enhanced `ChangelogFunctions<ChangelogOptions>` with generic type parameter
- Added comprehensive TSDoc documentation with type references
- Maintains full backward compatibility with existing code

**Benefits:**

- Type-safe changelog options with autocomplete support
- Better developer experience for plugin authors
- Eliminates need for complex type workarounds
- Clear documentation with examples

**Example usage:**

```typescript
// Strongly typed changelog
const myChangelog: ChangelogFunctions<{ repo: string }> = {
  getReleaseLine: async (changeset, type, options) => {
    // options.repo is now strongly typed as string
    return `- ${changeset.summary}`;
  },
};

// Backward compatible (existing code continues to work)
const simpleChangelog: ChangelogFunctions = {
  getReleaseLine: async (changeset, type) => `- ${changeset.summary}`,
};
```
