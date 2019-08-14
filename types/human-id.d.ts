declare module "human-id" {
  type humanId = () => string;

  export default function(options: {
    separator: string;
    capitalize: boolean;
  }): string;
}
