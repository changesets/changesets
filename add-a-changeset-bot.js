// i can't be bothered to create a package for this rn
require("dotenv").config();

let _glob = require("glob-github");
const Octokit = require("@octokit/rest");
const humanId = require("human-id");
const { createChangeset } = require("@changesets/create-changeset");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function fetchJsonFile({ owner, repo, path, ref }) {
  let output = await octokit.repos.getContents({
    owner,
    repo,
    path,
    ref
  });
  let buffer = Buffer.from(output.data.content, "base64");
  return JSON.parse(buffer.toString("utf8"));
}

function glob({ owner, repo, glob, ref }) {
  return new Promise((resolve, reject) =>
    _glob(
      {
        user: owner,
        repo,
        glob: glob[0] === "/" ? glob : "/" + glob,
        authenticate: {
          type: "oauth",
          token: process.env.GITHUB_TOKEN
        },
        // glob-github calls this option branch but it's actually setting the ref
        branch: ref
      },
      function(err, results) {
        if (err) {
          reject(err);
        }

        resolve(
          results
            .filter(result => result.type === "dir")
            .map(result => result.path)
        );
      }
    )
  );
}

let getWorkspacesFromGitHub = async ({ owner, repo, ref }) => {
  let jsonContents = await fetchJsonFile({
    owner,
    repo,
    path: "package.json",
    ref
  });

  let globs;
  if (jsonContents.workspaces) {
    if (!Array.isArray(jsonContents.workspaces)) {
      globs = jsonContents.workspaces.packages;
    } else {
      globs = jsonContents.workspaces;
    }
  } else if (jsonContents.bolt && jsonContents.bolt.workspaces) {
    globs = jsonContents.bolt.workspaces;
  } else {
    let root = { name: jsonContents.name, config: jsonContents, dir: "/" };
    return {
      workspaces: [root],
      root
    };
  }

  let results = [];
  if (Array.isArray(globs)) {
    await Promise.all(
      globs.map(pattern => {
        return glob({ owner, repo, glob: pattern, ref }).then(paths => {
          results.push(...paths);
        });
      })
    );
  } else {
    results.push(await glob({ owner, repo, glob: globs, ref }));
  }

  let workspaces = await Promise.all(
    results.map(async dir => {
      let config = await fetchJsonFile({
        owner,
        repo,
        path: dir + "/package.json",
        ref
      });
      return { dir, config, name: config.name };
    })
  );
  console.log(workspaces);
  return {
    workspaces,
    root: { name: jsonContents.name, config: jsonContents, dir: "/" }
  };
};

(async () => {
  let config = {
    owner: "mitchellhamilton",
    repo: "wait-for-all-the-things",
    ref: "test-changeset-stuff"
  };
  let { workspaces, root } = await getWorkspacesFromGitHub(config);

  let { summary, ...changesetObj } = createChangeset({
    summary: "a cool new thing",
    releases: [{ name: "wait-for-all-the-things", type: "major" }],
    packages: workspaces,
    root
  });
  let id = humanId({
    separator: "-",
    capitalize: false
  });
  let ref = await octokit.git.getRef({
    owner: config.owner,
    repo: config.repo,
    ref: `heads/${config.ref}`
  });
  let {
    data: { sha }
  } = await octokit.git.createTree({
    owner: config.owner,
    repo: config.repo,
    base_tree: ref.data.object.sha,
    tree: [
      {
        path: `.changeset/${id}/changes.md`,
        mode: "100644",
        content: summary
      },
      {
        path: `.changeset/${id}/changes.json`,
        mode: "100644",
        content: JSON.stringify(changesetObj, null, 2) + "\n"
      }
    ]
  });

  console.log(ref);
  let commit = await octokit.git.createCommit({
    owner: config.owner,
    repo: config.repo,
    tree: sha,
    message: "Add changeset",
    parents: [ref.data.object.sha]
  });

  octokit.git.updateRef({
    owner: config.owner,
    repo: config.repo,
    ref: `heads/${config.ref}`,
    sha: commit.data.sha
  });
  console.log(changesetObj);
})();
