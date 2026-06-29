"use client";

import { useEffect } from "react";

const EXTENSION_ATTRIBUTES = [
  "bis_skin_checked",
  "fdprocessedid",
  "cz-shortcut-listen",
  "data-new-gr-c-s-check-loaded",
  "data-gr-ext-installed",
];

const EXTENSION_SELECTOR = EXTENSION_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(",");

function removeExtensionAttributes(root: ParentNode = document) {
  const elements = [
    document.documentElement,
    document.body,
    ...Array.from(root.querySelectorAll<HTMLElement>(EXTENSION_SELECTOR)),
  ].filter(Boolean);

  for (const element of elements) {
    for (const attribute of EXTENSION_ATTRIBUTES) {
      element.removeAttribute(attribute);
    }
  }
}

export function HydrationCleanup() {
  useEffect(() => {
    removeExtensionAttributes();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          removeExtensionAttributes(mutation.target.parentNode ?? document);
          continue;
        }

        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement) {
            removeExtensionAttributes(node);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: EXTENSION_ATTRIBUTES,
    });

    const timeout = window.setTimeout(() => observer.disconnect(), 5000);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  return null;
}
