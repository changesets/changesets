---
"@changesets/changelog-github": minor
"@changesets/get-github-info": minor
---

Add `excludeFromThanks` to omit individual GitHub logins from changelog attribution. Omit bot credits by default, with `excludeBotsFromThanks: false` to keep them. GitHub author info now includes `isBot: true` for authors identified as bots.
