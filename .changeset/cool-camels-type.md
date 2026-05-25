---
"@changesets/config": major
---

Removed `read` and `parse` functions in favor of `readConfig`, which returns `{ config, warnings, errors }` instead of throwing on issues.

```ts
// before.ts
import { parse } from "@changesets/config";
import { getPackages } from "@manypkg/get-packages";

const config = parse({ commit: true }, await getPackages());

try {
  return parse({ commit: true }, packages);
} catch (err) {
  if (err instanceof ValidationError) {
    console.error(`Invalid config: ${err.message}`);
  } else {
    throw err;
  }
}

// after.ts
import { readConfig } from "@changesets/config";
import { getPackages } from "@manypkg/get-packages";

// both arguments are optional
const { config, warnings, errors } = readConfig(
  process.cwd(),
  await getPackages(),
);

if (warnings.length !== 0) {
  console.warn(warnings.join("\n"));
}
if (config == null) {
  console.error(errors.join("\n"));
}
```
