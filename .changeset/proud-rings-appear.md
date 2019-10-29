---
"@changesets/apply-release-plan": patch
"@changesets/cli": patch
"@changesets/config": patch
"get-workspaces": patch
"@changesets/types": patch
---

Correctly handle the 'access' flag for packages

Previously, we had access as "public" or "private", access "private" isn't valid. This was a confusing because there are three states for publishing a package:

- `private: true` - the package will not be published to npm (worked)
- `access: public` - the package will be publicly published to npm (even if it uses a scope) (worked)
- `access: restricted` - the package will be published to npm, but only visible/accessible by those who are part of the scope. This technically worked, but we were passing the wrong bit of information in.

Now, we pass the correct access options `public` or `restricted`.
