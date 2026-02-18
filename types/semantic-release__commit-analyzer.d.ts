// Type declarations for @semantic-release/commit-analyzer
// This provides TypeScript types for the JavaScript module
declare module "@semantic-release/commit-analyzer" {
  const analyzeCommits: (
    options: any,
    context: any
  ) => Promise<"major" | "minor" | "patch" | null>;

  export { analyzeCommits };
}
