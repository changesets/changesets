<script setup lang="ts">
import { data as posts } from "./index.data";
</script>

# The Changesets Blog

<ul :class="$style.list">
  <li v-for="post of posts">
    <article>
      <time :datetime="post.date.iso">{{ post.date.string }}</time>
      <h2>
        <a :href="post.url">{{ post.title }}</a>
      </h2>
    </article>
  </li>
</ul>

<style module>
/* Specify `ul` and `.list` to increase specificity over vp-docs styling */
ul.list {
  list-style-type: none;
  padding: 0;
}
ul.list > li {
  margin-top: 3em;
  border-bottom: 1px solid var(--vp-c-divider);
}
ul.list > li + li {
  margin-top: 1.5em;
}
ul.list > li time {
  font-size: 0.8rem;
}
ul.list > li h2 {
  border: none;
  margin-top: 0;
  padding-top: 0;
  font-size: 1.4rem;
}
ul.list > li h2 a {
  font-weight: 600;
  text-decoration: none;
}
</style>
