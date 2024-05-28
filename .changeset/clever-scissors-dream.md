---
"@changesets/config": minor
"@changesets/cli": minor
---

Add support for config file in CommonJS

The changesets configuration file can now be in CommonJS (config.cjs) format in addition to JSON. Despite being code,
the CJS expected format/type of the config object is the same as the JSON format.

Benefits to this change include:

- Comments can now be added to the config file.
- Configurations for some properties (e.g. fixed and linked package groups) can be calculated at runtime.
