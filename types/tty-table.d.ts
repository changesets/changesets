// NOTE: There is a boxen types that doesn't work so made this here
declare module "tty-table" {
  export default function(
    value: Array<{ value: string; width: number }>,
    columsn: string[][],
    options: {
      paddingLeft: number;
      paddingRight: number;
      headerAlign: string;
      align: string;
    }
  ): {
    render: () => string;
  };
}
