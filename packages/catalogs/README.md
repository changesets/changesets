# @changesets/catalogs

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/catalogs?name=true)](https://npmx.dev/package/@changesets/catalogs)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

Reads and updates the dependency catalogs of a workspace - `catalog` / `catalogs`
in `pnpm-workspace.yaml` (pnpm), `.yarnrc.yml` (Yarn) or `package.json` (Bun).

```ts
import { readCatalogs, resolveCatalogRange } from "@changesets/catalogs";

const catalogs = await readCatalogs(cwd);

// "^19.0.0"
resolveCatalogRange("catalog:", "react", catalogs);
```

Mostly published for use in [changesets](https://npmx.dev/@changesets/cli)
