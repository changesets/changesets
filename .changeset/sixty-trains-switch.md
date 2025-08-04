---
"@changesets/changelog-github": patch
---

Add a config parameter to avoid adding users' references within the changelog.

## How to configure it

Add the `skipAuthors` parameter within the configuration options, as a sibling of the `repo` parameter.
If not provided or set to false, this will behave as it does now.

```
//.changeset/config.json

{
    "changelog": [
      "@changesets/changelog-github",
      { "repo": "changesets/changesets", "skipAuthors": true }
    ],
    ...
}
```
