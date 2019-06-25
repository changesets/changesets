// This file is being written as part of branch noviny/new-changeset-format
// to document the process of writing it - this should probably be deleted
// before we merge in to master

New packages:

- this package reads from disc

* this package uses output from read

C has code for it
T has tests
I integrated into workflow

- +CT`parse` parse a changeset file contents into a json object `parse(fileContents) => NewChangeset`
- \*C`read` read in changesets from `disc read(cwd) => files[].map(parse)`
  // Editor's note - the way I am using this in getReleasePlan atm will break, it doesn't update up-stream as we need, and only returns new things
- +CT`determineDependents` takes releases, workspaces and dependencies, and returns dependencies that need to be added to the list of dependencies to create a valid ReleasePlan - must be called recursively to 'bottom out' updating dependents
- +`applyLinks` takes dependents and linked packages, then updates dependents where needed - returns the dependents and if they have been updated
- +C`assembleReleasePlan` `assembleReleasePlan(NewChangeset[], Workspace[], DependentsGraph config) => ReleasePlan`, basically takes in the needed info and then repeatedly determines dependents and applies links until neither cause an update
- \*C`getReleasePlan` performs `getReleasePlan(cwd) => assembleReleasePlan(all-the-things)` - it's a composition of other packages
- \*`apply` `apply(cwd)` Does all reading from disc, assembles release plan, and then applies the release plan (including removing files) (this is just bump, but I keep using the word apply)

Some notes:

I think applyLinks and determineDependents will never be particularly useful on their own - both sort of require you to 'bottom out'
afterwards. It's possible that these should just be functions inside `assembleReleasePlan`, which are tested by themselves, but not
shipped by themselves.

I haven't made a version of `apply` that doesn't touch the disc, as the info you are looking for (new versions of everything) now
exists in the `ReleasePlan` itself in the modified dependents object. Just didn't see much value in it.

---

Old functions packagized for consumption outside of `cli` - not really talking about these, trying not
to change how they work for this PR

- getDependentsGraph
- getDependencyGraph
- git
- types
