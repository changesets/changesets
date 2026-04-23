import { getPackages } from "@manypkg/get-packages";

export const packagesSingleton = await getPackages(process.cwd());
