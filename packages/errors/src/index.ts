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
