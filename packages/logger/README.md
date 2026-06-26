## @changesets/logger

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/logger?name=true)](https://npmx.dev/package/@changesets/logger)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

### Usage

```js
import { error } from '@changesets/logger";

error('message part 1', 'message part 2');
```

### Package Exports

**error**: Use `error` to print error messages upon which users which immediately action to complete the task.

**info**: Use `info` to print informational messages to user.

**log**: Use `log` to print messages don't fall in any other specific category. For example, message to show title of the step being performed by the changesets tool.

**success**: Use `success` to assert to users that their instructions have completed successfully.

**warn**: Use `warn` to print warning messages, something that user could action on now or later without much impact of their work.

### Silencing Messages In Tests

Use the `@changesets/test-utils` package to silence the logs in test cases.

For example:

```js
import { temporarilySilenceLogs } from "@changesets/test-utils";
import { log } from "@changesets/logger";

temporarilySilenceLogs();

// Now the logs in this test file are not actually logged to std out
log("I am not logged");

// Use console.log to log messages in tests if required
console.log("Yay, I am logged");
```
