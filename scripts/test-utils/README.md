## @changesets/test-utils

> Utilities for testing @changesets/\* packages

### Utilities

#### temporarilySilenceLogs

Silence the logs created but the `@changesets/logger` packages.

**Usage**

```
// index.test.ts
import { temporarilySilenceLogs } from "@changesets/test-utils";

temporarilySilenceLogs();
```

#### setEnvironmentVariable

Set a `process.env` variable temporarily, and clean up later.

**Usage**

```
// index.test.ts
import { setEnvironmentVariable } from "@changesets/test-utils";

const cleanup = setEnvironmentVariable('VAR_NAME', 'value');

cleanup();
```
