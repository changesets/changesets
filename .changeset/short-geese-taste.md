---
"@changesets/assemble-release-plan": minor
"@changesets/config": minor
"@changesets/types": minor
---

Add a new bump strategy for peers bump.

This adds a new option "updatePeersDependencies" to the config, and can be set
to "major" (default) or "follow". When set to "major", it preserves the 
origin behaviour that when peers dependencies has a minor or major bump,
the dependent need to perform a major bump; when set to "follow", when peers 
have a major/minor/patch bump, the dependent will need to perform **at least**
a major/minor/patch bump, respectively.
