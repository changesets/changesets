## @changesets/test-utils

[![View changelog](https://img.shields.io/badge/changelogs.xyz-Explore%20Changelog-brightgreen)](https://changelogs.xyz/@changesets/test-utils)

> Utilities for testing @changesets/* packages

### Utilities

#### temporarilySilenceLogs

Silence the logs created but the `@changesets/logger` packages.

**Usage**

```
// index.test.ts
import { temporarilySilenceLogs } from "@changesets/test-utils";

temporarilySilenceLogs();
```
