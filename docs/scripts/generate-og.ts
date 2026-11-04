import fss from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { render } from "takumi-js";
import { googleFonts } from "takumi-js/helpers";
import { extractBlogData } from "../.vitepress/theme/utils.ts";

const publicDir = path.resolve(import.meta.dirname, "../public");
const blogDir = path.resolve(import.meta.dirname, "../blog");
const blogOgOutDir = path.join(publicDir, "blog");

await generateWebsiteOgImage();

for (const blogFileName of await fs.readdir(blogDir)) {
  if (!blogFileName.endsWith(".md") || blogFileName === "index.md") continue;

  const blogOgOutFile = path.join(
    blogOgOutDir,
    `${blogFileName.replace(/\.md$/, ".png")}`,
  );
  if (fss.existsSync(blogOgOutFile) && !process.argv.includes("--force")) {
    console.log(`Skipping existing: ${blogOgOutFile}`);
    continue;
  }

  const blogFilePath = path.join(blogDir, blogFileName);
  const blogContent = await fs.readFile(blogFilePath, "utf8");
  const blogData = extractBlogData(blogContent, `/blog/${blogFileName}`);

  console.log("Generating OG image for", blogFileName);

  const ogImageBuffer = await generateBlogOgImage(blogData);

  await fs.mkdir(blogOgOutDir, { recursive: true });
  await fs.writeFile(blogOgOutFile, ogImageBuffer);
}

async function generateBlogOgImage(data: ReturnType<typeof extractBlogData>) {
  // NOTE: For the most part, you can copy and paste this template to https://takumi.kane.tw/playground
  // to easily adjust the styling, but update the `style` prop as React-style object so that it works.
  const template = `
    <div tw="flex flex-col justify-between size-full px-20 py-24 bg-[#162a42] text-[#eee] tracking-[-.02em]">
      <div
        tw="absolute top-[-50px] left-[106px] w-[1600px] h-[1600px]"
        style="
          backgroundImage: radial-gradient(closest-side at 50% 50%, #006dcc, transparent);
        "
      ></div>
      <img tw="absolute top-[170px] left-[550px] opacity-30" src="https://raw.githubusercontent.com/changesets/changesets/refs/heads/main/assets/images/changesets-icon-dark.svg" height="500" />
      <div tw="flex items-center text-3xl font-semibold opacity-90">
        The Changesets Blog
      </div>
      <div>
        <div
          tw="text-8xl font-semibold py-8 mix-blend-hard-light bg-clip-text text-transparent"
          style="
            backgroundImage: linear-gradient(135deg, white, #bbe6ff 80%);
            textWrap: pretty;
          "
        >${data.title}</div>
        <div tw="text-4xl opacity-90">${data.date}</div>
      </div>
    </div>
  `.trim();

  return generateOgImage(template);
}

async function generateWebsiteOgImage() {
  const ogImagePath = path.join(publicDir, "og-image.png");
  if (fss.existsSync(ogImagePath) && !process.argv.includes("--force")) {
    console.log(`Skipping existing: ${ogImagePath}`);
    return;
  }

  const template = `
    <div tw="flex size-full items-center justify-center gap-8 bg-[#162a42] text-[#eee]">
      <img
        tw="mb-2"
        height="150"
        src="https://raw.githubusercontent.com/changesets/changesets/refs/heads/main/assets/images/changesets-icon-dark.svg"
      />
      
      <div tw="text-[8.5em] font-bold">Changesets</div>
    </div>
  `.trim();

  const buffer = await generateOgImage(template);
  await fs.writeFile(ogImagePath, buffer);
}

async function generateOgImage(template: string) {
  return render(template, {
    width: 1200,
    height: 630,
    format: "png",
    fonts: googleFonts(["Averia Serif Libre"]),
  });
}
