// i can't be bothered to create a package for this rn
require("dotenv").config();

let _glob = require("glob-github");
const remark = require("remark");
const matter = require("gray-matter");
const visit = require("unist-util-visit");
const Octokit = require("@octokit/rest");
const humanId = require("human-id");
const { createChangeset } = require("@changesets/create-changeset");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

class UserError extends Error {}

async function fetchJsonFile({ owner, repo, path, branch }) {
  let output = await octokit.repos.getContents({
    owner,
    repo,
    path,
    ref: branch
  });
  let buffer = Buffer.from(output.data.content, "base64");
  return JSON.parse(buffer.toString("utf8"));
}

function glob({ owner, repo, glob, branch }) {
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
        branch
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

let getWorkspacesFromGitHub = async ({ owner, repo, branch }) => {
  let jsonContents = await fetchJsonFile({
    owner,
    repo,
    path: "package.json",
    branch
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
        return glob({ owner, repo, glob: pattern, branch }).then(paths => {
          results.push(...paths);
        });
      })
    );
  } else {
    results.push(await glob({ owner, repo, glob: globs, branch }));
  }

  let workspaces = await Promise.all(
    results.map(async dir => {
      let config = await fetchJsonFile({
        owner,
        repo,
        path: dir + "/package.json",
        branch
      });
      return { dir, config, name: config.name };
    })
  );
  return {
    workspaces,
    root: { name: jsonContents.name, config: jsonContents, dir: "/" }
  };
};

let writeChangesets = async ({ owner, repo, branch, changesets }) => {
  let { workspaces, root } = await getWorkspacesFromGitHub({
    owner,
    repo,
    branch
  });

  let workspacesSet = new Set(workspaces.map(({ name }) => name));

  for (let { releases } of changesets) {
    for (let release of releases) {
      if (!workspacesSet.has(release.name)) {
        throw new UserError(`There is no workspace named ${release.name}`);
      }
    }
  }

  let files = [];

  for (let { releases, summary } of changesets) {
    let changesetObj = createChangeset({
      releases,
      packages: workspaces,
      root
    });
    let id = humanId({
      separator: "-",
      capitalize: false
    });
    files.push(
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
    );
  }
  console.log("yes");

  let ref = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`
  });
  let {
    data: { sha }
  } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: ref.data.object.sha,
    tree: files
  });

  let commit = await octokit.git.createCommit({
    owner,
    repo,
    tree: sha,
    message: "Add changeset" + (changesets.length === 1 ? "" : "s"),
    parents: [ref.data.object.sha]
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha
  });
};

(async () => {
  let comment = `
  \`\`\`changeset
  ---
  wait-for-all-the-things: major
  --- 
  The summary for my cool change.
  \`\`\`
  `;

  let ghUsername = "mitchellhamilton";
  let baseRepoOwner = "mitchellhamilton";
  let baseRepoName = "wait-for-all-the-things";
  let forkRepoOwner = "mitchellhamilton";
  let forkRepoName = "wait-for-all-the-things";
  let forkRepoBranch = "test-changeset-stuff";

  // we do a naive check on the comment first because parsing markdown is expensive
  if (comment.includes("```changeset")) {
    let output = await octokit.repos.getCollaboratorPermissionLevel({
      owner: baseRepoOwner,
      username: ghUsername,
      repo: baseRepoName
    });
    if (
      output.data.permission === "admin" ||
      output.data.permission === "write"
    ) {
      let tree = remark.parse({ contents: comment });
      let changesets = [];
      visit(tree, "code", node => {
        if (node.lang === "changeset") {
          let { content, data } = matter(node.value);
          changesets.push({
            summary: content.trim(),
            releases: Object.keys(data).map(pkgName => {
              let bumpType = data[pkgName];
              if (
                bumpType !== "major" &&
                bumpType !== "minor" &&
                bumpType !== "patch"
              ) {
                throw new UserError(
                  `The package \`${pkgName}\` had a bump type of \`${bumpType}\` which is not valid.`
                );
              }
              return {
                name: pkgName,
                type: bumpType
              };
            })
          });
        }
      });
      if (changesets.length) {
        await writeChangesets({
          owner: forkRepoOwner,
          repo: forkRepoName,
          branch: forkRepoBranch,
          changesets
        });
      }
    }
  }
})();
