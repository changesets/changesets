---
"@changesets/pre": patch
---

Fixed return type of the `readPreState` function. It is now properly annotated as `Promise<PreState | undefined>` instead of just `Promise<PreState>`.
