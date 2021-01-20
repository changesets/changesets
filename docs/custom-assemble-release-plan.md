# Custom assemble-release-plan

Sometimes you have special logic for bumping your packages. You can define your own function to handle this case

## Settings

To change the assembling logic, you use the `assembleReleasePlan` setting in the `./changeset/config.json`. This setting accepts a string, which points to a module. You can reference an npm package that you have installed, or a local file where you have written your own functions.

Probably, you need to just override the logic provided by `@changesets/assemble-release-plan`, so you should add this package to your dependencies:
```
yarn add @changesets/assemble-release-plan
```

Next, change your `.changeset/config.json` to point to the new package:

```
"assembleReleasePlan": "your-custom-assemble-release-plan"
```

## Writing assemble-release-plan Function

Your module need to just have **default** export with single function that implements `AssembleReleasePlan` interface.

```ts
import assembleReleasePlanFunction from "@changesets/assemble-release-plan";

export default assembleReleasePlan: typeof assembleReleasePlanFunction = (
  changesets,
  packages,
  config,
  preState,
  snapshot
) => {
  let result = assembleReleasePlanFunction(
    changesets,
    packages,
    config,
    preState,
    snapshot
  );

  // Here you can change the results from default `assembleReleasePlan`

  return result;
};
```
