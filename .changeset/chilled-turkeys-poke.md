---
"@changesets/get-dependents-graph": minor
---

Dependencies specified using a tag will no longer mark the graph as invalid. With such dependencies the user's intent is to fetch those from the registry even if otherwise they could be linked locally.
