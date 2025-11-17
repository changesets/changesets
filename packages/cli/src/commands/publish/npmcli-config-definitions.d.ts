declare module "@npmcli/config/lib/definitions/index.js" {
  export const definitions: Record<string, any>;
  export function flatten(
    obj: Record<string, any>,
    flat?: Record<string, any>
  ): Record<string, any>;
  export const shorthands: Record<string, string[]>;
}
