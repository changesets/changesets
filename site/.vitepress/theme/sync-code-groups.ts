const seenCodeGroups = new WeakSet<Element>();
const syncEventName = "vitepress-sync-code-groups:tab-change";

export function syncCodeGroups() {
  if (typeof document === "undefined") return;

  const observer = new MutationObserver(() => {
    for (const group of document.querySelectorAll(".vp-code-group")) {
      if (seenCodeGroups.has(group)) continue;
      seenCodeGroups.add(group);

      const labels = group.querySelectorAll<HTMLLabelElement>(".tabs > label");
      const key = getKeyFromLabels(labels);

      const update = () => {
        const selected = localStorage.getItem(key);
        if (!selected) return;

        // NOTE: Do not click the label as otherwise VitePress will scroll to it.
        // We manually implement the active state here.
        const i = [...labels].findIndex((l) => l.dataset.title === selected);
        if (i < 0) return localStorage.removeItem(key);

        const blocks = group.querySelector(".blocks");
        if (!blocks) return;

        const current = [...blocks.children].find((c) =>
          c.classList.contains("active"),
        );
        if (!current) return;

        const next = blocks.children[i];
        if (!next || current === next) return;

        current.classList.remove("active");
        next.classList.add("active");
        (labels[i].control as HTMLInputElement).checked = true;
      };

      // Update on page load
      update();

      // Update on tab change in other tabs
      document.addEventListener(syncEventName, (event: any) => {
        if (event.detail.key === key) update();
      });

      // When a tab is clicked, update localStorage and notify other tabs
      for (const label of labels) {
        label.addEventListener("click", () => {
          localStorage.setItem(key, label.dataset.title!);
          document.dispatchEvent(
            new CustomEvent(syncEventName, { detail: { key } }),
          );
        });
      }
    }
  });
  observer.observe(document, { childList: true, subtree: true });
}

function getKeyFromLabels(labels: NodeListOf<HTMLLabelElement>) {
  const id = [...labels]
    .map((l) => l.dataset.title)
    .sort()
    .join("-");
  return `vitepress-sync-code-groups:${id}`;
}
