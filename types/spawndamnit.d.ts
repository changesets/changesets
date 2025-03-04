declare module "spawndamnit" {
  import { SpawnOptions } from "child_process";
  import { EventEmitter } from "events";

  function spawn(
    cmd: string,
    args: Array<string>,
    opts?: SpawnOptions
  ): Promise<{ stdout: Buffer; code: number; stderr: Buffer }> & EventEmitter;

  export = spawn;
}
