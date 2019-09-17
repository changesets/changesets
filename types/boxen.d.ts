// NOTE: There is a boxen types that doesn't work so made this here
declare module "boxen" {
  export default function(
    meesage: string,
    options: {
      borderStyle: string;
      align: string;
    }
  ): string;
}
