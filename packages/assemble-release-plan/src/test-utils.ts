import type {
  NewChangeset,
  Release,
  VersionType,
  Packages,
  Package,
} from "@changesets/types";

function getPackage({
  name,
  version,
}: {
  name: string;
  version: string;
}): Package {
  return {
    packageJson: {
      name,
      version,
    },
    dir: `/packages/${name.replace(/^@/, "").replace(/\//g, "-")}`,
  };
}

function getChangeset(
  data: {
    id?: string;
    summary?: string;
    releases?: Array<Release>;
  } = {},
): NewChangeset {
  const id = data.id || "strange-words-combine";
  const summary = data.summary || "base summary whatever";
  const releases = data.releases || [];
  return {
    id,
    summary,
    releases,
  };
}

function getRelease({
  name,
  type,
}: {
  name: string;
  type: VersionType;
}): Release {
  return { name, type };
}

const getSimpleSetup = () => ({
  packages: {
    rootPackage: {
      packageJson: {
        name: "root",
        version: "0.0.0",
      },
      dir: "/",
    },
    rootDir: "/",
    packages: [getPackage({ name: "pkg-a", version: "1.0.0" })],
    tool: { type: "yarn" },
  } satisfies Packages,
  changesets: [
    getChangeset({ releases: [getRelease({ name: "pkg-a", type: "patch" })] }),
  ] satisfies Array<NewChangeset>,
});

export class FakeFullState {
  packages: Packages;
  changesets: NewChangeset[];

  constructor(custom?: { packages?: Packages; changesets?: NewChangeset[] }) {
    const { packages, changesets } = { ...getSimpleSetup(), ...custom };
    this.packages = packages;
    this.changesets = changesets;
  }

  addChangeset(
    data: {
      id?: string;
      summary?: string;
      releases?: Array<Release>;
    } = {},
  ) {
    const changeset = getChangeset(data);
    if (this.changesets.some((c) => c.id === changeset.id)) {
      throw new Error(
        `tried to add a second changeset with same id: ${changeset.id}`,
      );
    }
    this.changesets.push(changeset);
  }

  updateDependency(
    dependent: string,
    dependency: string,
    versionRange: string,
  ) {
    const pkg = this.packages.packages.find(
      (a) => a.packageJson.name === dependent,
    );
    if (!pkg) throw new Error(`No "${dependent}" package`);
    if (!pkg.packageJson.dependencies) {
      pkg.packageJson.dependencies = {};
    }
    pkg.packageJson.dependencies[dependency] = versionRange;
  }
  updateDevDependency(
    dependent: string,
    dependency: string,
    versionRange: string,
  ) {
    const pkg = this.packages.packages.find(
      (a) => a.packageJson.name === dependent,
    );
    if (!pkg) throw new Error(`No "${dependent}" package`);
    if (!pkg.packageJson.devDependencies) {
      pkg.packageJson.devDependencies = {};
    }
    pkg.packageJson.devDependencies[dependency] = versionRange;
  }
  updatePeerDependency(
    dependent: string,
    dependency: string,
    versionRange: string,
  ) {
    const pkg = this.packages.packages.find(
      (a) => a.packageJson.name === dependent,
    );
    if (!pkg) throw new Error(`No "${dependent}" package`);
    if (!pkg.packageJson.peerDependencies) {
      pkg.packageJson.peerDependencies = {};
    }
    pkg.packageJson.peerDependencies[dependency] = versionRange;
  }

  addPackage(name: string, version: string) {
    const pkg = getPackage({ name, version });
    if (
      this.packages.packages.some(
        (c) => c.packageJson.name === pkg.packageJson.name,
      )
    ) {
      throw new Error(
        `tried to add a second package with same name': ${pkg.packageJson.name}`,
      );
    }
    this.packages.packages.push(pkg);
  }
  updatePackage(name: string, version: string) {
    const pkg = this.packages.packages.find((c) => c.packageJson.name === name);
    if (!pkg) {
      throw new Error(
        `could not update package ${name} because it doesn't exist - try addWorskpace`,
      );
    }
    pkg.packageJson.version = version;
  }
}
