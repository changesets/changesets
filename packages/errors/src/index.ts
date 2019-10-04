export class GitError extends Error {
  constructor(exitCode: number, message: string) {
    super(`Error: Git - ${message}, exit code: ${exitCode}`);
  }
}
