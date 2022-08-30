/**
 * Reason for eslint disable import/no-commonjs
 * Technically reassigning imports is not allowed and
 * Rollup errors at compile time on this(but the Babel
 * transform that's running in jest makes it work there),
 * making this a require should be fine.
 */
// eslint-disable-next-line import/no-commonjs
const logger = require("@changesets/logger");

const createLogSilencer = () => {
  const originalLoggerError = logger.error;
  const originalLoggerInfo = logger.info;
  const originalLoggerLog = logger.log;
  const originalLoggerWarn = logger.warn;
  const originalLoggerSuccess = logger.success;

  const originalConsoleError = console.error;
  const originalConsoleInfo = console.info;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  return {
    setup() {
      logger.error = jest.fn();
      logger.info = jest.fn();
      logger.log = jest.fn();
      logger.warn = jest.fn();
      logger.success = jest.fn();

      console.error = jest.fn();
      console.info = jest.fn();
      console.log = jest.fn();
      console.warn = jest.fn();

      process.stdout.write = jest.fn();
      process.stderr.write = jest.fn();

      return () => {
        logger.error = originalLoggerError;
        logger.info = originalLoggerInfo;
        logger.log = originalLoggerLog;
        logger.warn = originalLoggerWarn;
        logger.success = originalLoggerSuccess;

        console.error = originalConsoleError;
        console.info = originalConsoleInfo;
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;

        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;
      };
    },
  };
};

export const silenceLogsInBlock = () => {
  const silencer = createLogSilencer();

  let dispose: () => void | undefined;

  beforeEach(() => {
    dispose = silencer.setup();
  });
  afterEach(() => {
    dispose!();
  });
};

export const temporarilySilenceLogs =
  (testFn: () => Promise<void> | void) => async () => {
    const silencer = createLogSilencer();
    const dispose = silencer.setup();
    try {
      await testFn();
    } finally {
      dispose();
    }
  };
