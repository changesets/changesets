// @ts-ignore
import isCI from "is-ci";

export default !!(isCI || process.env.GITHUB_ACTIONS);
