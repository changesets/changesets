# changesets

Hey anyone finding this! Over the last couple of years, I've been working on a tool to help order and organising releases within the Atlaskit mono-repository, which can be found [on npm here](https://www.npmjs.com/package/@atlaskit/build-releases) and the code can be found in the [atlaskit repository here](https://bitbucket.org/atlassian/atlaskit-mk-2/src/39cb7079438bd3f6ae2efb9214f3323bf2933acc/build/releases/?at=master). Out of all that work came some really neat patterns that I want to expand on for both mono-repo change management, as well as something I'm keen to experiment for single-package change management.

This repository has been made so I can track my things-to-be-done in this space.

## I am already using `@atlaskit/build-releases` and want changes made to that

Please raise an issue here! Without a dedicated backlog, I was finding it hard to check what was wanted/needed by other consumers which is part of the reason for making this.

## Will the build-releases code get moved here?

Nope! Or, probably no. I might end up with a new iteration of the idea though.

## The problem:

When organising the release of packages, you may end up wanting to group several changes together written by different people and/or over a relatively large period of time. The best time to capture this information is when submitting a PR (when it is fresh in your mind), not when you eventually go to batch and release these changes.

Git is a bad place to store this information, as it discourages writing detailed change descriptions - you want to allow people to provide as much documentation for the change as they want.

## The solution, Changesets:

The best way to think about a changeset as separate to either a changelog or a version bump is that a changeset is an 'intent to change'. The intent to change carries with it two key bits of information:

- versioning
- changelogs

As it is an intent to change, the relevant versioning information is:

- 'major' | 'minor' | 'patch'

In addition, within a mono-repository, we can encode information about any other packages in the mono-repository that should be re-released to consume this change. This ensures that if you upgrade latest of all the packages, they are all compatible. The current implementation is heavily informed by [bolt's](https://github.com/boltpkg/bolt) opinion on version compatibility.

- changelog information can be stored as a markdown snippet.

As storing this information directly in git is problematic, we store it in the file system using the following structure:

```
-| .changeset/
-|-| UNIQUE_ID/
-|-|-| changes.json
-|-|-| changes.md
```

The `changes.json` has the following format (this is currently structured towards a mono-repo):

```json
{
  "releases": [
    { "name": "extract-react-types", "type": "minor" },
    { "name": "extract-react-types-loader", "type": "patch" }
  ],
  "dependents": [
    {
      "name": "babel-plugin-extract-react-types",
      "type": "patch",
      "dependencies": ["extract-react-types"]
    },
    { "name": "kind2string", "type": "patch", "dependencies": ["extract-react-types"] },
    {
      "name": "pretty-proptypes",
      "type": "patch",
      "dependencies": ["kind2string", "extract-react-types"]
    }
  ]
}

```

The `changes.md` is just a markdown snippet, and it should be encouraged to go and manually edit it.

This is useful because it breaks versioning into two steps:

1. Adding a changeset - can be done in a PR, by a contributor, while the change is fresh in their mind
2. Versioning - combines all changesets, creates one version bump for each package based on the maximum version bump of each package, and updates dependencies where needed, write changelogs. Can then be reviewed as an aggregate.

## The tooling that makes this worthwhile

1. CLI generation of new changesets
2. Automated consumption of changesets to do versioning
3. Detection + surfacing of changesets in PRs

A tool to publish multiple packages from a mono-repo is also important, however does not need to be linked to this.

See this blog post [I need to write this this link goes nowhere]()

## Benefits to single-package repos

Changesets are designed first and formost to handle versioning in monorepos, where interdependencies flowing through the system are important to understand and capture.

Conceptually though, the benefits of changesets are detacheable from this. I think this process overall leads to an improvement in Pull Requests that helps increase confidence in versioning decisions and changelog entries.

## Things to be done

- Write up a standard for 'what is a changeset/what does it look like'
- Have a long discussion about whether the current changes.json file should be frontmatter in the md file instead and then probably not change it (imo)
- Build a changeset tool to work in single-package repositories
- Modify/build a changeset tool that uses yarn workspaces instead of bolt (or is tool-agnostic)
- Build a github addon to alert when there is no changeset present in a PR (without this changesets are v hard to recommend to open source projects)
- Explore if we can populate github releases using changesets - either a separate package or a modification on the existing toolset
- Add support for 
