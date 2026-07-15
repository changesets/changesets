# Package Manager `info` Behavior

Local probe used `@pnpm/pnpr` with `pkg-a@1.0.0-beta.0` published under `beta` only:

```json
{
  "versions": ["1.0.0-beta.0"],
  "dist-tags": {
    "beta": "1.0.0-beta.0"
  }
}
```

There is no `latest` dist-tag.

## Existing Package With Only Beta Prereleases

| Command                          | npm 11                                                            | npm 12                                                            | pnpm 11                                                           | Yarn 4                                                                                                    | Bun 1.3.14                                              |
| -------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `info pkg-a --json`              | exit `0`, empty stdout                                            | exit `0`, empty stdout                                            | exit `1`, `ERR_PNPM_PACKAGE_NOT_FOUND`: no `pkg-a@latest`         | exit `0`, returns metadata with `versions: ["1.0.0-beta.0"]` and `dist-tags.beta`                         | exit `1`, JSON stdout: `No matching version found`      |
| `info pkg-a@1.0.0-beta.0 --json` | exit `0`, returns exact version metadata and full `versions` list | exit `0`, returns exact version metadata and full `versions` list | exit `0`, returns exact version metadata and full `versions` list | exit `0`, returns exact version metadata and full `versions` list                                         | exit `0`, returns exact version metadata and `versions` |
| `info pkg-a@1.0.0-beta.1 --json` | exit `1`, `E404`: no match for version                            | exit `1`, `E404`: no match for version                            | exit `1`, `ERR_PNPM_PACKAGE_NOT_FOUND`: no matching version       | exit `0`, returns existing `beta.0` metadata, so callers must inspect `versions.includes("1.0.0-beta.1")` | exit `1`, JSON stdout: `No matching version found`      |

## Missing Package

Used `pkg-missing`, which was not published at all.

| Command                                | npm 11           | npm 12           | pnpm 11                        | Yarn 4                                  | Bun 1.3.14                        |
| -------------------------------------- | ---------------- | ---------------- | ------------------------------ | --------------------------------------- | --------------------------------- |
| `info pkg-missing --json`              | exit `1`, `E404` | exit `1`, `E404` | exit `1`, `ERR_PNPM_FETCH_404` | exit `1`, `YN0035`, response code `404` | exit `1`, stderr: `404 Not Found` |
| `info pkg-missing@1.0.0-beta.0 --json` | exit `1`, `E404` | exit `1`, `E404` | exit `1`, `ERR_PNPM_FETCH_404` | exit `1`, `YN0035`, response code `404` | exit `1`, stderr: `404 Not Found` |
| `info pkg-missing@1.0.0-beta.1 --json` | exit `1`, `E404` | exit `1`, `E404` | exit `1`, `ERR_PNPM_FETCH_404` | exit `1`, `YN0035`, response code `404` | exit `1`, stderr: `404 Not Found` |

## Takeaways

- npm 11 and npm 12 empty stdout on bare `info pkg-a` is distinct from a missing package. It means the package query succeeded but no `latest`-resolved version was printable.
- pnpm 11 does not expose prerelease-only metadata through bare `info`; it fails because `latest` is missing.
- Bun 1.3.14 also fails bare `info` when `latest` is missing, but reports `No matching version found` as JSON on stdout.
- Bun 1.3.14 exact version queries work for published prereleases and fail with JSON stdout for unpublished versions.
- Yarn 4 exposes prerelease-only metadata through bare `npm info`, even without `latest`.
- For exact missing prerelease on an existing package, Yarn 4 still exits `0` and returns existing metadata. Version presence must be determined from the returned `versions` array.
- Missing packages produce real errors in all package managers.
