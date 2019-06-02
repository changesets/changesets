# bolt-check

> A very simple command line utility to perform some of bolt's checks in yarn workspaces

Recently have been looking at using yarn workspaces over bolt, but was missing
bolt's checks. This very simple utility does the two checks I want the most.

```
yarn bolt-check
```

then to fix most errors detected:

```
yarn bolt-check --fix
```

## Make sure internal dependencies are compatible

We want to ensure we always use local versions of packages through yarn link, not
versions installed from npm. This ensures as we release new suites of packages,
they will all work together.

## Make sure external dependencies are all on the same version

When doing installs, we would like each package to use the same version of external
packages. We do this by having the 'correct' version recorded in the root `package.json`,
then ensuring that all workspaces a) rely on the same version as the root, and b) do
not contain any dependencies that are not in the root.

## I am using yarn workspaces how should I use this?

We recommend adding the script

```
"postinstall": "bolt-check"
```

## I am using bolt

You probably don't need this package as a postinstall script, but if you globally install
`bolt-check` you can use

```
bolt-check --fix
```

to help you out.

## So I don't need bolt anymore? I should just use yarn workspaces

Depends! This package is not a replacement for bolt, doesn't do nearly as much as bolt,
and implements the two above checks in a fairly naive/simple way. Bolt is still a great
tool, and a great way to manage projects.

Most importantly, we aren't doing any work installing packages, so guarantees that bolt
can make by owning that, this won't have. Also, since `bolt-check` must be separately
installed, you won't gain benefits from short-circuiting installs.
