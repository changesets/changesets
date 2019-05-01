## Stop depending on bolt.

Currently there are 13 places where we call bolt functions.

- getWorkspaces x 5
- getDependentsGraph x 1
- getProject x 1
- updatePackageVersions x 1
- publishPackages x 1

updatePackageVersions is the one that is most heavily tied to bolt internals. The rest are easy enough to abstract out.
