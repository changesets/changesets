import { vi } from "vitest";
import { log, error, info, warn, success } from "./index.ts";

describe("@changesets/logger", () => {
  const logMessageOne = "Message 1";
  const logMessageTwo = "Message 2";
  const expectedLoggedRegex = new RegExp(
    `(${logMessageOne})\\s(${logMessageTwo})`,
  );
  describe("log", () => {
    let originalConsoleLog = console.log;
    beforeEach(() => {
      console.log = vi.fn();
    });
    afterEach(() => {
      console.log = originalConsoleLog;
    });
    it("should  call console.log", () => {
      log(logMessageOne, logMessageTwo);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(expectedLoggedRegex),
      );
    });
  });
  describe("error", () => {
    let originalConsoleError = console.error;
    beforeEach(() => {
      console.error = vi.fn();
    });
    afterEach(() => {
      console.error = originalConsoleError;
    });
    it("should  call console.error", () => {
      error(logMessageOne, logMessageTwo);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(expectedLoggedRegex),
      );
    });
  });
  describe("info", () => {
    let originalConsoleInfo = console.info;
    beforeEach(() => {
      console.info = vi.fn();
    });
    afterEach(() => {
      console.info = originalConsoleInfo;
    });
    it("should  call console.error", () => {
      info(logMessageOne, logMessageTwo);
      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(expectedLoggedRegex),
      );
    });
  });

  describe("warn", () => {
    let originalConsoleWarn = console.warn;
    beforeEach(() => {
      console.warn = vi.fn();
    });
    afterEach(() => {
      console.warn = originalConsoleWarn;
    });
    it("should  call console.info", () => {
      warn(logMessageOne, logMessageTwo);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(expectedLoggedRegex),
      );
    });
  });

  describe("success", () => {
    let originalConsoleLog = console.log;
    beforeEach(() => {
      console.log = vi.fn();
    });
    afterEach(() => {
      console.log = originalConsoleLog;
    });
    it("should  call console.info", () => {
      success(logMessageOne, logMessageTwo);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(expectedLoggedRegex),
      );
    });
  });
});
