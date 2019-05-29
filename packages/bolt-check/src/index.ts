import getWorkspaces from "get-workspaces";
import semver from "semver";
import path from "path";
import fs from "fs-extra";
import chalk from "chalk";

const DEPENDENCY_TYPES: [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "bundledDependencies",
    "optionalDependencies"
] = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "bundledDependencies",
    "optionalDependencies"
  ];

type workspaceConfig = {
    name: string;
    dependencies?: { [key: string]: string };
    devDependencies?: { [key: string]: string };
    peerDependencies?: { [key: string]: string };
    bundledDependencies?: { [key: string]: string };
    optionalDependencies?: { [key: string]: string };
}

const flatten = (workspace: workspaceConfig) => {
    const flatDeps = new Map()

    for (let depType of DEPENDENCY_TYPES) {
        let deps = workspace[depType];
        if (!deps || typeof deps !== 'object') continue;
        for (let [name, version] of Object.entries(deps)) {
            if (!flatDeps.has(name)) {
                flatDeps.set(name, version)
            }
        }

    }
    return flatDeps
}

export default async function boltCheck (config: { cwd: string }) {
    const errors: string[] = [];

    const workspaces = await getWorkspaces(config);
    const workspaceVersions = new Map();
    const rootPkgJson:workspaceConfig =  JSON.parse(await fs.readFile(path.resolve(config.cwd, 'package.json'), 'utf-8'));

    const rootDeps = flatten(rootPkgJson)

    for (let workspace of workspaces) {
        workspaceVersions.set(workspace.config.name, workspace.config.version);
    }

    for (let workspace of workspaces) {
        const flatDeps = flatten(workspace.config);
        for (let [name, range] of flatDeps.entries()) {
            if (workspaceVersions.has(name)) {
                let currentVersion = workspaceVersions.get(name);
                if (!semver.satisfies(currentVersion, range)) {
                    errors.push(chalk`{green ${workspace.name}} needs to update its dependency on {green ${name}} to be compatible with {yellow ${currentVersion}}`)
                }
            } else {
                let rootVersion = rootDeps.get(name)
                if (!rootVersion) {
                    errors.push(chalk`{yellow ${name}} is a dependency of {green ${workspace.name}}, but is not found in the project root.`)
                }    else if (rootVersion !== range) {
                    errors.push(chalk`{yellow ${name}} relies on {yellow ${range}} in {green ${name}}, but on {yellow ${rootVersion}} at the project root.`)
                }
            }
            
        }
    }

    if (errors.length > 0) {
        console.error(chalk.red('there are errors in your config!'))
        errors.map(e => console.error(e));
        process.exit(1);
    } else {
        console.log('Looks like your dependencies are fine')
    }
}