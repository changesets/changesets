import {
  createMarkdownRenderer,
  defineLoader,
  type MarkdownRenderer,
  type SiteConfig,
} from "vitepress";
import { cli } from "../../packages/cli/src/cli.ts";

export interface Data {
  mainHelpMessage: string;
  initHelpMessage: string;
  addHelpMessage: string;
  versionHelpMessage: string;
  publishHelpMessage: string;
  publishPlanHelpMessage: string;
  packHelpMessage: string;
  gitTagHelpMessage: string;
  preHelpMessage: string;
}

declare const data: Data;
export { data };

const helpMessageTasks: Record<
  keyof Data,
  {
    flags: string[];
    sections: string[];
    processMessage?: (message: string) => string;
  }
> = {
  mainHelpMessage: {
    flags: ["--help"],
    sections: ["Usage", "Commands"],
  },
  initHelpMessage: {
    flags: ["init", "--help"],
    sections: ["Usage", "Options", "Examples"],
  },
  addHelpMessage: {
    flags: ["add", "--help"],
    sections: ["Options", "Examples"],
    processMessage: (log) =>
      `\
Usage:
  $ changeset [options]
  $ changeset add [options]

${log}`,
  },
  versionHelpMessage: {
    flags: ["version", "--help"],
    sections: ["Usage", "Options", "Examples"],
  },
  publishHelpMessage: {
    flags: ["publish", "--help"],
    sections: ["Usage", "Options", "Examples"],
  },
  publishPlanHelpMessage: {
    flags: ["publish-plan", "--help"],
    sections: ["Usage", "Options", "Examples"],
  },
  packHelpMessage: {
    flags: ["pack", "--help"],
    sections: ["Usage", "Options", "Examples"],
  },
  gitTagHelpMessage: {
    flags: ["tag", "--help"],
    sections: ["Usage", "Options", "Examples"],
  },
  preHelpMessage: {
    flags: ["pre", "--help"],
    sections: ["Usage", "Options", "Examples"],
  },
};

export default defineLoader({
  async load(): Promise<Data> {
    const data: Data = {
      mainHelpMessage: "",
      initHelpMessage: "",
      addHelpMessage: "",
      versionHelpMessage: "",
      publishHelpMessage: "",
      publishPlanHelpMessage: "",
      packHelpMessage: "",
      gitTagHelpMessage: "",
      preHelpMessage: "",
    };

    const config: SiteConfig = (globalThis as any).VITEPRESS_CONFIG;
    const renderer = await createMarkdownRenderer(
      config.srcDir,
      config.markdown,
      config.site.base,
      config.logger,
    );

    let logs: string[] = [];
    const _info = console.info;
    console.info = (...args) => {
      logs.push(args.join(" "));
    };

    for (const [key, task] of Object.entries(helpMessageTasks)) {
      logs = [];
      cli.parse(["node", "changeset", ...task.flags], { run: false });
      cli.runMatchedCommand();
      data[key as keyof Data] = logs.join("\n");
    }

    console.info = _info;

    await Promise.all(
      Object.keys(data).map(async (key) => {
        const message = data[key as keyof Data];
        const task = helpMessageTasks[key as keyof Data];

        let newMessage = getMessageSections(message, task.sections);
        newMessage = task.processMessage?.(newMessage) ?? newMessage;

        data[key as keyof Data] = await renderHelpMessage(renderer, newMessage);
      }),
    );

    return data;
  },
});

function getMessageSections(message: string, sections: string[]) {
  const newLines: string[] = [];
  let inSection: string | false = false;
  for (const line of [...message.split("\n"), ""]) {
    if (!inSection) {
      // Start section when a line matches one of the section headers
      if (sections.some((section) => line.startsWith(section + ":"))) {
        inSection = line;
        newLines.push(line);
      }
    } else {
      // If empty line, we reach the end of the section
      if (line.trim() === "") {
        // If the last line is the same as the section header, it means the section has no content,
        // so remove it
        if (newLines.at(-1) === inSection) {
          newLines.pop();
        } else {
          newLines.push(line);
        }
        inSection = false;
      } else if (
        // Skip known irrelevant lines
        !line.includes("-v, --version") &&
        !line.includes("-h, --help")
      ) {
        newLines.push(line);
      }
    }
  }
  return newLines.join("\n");
}

async function renderHelpMessage(renderer: MarkdownRenderer, message: string) {
  const md = "```bash\n" + message + "\n```";
  const html = (await renderer.renderAsync(md))
    // VitePress auto-dedents lines that starts with `$`. We want to keep it indented and selectable.
    .replace(/user-select:none;-webkit-user-select:none">\$/g, '">  $');

  return html;
}
