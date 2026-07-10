import fss from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { render } from "takumi-js";
import * as v from "valibot";
import * as yaml from "yaml";
import { formatDate } from "../.vitepress/theme/utils";

const blogDir = path.resolve(import.meta.dirname, "../blog");
const blogOgOutDir = path.resolve(import.meta.dirname, "../public/blog");

const frontmatterRegex = /^---\n([\s\S]+?)\n---/;
const frontmatterSchema = v.object({
  title: v.string(),
  date: v.string(),
  authors: v.array(
    v.object({
      name: v.string(),
      url: v.optional(v.string()),
    }),
  ),
});

type Frontmatter = v.InferInput<typeof frontmatterSchema>;

for (const blogFileName of await fs.readdir(blogDir)) {
  if (blogFileName.startsWith(".")) continue;

  const blogOgOutFile = path.join(
    blogOgOutDir,
    `${blogFileName.replace(/\.md$/, ".png")}`,
  );
  if (fss.existsSync(blogOgOutFile)) {
    console.log(`Skipping existing: ${blogOgOutFile}`);
    // continue;
  }

  const blogFilePath = path.join(blogDir, blogFileName);
  const blogContent = await fs.readFile(blogFilePath, "utf8");
  const frontmatter = getFrontmatter(blogContent, blogFilePath);

  console.log("Generating OG image for", blogFileName);

  const ogImageBuffer = await generateOgImage(frontmatter);

  await fs.mkdir(blogOgOutDir, { recursive: true });
  await fs.writeFile(blogOgOutFile, ogImageBuffer);
}

async function generateOgImage(frontmatter: Frontmatter) {
  // NOTE: For the most part, you can copy and paste this template to https://takumi.kane.tw/playground
  // to easily adjust the styling, but update the `style` prop as React-style object so that it works.
  const template = `\
    <div tw="flex flex-col justify-between w-full h-full px-20 py-24 bg-[#162a42] text-white">
      <div
        tw="absolute top-[-50px] left-[106px] w-[1600px] h-[1600px]"
        style="
          backgroundImage: radial-gradient(closest-side at 50% 50%, #006dcc, transparent);
        "
      ></div>
      <img tw="absolute top-[170px] left-[550px] opacity-30" src="https://raw.githubusercontent.com/changesets/changesets/refs/heads/main/assets/images/changesets-icon-dark.svg" height="500" />
      <div tw="flex items-center gap-3 text-3xl font-semibold opacity-90">
        The Changesets Blog
      </div>
      <div>
        <div
          tw="text-8xl font-semibold py-8 mix-blend-hard-light bg-clip-text text-transparent"
          style="
            backgroundImage: linear-gradient(135deg, white, #bbe6ff 80%);
            textWrap: pretty;
          "
        >${frontmatter.title}</div>
        <div tw="text-4xl opacity-90">${formatDate(frontmatter.date).string}</div>
      </div>
    </div>
  `;

  const buffer = await render(template, {
    width: 1200,
    height: 630,
    format: "png",
  });

  return buffer;
}

function getFrontmatter(content: string, contentPath: string) {
  const frontmatter = yaml.parse(frontmatterRegex.exec(content)?.[1] ?? "");

  try {
    return v.parse(frontmatterSchema, frontmatter);
  } catch (err) {
    throw new Error(`Invalid frontmatter in ${contentPath}`, { cause: err });
  }
}
