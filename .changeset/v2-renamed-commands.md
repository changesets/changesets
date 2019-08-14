---
"@changesets/cli": major
---

#### Renamed commands

- `bump` has been renamed to `version`
- `release` has been renamed to `publish`

This is a reversion to the changes made in `1.0.0`.

**Reasoning**: We switched the names because we wanted to avoid confusion with the related
tasks in npm. While technically it removed confusion that this was doing the same thing as
`npm version`, or `npm publish`, the new terms did not convey easily grokkable meanings. As
we weren't benefiting from the new names, we have decided to revert to names that have more
meaning within the community, even though these commands do slightly more than this.
