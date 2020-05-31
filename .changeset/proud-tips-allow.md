---
"@changesets/config": patch
"@changesets/types": patch
---

Add `ignore` config option to config ignored packages. The version of ignored packages will not be bumped during a release, but their depedencies will still be bumped normally. 
