import type { Config, WrittenConfig } from "@changesets/types";
import type { Packages } from "@manypkg/get-packages";
import picomatch from "picomatch";

export type FullContext = {
  packages: Packages;
  config: Config;
  writtenConfig: WrittenConfig;
  packageNames: string[];
  errors: string[];
  warnings: string[];
};

export function globMatch(
  paths: readonly string[],
  patterns?: readonly string[],
): string[] {
  if (!patterns) return paths as string[];

  const matchers = patterns.map((p) => picomatch(p, undefined, true));
  return paths.filter((path) => {
    if (path.includes("\\")) {
      path = path.replace(/\\/g, "/");
    }

    let passed = false;
    for (const matcher of matchers) {
      if (!passed) {
        // If not passed yet, only match positive matches
        if (!matcher.state.negated && matcher(path)) {
          passed = true;
        }
      } else {
        // If passed, only match negative/negated matches
        if (matcher.state.negated && !matcher(path)) {
          passed = false;
        }
      }
    }
    return passed;
  });
}
