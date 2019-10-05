import * as logger from "@changesets/logger";

export const temporarilySilenceLogs = () => {
  const originalError = logger.error;
  const originalInfo = logger.info;
  const originalLog = logger.log;
  const originalWarn = logger.warn;
  beforeAll(() => {
    // @ts-ignore: We need to re-assign function since mocking is per file therefore with mocking this
    // function will be mocked only for called int his file and not for in the other test files
    logger.error = () => {};
    // @ts-ignore: We need to re-assign function since mocking is per file therefore with mocking this
    // function will be mocked only for called int his file and not for in the other test files
    logger.info = () => {};
    // @ts-ignore: We need to re-assign function since mocking is per file therefore with mocking this
    // function will be mocked only for called int his file and not for in the other test files
    logger.log = () => {};
    // @ts-ignore: We need to re-assign function since mocking is per file therefore with mocking this
    // function will be mocked only for called int his file and not for in the other test files
    logger.warn = () => {};
  });
  afterAll(() => {
    // @ts-ignore restoring the function back to its original implementation
    logger.error = originalError;
    // @ts-ignore restoring the function back to its original implementation
    logger.info = originalInfo;
    // @ts-ignore restoring the function back to its original implementation
    logger.log = originalLog;
    // @ts-ignore restoring the function back to its original implementation
    logger.warn = originalWarn;
  });
};
