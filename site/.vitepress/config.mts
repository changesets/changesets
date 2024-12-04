import shared from "./shared";
import { defineConfig } from "vitepress";
import { nav } from "./nav";
import {sidebarFaq, sidebarGuide, sidebarLib} from "./sidebar";

export default defineConfig({
  ...shared,
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        nav: nav(),
        sidebar: {
          '/guide': {
            base: 'guide',
            items: sidebarGuide()
          },
          '/faq': {
            base: 'faq',
            items: sidebarFaq()
          },
          '/lib': {
            base: 'lib',
            items: sidebarLib()
          }
        }
      }
    }
  }
})