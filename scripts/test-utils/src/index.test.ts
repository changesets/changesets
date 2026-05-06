import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silenceLogsInBlock } from "./index.ts";
// [keep-order] logger has to be after `./index.ts`
import { log } from "@changesets/logger";

describe("temporarilySilenceLogs", () => {
  silenceLogsInBlock();
  describe("log", () => {
    const originalConsoleLog = console.log;
    beforeEach(() => {
      console.log = vi.fn();
    });
    afterEach(() => {
      console.log = originalConsoleLog;
    });
    it("should not call console.log", () => {
      log("Log message");
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
