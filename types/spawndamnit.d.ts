declare module "spawndamnit" {
  import { SpawnOptions, ChildProcess } from "child_process";

  export default function spawn(
    cmd: string,
    args: Array<string>,
    opts?: SpawnOptions
  ): Promise<{ stdout: Buffer; code: number; stderr: Buffer }> & ChildProcess;
}
