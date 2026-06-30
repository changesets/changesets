import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import "./custom.css";
import "virtual:group-icons.css";
import { syncCodeGroups } from "./sync-code-groups.ts";

export default {
  extends: DefaultTheme,
  enhanceApp() {
    syncCodeGroups();
  },
} satisfies Theme;
