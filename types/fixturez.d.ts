type Opts = {
  glob?: string | Array<string>;
  root?: string;
  cleanup?: boolean;
};

declare module "fixturez" {
  function fixturez(
    cwd: string,
    opts?: Opts
  ): {
    find: (a: string) => string;
    temp: () => string;
    copy: (a: string) => string;
    cleanup: () => any;
  };

  export = fixturez;
}
