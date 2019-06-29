export class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super("the process exited with code: " + code);
    this.code = code;
  }
}
