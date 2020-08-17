---
"@changesets/get-github-info": patch
"@changesets/changelog-github": patch
---

Changed the way how requests to the GitHub API were authenticated - from a query parameter to the `Authorization` header. The previously used method has been deprecated by the GitHub and will stop working in 2021.
