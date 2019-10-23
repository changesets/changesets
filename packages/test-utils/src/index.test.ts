import { log } from "@changesets/logger";
import { temporarilySilenceLogs } from "./";

describe("temporarilySilenceLogs", () => {
  temporarilySilenceLogs();
  describe("log", () => {
    let originalConsoleLog = console.log;
    beforeEach(() => {
      console.log = jest.fn();
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
