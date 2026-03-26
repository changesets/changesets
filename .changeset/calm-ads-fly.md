---
"@changesets/config": major
---

Refactored error handling of `read` and `parse` functions. Now returns an object with `config`, `errors` and `warnings` properties.

Rather than throwing a `ValidationError` when encountering errors, the functions will now return `ParseResult`.

If any errors are encountered, the `config` property will be `null`. If no errors are encountered, the `errors` property will be an empty array.

```ts
type ParseResult =
  | {
      config: Config;
      errors: [];
      warnings: string[];
    }
  | {
      config: null;
      errors: string[];
      warnings: string[];
    };
```
