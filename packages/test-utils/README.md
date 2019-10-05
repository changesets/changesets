## @changesets/test-utils

> Utilities for testing @chagesets/* packages

### Utilities

#### temporarilySilenceLogs

Silence the logs created but the `@changesets/logger` packages.

**Usage**

```
// index.test.ts
import { temporarilySilenceLogs } from "@changesets/test-utils";

temporarilySilenceLogs();
```
