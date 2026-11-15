<script setup lang="ts">
import BskyLogo from "~icons/logos/bluesky";
import GithubLogo from "~icons/logos/github-icon";

const props = defineProps<{
  bsky?: string;
  github?: string;
}>();
</script>

<template>
  <span class="socials">
    <a
      v-if="bsky"
      :href="`https://bsky.app/profile/${props.bsky}`"
      target="_blank"
      rel="noopener"
      :title="`@${props.bsky} on Bluesky`"
    >
      <BskyLogo
        v-if="$props.bsky"
        class="icon bsky no-shadow"
        aria-hidden="true"
      />
    </a>
    <a
      v-if="github"
      :href="`https://github.com/${props.github}`"
      target="_blank"
      rel="noopener"
      :title="`@${props.github} on GitHub`"
    >
      <GithubLogo
        v-if="$props.github"
        class="icon github no-shadow"
        aria-hidden="true"
      />
    </a>
  </span>
</template>

<style>
.socials {
  display: inline-flex;
  margin: 0 0.25rem;
  gap: 0.3rem;
}

.dark .github {
  filter: invert(1);
}
</style>
