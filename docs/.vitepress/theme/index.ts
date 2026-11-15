import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme-without-fonts";
import "./custom.css";
import "vitepress-plugin-graphviz/style.css";
import "virtual:group-icons.css";
import { syncCodeGroups } from "./sync-code-groups.ts";

export default {
  extends: DefaultTheme,
  enhanceApp() {
    syncCodeGroups();
  },
} satisfies Theme;
