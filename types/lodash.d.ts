/*
WHAT THE HECK IS GOING ON?

Lodash individual methods don't have types, but their type info exists in `@lodash/types`
We can import and then export things in our d.ts to add types to modules without typing
them ourselves.

This does mean we import 'lodash' which is not a dependency.

That's okay, for certain values of okay.
*/

/* eslint-disable */
declare module "lodash.startcase" {
  import { startCase } from "lodash";

  export default startCase;
}
