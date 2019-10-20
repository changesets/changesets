const logger = require("@changesets/logger");

export const temporarilySilenceLogs = () => {
  const originalError = logger.error;
  const originalInfo = logger.info;
  const originalLog = logger.log;
  const originalWarn = logger.warn;
  const originalSuccess = logger.success;
  beforeEach(() => {
    // @ts-ignore: We need to re-assign function since mocking is per file therefore with mocking this
    // function will be mocked only for called int his file and not for in the other test files
    logger.error = jest.fn();
    // @ts-ignore: We need to re-assign function since mocking is per file therefore with mocking this
    // function will be mocked only for called int his file and not for in the other test files
    logger.info = jest.fn();
    // @ts-ignore: We need to re-assign function since mocking is per file therefore with mocking this
    // function will be mocked only for called int his file and not for in the other test files
    logger.log = jest.fn();
    // @ts-ignore: We need to re-assign function since mocking is per file therefore with mocking this
    // function will be mocked only for called int his file and not for in the other test files
    logger.warn = jest.fn();
    // @ts-ignore: We need to re-assign function since mocking is per file therefore with mocking this
    // function will be mocked only for called int his file and not for in the other test files
    logger.success = jest.fn();
  });
  afterEach(() => {
    // @ts-ignore restoring the function back to its original implementation
    logger.error = originalError;
    // @ts-ignore restoring the function back to its original implementation
    logger.info = originalInfo;
    // @ts-ignore restoring the function back to its original implementation
    logger.log = originalLog;
    // @ts-ignore restoring the function back to its original implementation
    logger.warn = originalWarn;
    // @ts-ignore restoring the function back to its original implementation
    logger.success = originalSuccess;
  });
};
