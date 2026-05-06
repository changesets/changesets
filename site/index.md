---
layout: home

hero:
  name: Changesets
  text: Version and Changelogs
  tagline: A tool to manage versioning and changelogs
  image:
    light: /logo-light.svg
    dark: /logo-dark.svg
    alt: Changesets logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/intro/what-are-changesets
    - theme: alt
      text: View on GitHub
      link: https://github.com/changesets/changesets

features:
  - icon: ⚡️
    title: Automated Versioning
    details: Automatically updates versions based on change types.
  - icon: 📦
    title: Monorepo Support
    details: Simplifies managing multiple packages within one repository.
  - icon: 📖
    title: Changelog Generation
    details: Automatically creates package changelogs.
  - icon: 🔄
    title: CI/CD Integration
    details: Release through automated pull requests and release triggers.
---

<script setup>
import { VPHomeSponsors } from 'vitepress/theme'
</script>

<VPHomeSponsors
  actionLink="https://github.com/sponsors/changesets"
  message="Changesets is free and open source, made possible by your support."
  :data="[]"
/>
