"use client";

import { useEffect } from "react";

const RECORDED_KEY = "tradx-install-success-recorded";

export function InstallSuccessRecorder() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("recorded") === "1") return;

    try {
      if (window.sessionStorage.getItem(RECORDED_KEY) === "1") return;
      window.sessionStorage.setItem(RECORDED_KEY, "1");
    } catch {
      // If storage is blocked, still attempt the server-side install record once.
    }

    void fetch("/api/install-success?format=json", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {
      // Install tracking must never interrupt the success page.
    });
  }, []);

  return null;
}
