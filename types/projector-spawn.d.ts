declare module "projector-spawn" {
  import { SpawnOptions } from "child_process";

  export class ChildProcessError {
    constructor(code: number, stdout: string, stderr: string);
    stdout: string;
    code: number;
    stderr: string;
  }
  export default function spawn(
    cmd: string,
    args: Array<string>,
    opts: SpawnOptions
  ): Promise<
    { stdout: string; code: number; stderr: string } | ChildProcessError
  >;
}
