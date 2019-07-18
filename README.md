# 🦋 changesets 🦋

> Manage versions and changelogs for release

Changesets let pull request authors define the minimum [semver version type](https://semver.org/) their changes introduce, decoupled from actually releasing to npm.

Pull request authors create changesets indicating the semver version type and changelog for their individual pull request. Releases Managers consolidate one or more changesets to update version numbers and changelog files before a release.

It works great with multi-package repositories using bolt or yarn workspaces. (minimal lerna support so far)

<Cool image goes here>

```sh
yarn add @changesets/cli
yarn changeset init
```

## Using changesets

For information on the why and how of changesets, see the [@changesets/cli](./packages/cli/README.md) documentation or our [intro to using changesets](./docs/intro-to-using-changesets.md) guide.

## More docs packages

- [intro to using changesets](./docs/intro-to-using-changesets.md)
- [common questions](./docs/common-questions.md)
- [adding a changeset](./docs/adding-a-changeset.md)
- [detailed explanation](./docs/detailed-explanation.md)
- [dictionary of terms](./docs/dictionary.md)

## Related packages docs

- [bolt-check]('./packages/bolt-check/README.md)
- [get-workspaces]('./packages/get-workspaces/README.md)

# Thanks/Inspiration

- [bolt](https://github.com/boltpkg/bolt) - Brought us a strong concept of how packages in a mono-repo should be able to interconnect, and provided the initial infrastructure to get inter-package information.
- [atlaskit](https://atlaskit.atlassian.com) - The original home of the changesets code, and where many of the ideas and processes were fermented.
- [lerna-semantic-release](https://github.com/atlassian/lerna-semantic-release) - put down many of the initial patterns around updating packages within a multi-package-repository, and started us thinking about how to manage dependent packages.
- [Thinkmill](https://www.thinkmill.com.au) - For sponsoring the focused open sourcing of this project, and the version two rearchitecture
