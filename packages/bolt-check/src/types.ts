export type MissingDep = {
  type: "missingDependency";
  pkgName: string;
  dependency: string;
  pkgVersion: string;
};

export type InternalMismatch = {
  type: "internalMismatch";
  pkgName: string;
  dependency: string;
  version: string;
};

export type ExternalMismatch = {
  type: "externalMismatch";
  pkgName: string;
  dependency: string;
  rootVersion: string;
  pkgVersion: string;
};

export type RootContainsDevDeps = {
  type: "rootContainsDevDeps";
};

export type ErrorObj =
  | InternalMismatch
  | ExternalMismatch
  | MissingDep
  | RootContainsDevDeps;

export type PkgErrors = InternalMismatch | ExternalMismatch;

export type workspaceConfig = {
  name: string;
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  optionalDependencies?: { [key: string]: string };
};

export type Config = {
  cwd: string;
};
