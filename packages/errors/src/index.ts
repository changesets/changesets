import ExtendableError from "extendable-error";

export class GitError extends ExtendableError {
  code: number;
  constructor(code: number, message: string) {
    super(`${message}, exit code: ${code}`);
    this.code = code;
  }
}

export class ValidationError extends ExtendableError {}

export class ExitError extends ExtendableError {
  code: number;
  constructor(code: number) {
    super(`The process exited with code: ${code}`);
    this.code = code;
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
