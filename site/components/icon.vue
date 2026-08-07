<template>
  <img :src="$props.src" :alt="$props.alt ?? ''" class="icon" />
</template>

<script setup lang="ts">
defineProps<{
  src: string;
  alt?: string;
}>();
</script>

<style>
.icon {
  display: inline-block;
}
</style>
