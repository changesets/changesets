# Checking for changesets

Currently we don't have a simple command that tells you what changesets exist, and would prompt for a missing changeset. We do have a [github bot]() and a [bitbucket bot]() that alert users of missing changesets.

Since some kinds of change may not require a release (changes to testing and unpublished docs for example), we recommend that any check that alerts people of the non-existance of a changeset is used as a warning, not as a blocking element to getting contributions merged.

In the future, we will be adding an `info` command so you can surface this information more easily.

If you are unsatisfied with the workflows suggested above, the following git command is a good starting point for discovering if a branch contains changesets:

`git diff --name-only --diff-filter=d master .changeset`
