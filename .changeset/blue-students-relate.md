---
"@changesets/parse": major
"@changesets/read": major
"@changesets/changelog-git": major
"@changesets/changelog-github": major
"@changesets/get-github-info": major
"@changesets/get-version-range-type": major
"@changesets/logger": major
"@changesets/test-utils": major
"@changesets/write": major
---

Move package into having a major version (no actual change)

Hi! We here on the changesets team have a passion (obsession?) for doing semver correctly, so much so that we have had multiple debates about what the phrase 'semver correctly' even means (ask us about it sometime). As part of this, we wanted to use the full proper semver range for our packages.

Several packages were sitting in minor, but which we weren't really going to work on soon, so here's a major release for those.
