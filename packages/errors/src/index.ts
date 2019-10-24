export class GitError extends Error {
  constructor(exitCode: number, message: string) {
    super(`Error: Git - ${message}, exit code: ${exitCode}`);
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(`Validation Error: ${message}`);
  }
}

export class ExitError extends Error {
  constructor(public code: number) {
    super(`ExitError: The process exited with code: ${code}`);
  }
}
