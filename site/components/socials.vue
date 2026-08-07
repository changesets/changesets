<template>
  <span class="socials">
    <a :href="bskyLink" target="_blank" rel="noopener"
       :title="bskyAltText">
      <BskyLogo
        v-if="$props.bsky"
        :alt="bskyAltText"
        class="icon bsky no-shadow"
      />
    </a>
    <a :href="githubLink" target="_blank" rel="noopener" :title="githubAltText">
      <GithubLogo
        v-if="$props.github"
        :alt="githubAltText"
        class="icon github no-shadow"
      />
    </a>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BskyLogo from "~icons/logos/bluesky";
import GithubLogo from "~icons/logos/github-icon";

const props = defineProps<{
  bsky?: string;
  github?: string;
}>();

const bskyLink = computed(() =>
  props.bsky ? `https://bsky.app/profile/${props.bsky}` : null,
);
const bskyAltText = computed(() =>
  props.bsky ? `@${props.bsky} on Bluesky` : null,
);

const githubLink = computed(() =>
  props.github ? `https://github.com/${props.github}` : null,
);
const githubAltText = computed(() =>
  props.bsky ? `@${props.github} on GitHub` : null,
);
</script>

<style>
.socials {
  vertical-align: text-top;
  display: inline-flex;
  margin: 0 3px;
  gap: 5px;
}
.socials a {
  line-height: 0;
}

.dark .github {
  filter: invert(1);
}
</style>
