const EXTENSION_ATTRIBUTES = [
  "bis_skin_checked",
  "fdprocessedid",
  "cz-shortcut-listen",
  "data-new-gr-c-s-check-loaded",
  "data-gr-ext-installed",
];

function cleanExtensionAttributes() {
  try {
    const selector = EXTENSION_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(",");
    const elements = [
      document.documentElement,
      document.body,
      ...Array.from(document.querySelectorAll<HTMLElement>(selector)),
    ].filter(Boolean);

    for (const element of elements) {
      for (const attribute of EXTENSION_ATTRIBUTES) {
        element.removeAttribute(attribute);
      }
    }
  } catch {
    // Browser extension cleanup must never block hydration.
  }
}

cleanExtensionAttributes();
