import ExtendableError from "extendable-error";

export class GitError extends ExtendableError {
  constructor(public code: number, message: string) {
    super(`${message}, exit code: ${code}`);
  }
}

export class ValidationError extends ExtendableError {}

export class ExitError extends ExtendableError {
  constructor(public code: number) {
    super(`The process exited with code: ${code}`);
  }
}
