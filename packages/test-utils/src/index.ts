/**
 * Reason for eslint disable import/no-commonjs
 * Technically reassigning imports is not allowed and
 * Rollup errors at compile time on this(but the Babel
 * transform that's running in jest makes it work there),
 * making this a require should be fine.
 */
// eslint-disable-next-line import/no-commonjs
const logger = require("@changesets/logger");

export const temporarilySilenceLogs = () => {
  const originalError = logger.error;
  const originalInfo = logger.info;
  const originalLog = logger.log;
  const originalWarn = logger.warn;
  const originalSuccess = logger.success;
  beforeEach(() => {
    logger.error = jest.fn();
    logger.info = jest.fn();
    logger.log = jest.fn();
    logger.warn = jest.fn();
    logger.success = jest.fn();
  });
  afterEach(() => {
    logger.error = originalError;
    logger.info = originalInfo;
    logger.log = originalLog;
    logger.warn = originalWarn;
    logger.success = originalSuccess;
  });
};
