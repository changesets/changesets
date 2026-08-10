<script setup lang="ts">
defineProps<{
  src: string;
  alt?: string;
}>();
</script>

<template>
  <img :src="src" :alt="alt ?? ''" class="icon" />
</template>

<style>
.icon {
  display: inline-block;
}
</style>
