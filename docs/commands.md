# A list of the commands in changesets

## init

Initialise changesets. This will add a `.changeset` folder, where changesets will be stored, as well as a readme file explaining information about changesets.

## add

Add a new changeset. This will walk you through the questions you need to answer to add a changeset, and then add the files.

## info TODO

This command provides information about added changesets. By default it will only display information about changesets that are not on the master branch, unless the user is already on the master branch.

You can use `--all` to view all changeset information while not on master.

If no changesets are present, this will exit as an error. This is to allow changeset checks in CI.

## consume

Consume all current changesets, and update the version and changelogs of all referenced packages.

## release

Release all packages that exist in a version above where they are on npm. This command will release packages that had their version changed by tools other than changesets (for example, manual changes).
