export class GitError extends Error {
  constructor(exitCode: number, message: string) {
    super(`Error: Git - ${message}, exit code: ${exitCode}`);
  }
}

export class PreExitButNotInPreModeError extends Error {
  constructor() {
    super("pre mode cannot be exited when not in pre mode");
  }
}

export class PreEnterButInPreModeError extends Error {
  constructor() {
    super("pre mode cannot be entered when in pre mode");
  }
}

export class InternalError extends Error {
  constructor(message: string) {
    super(message);
  }
}
