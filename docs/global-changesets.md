# Global Changesets

## Why

When using changesets to publish, there are two real modes that you operate in.

1. Continuous Delivery

In this mode, packages are released ad-hoc as needed. Each call of `version` and `publish` holds no real significance in itself - it just makes sure all your packages are versioned and published correctly. This is what changesets does by default.

2. Planned releases

This mode has a bunch of other names, but in essence, releases from the repository occur either at set times, OR there are notable major releases that are called out. In this mode of operation, the act of calling `version` and `publish` has a special meaning, and you will want to document it differently.

The biggest problem with planned releases from a monorepo is that when you update the semver of each package individually, you can end up with a lot of drift. One package can be on its tenth major version, while another is on its first. This can be confusing and difficult for consumers.

Global changesets work by adding a new bit of information to a release - a release name.

This release name is used in two places: creating a global changelog of all changes in a release, and in tagging all your packages on npm.

By tagging packages on npm, this allows users to install packages using:

```
npm install @changesets/cli@bulbasaur
```

instead of a specific version, if a consumer only cares about what release they want.

## Using Global Changesets for named releases

### Adding a global changeset

You add a global changset by running

```
changeset add --global
```

This will ask you for the name of this release, as well as a summary. We strongly recommend you open the changeset and modify it.

> When naming releases, having a pattern that you follow can help consumers trying to upgrade to it, such as picking a theme and then moving through the alphabet with one item for each theme. For changesets, we are working through each pokemon in order.

### Updating a global release

You can find the global changeset always at `.changeset/aaa-global-changeset.md` in your repository. We won't read a global changeset from any other location, and you can only have one at a time.

Your file will look something like:

```markdown
---
"@changesets/secret-global-release": "bulbasaur"
---

Add global changesets feature
```

Add as much detail as you want about the major release that is about to occur to this file.

### The version command when there is a global release

When you run the version command while a global release is present, as well as the individual changelogs being generated, a 'global changelog' (by default called `RELEASE_NOTES.md`) will be added to the root of the repository.

> If you want to chagne the path of this, in your changeset config change the `changelog.globalFilename` path to be your desired write location

### The publish command when there is a global release

When you run the `publish` command after versioning for a global release, and after all relevant packages have been published, the new release name will be added as an npm dist tag to every package in the repository. You can now install any published package in the repository using the new tag.

> The tagging will only occur if the tag has not previously been used.

> We down-case and remove spaces from release names, so you can name your release "Warm Hugs" and it will be distributed under the tag `warm-hugs`

## When should I add a global changeset?

The answer to this will be entirely dependent on when and how your project publishes to npm. If you are using some form of scheduled release, you will likely find the global changelog a very useful feature, to communicate project-level changes, as opposed to package-level changes to your consumers more easily.

You will likely not want a global changeset for every single release (as hot fixes and small patch releases may not warrant it) but if you are releasing a major version of a package, or a new feature you want to loudly call out, a global changeset will be useful.
