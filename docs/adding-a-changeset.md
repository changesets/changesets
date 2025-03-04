# Adding a changeset

Hi! You might be here because a person or a bot has asked you to 'add a changeset' to a project. Let's walk through adding a changeset. But first, what is a changeset?

## What is a changeset?

A changeset is a piece of information about changes made in a branch or commit. It holds three bits of information:

- What we need to release
- What version we are releasing packages at (using a [semver bump type](https://semver.org/))
- A changelog entry for the released packages

## I am in a multi-package repository (a mono-repo)

1. Run the command line script `yarn changeset` or `npx @changesets/cli`.
2. Select the packages you want to include in the changeset using <kbd>↑</kbd> and <kbd>↓</kbd> to navigate to packages, and <kbd>space</kbd> to select a package. Hit enter when all desired packages are selected.
3. You will be prompted to select a bump type for each selected package. Select an appropriate bump type for the changes made. See [here](https://semver.org/) for information on semver versioning
4. Your final prompt will be to provide a message to go alongside the changeset. This will be written into the changelog when the next release occurs.

After this, a new changeset will be added which is a markdown file with YAML front matter.

```
-| .changeset/
-|-| UNIQUE_ID.md
```

The message you typed can be found in the markdown file. If you want to expand on it, you can write as much markdown as you want, which will all be added to the changelog on publish. If you want to add more packages or change the bump types of any packages, that's also fine.

While not every changeset is going to need a huge amount of detail, a good idea of what should be in a changeset is:

- WHAT the change is
- WHY the change was made
- HOW a consumer should update their code

5. Once you are happy with the changeset, commit the file to your branch.

## I am in a single-package repository

1. Run the command line script `yarn changeset` or `npx @changesets/cli`.
2. Select an appropriate bump type for the changes made. See [here](https://semver.org/) for information on semver versioning.
3. Your final prompt will be to provide a message to go alongside the changeset. This will be written into the changelog when the next release occurs.

After this, a new changeset will be added which is a markdown file with YAML front matter.

```
-| .changeset/
-|-| UNIQUE_ID.md
```

The message you typed can be found in the markdown file. If you want to expand on it, you can write as much markdown as you want, which will all be added to the changelog on publish. If you want to change the bump type for the changeset, that's also fine.

While not every changeset is going to need a huge amount of detail, a good idea of what should be in a changeset is:

- WHAT the change is
- WHY the change was made
- HOW a consumer should update their code

4. Once you are happy with the changeset, commit the file to your branch.

## Tips on adding changesets

### You can add more than one changeset to a pull request

Changesets are designed to stack, so there's no problem with adding multiple. You might want to add more than one changeset when:

- You want to release multiple packages with different changelog entries
- You have made multiple changes to a package that should each be called out separately

## I want to know more about changesets

[here is a more in-depth explanation](./detailed-explanation.md)
