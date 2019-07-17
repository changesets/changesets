# V2 PLanning

List of planned changes that will require a breaking change to implement. We are fine having multiple majors if something from this list is ready to ship before the others.

## New changeset format

We are changing the format of changesets to be a single file, and not include

### New packages:

- this package reads from disc or writes to disc

~ this package does not touch disc

C has code for it
T has tests

- ~CT`parse` parse a changeset file contents into a json object `parse(fileContents) => NewChangeset`
- +C`read` read in changesets from `disc read(cwd) => files[].map(parse)`
  <!-- - +CT`determineDependents` takes releases, workspaces and dependencies, and returns dependencies that need to be added to the list of dependencies to create a valid ReleasePlan - must be called recursively to 'bottom out' updating dependents
  <!-- - +`applyLinks` takes dependents and linked packages, then updates dependents where needed - returns the dependents and if they have been updated --> -->
- ~C`assembleReleasePlan` `assembleReleasePlan(NewChangeset[], Workspace[], DependentsGraph config) => ReleasePlan`, basically takes in the needed info and then repeatedly determines dependents and applies links until neither cause an update
- +C`getReleasePlan` performs `getReleasePlan(cwd) => assembleReleasePlan(all-the-things)` - it's a composition of other packages
- +`applyReleasePlan(releasePlan, cwd)` applies a given release plan to the cwd
- +`apply` `apply(cwd)` assembles release plan, and then applies the release plan (including removing files) (this is just bump, but I keep using the word apply)

Some notes:

I think applyLinks and determineDependents will never be particularly useful on their own - both sort of require you to 'bottom out'
afterwards. It's possible that these should just be functions inside `assembleReleasePlan`, which are tested by themselves, but not
shipped by themselves.

I haven't made a version of `apply` that doesn't touch the disc, as the info you are looking for (new versions of everything) now
exists in the `ReleasePlan` itself in the modified dependents object. Just didn't see much value in it.

Plan is to get all these packages singing nicely together then do a separate PR that implemements them into the CLI.

---

Old functions packagized for consumption outside of `cli` - not really talking about these, trying not
to change how they work for this PR

- getDependentsGraph
- getDependencyGraph
- git
- types

## Rename `bump` to `apply`

This ended up being wrong - we're trying to eliminate `bump` from our code entirely. It's not a useful term.

## Redo config options + packagize changelog formats

Condense them, and make them a JSON only format, that can reference modules

NB: While this will be a major version change, I'm happy to push this one out to a v3. I am not worried about burning major versions.
