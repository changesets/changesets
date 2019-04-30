import path from "path";
import fs from "fs-extra";

export default async function run({ cwd }) {
  console.log(
    "Thanks for choosing changesets to help manage your version management and changelogs"
  );
  console.log(
    "We are going to set you up so you can start adding and consuming changesets"
  );
  console.log("...");
  const changesetBase = path.resolve(cwd, ".changeset");

  if (fs.existsSync(changesetBase)) {
    console.log(
      "It looks like you already have changesets initialized. You should be able to run changeset commands no problems"
    );
  } else {
    // TODO: Make default changelog entries if there is a git repo the one with the links, not the linkless nonsense
    await fs.copy(path.resolve(__dirname, "./default-files"), changesetBase);
    console.log(
      `We have added a \`.changeset\` folder, and a couple of files to help you out.
- There's a README that will help you in using changesets.
- The default config has also been added with comments so you can modify it`
    );
  }
}
