declare module "jest-fixtures" {
  // this type is technically wrong because getFixturePath can return null
  // but really we need jest-fixtures to throw an error when a fixture can't be found
  // because checking for null in every usage of these things would be ridiculous
  // or we could use fixturez which IMO has a better API and throws when fixtures
  // can't be found
  export function getFixturePath(dir: string, fixtureName: string): string;
}
