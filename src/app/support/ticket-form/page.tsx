"use client";

import { FormEvent, useState } from "react";
import { PasteImageArea } from "@/components/ui/paste-image-area";

export default function SupportTicketFormPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!imageFile) {
      setSubmittedMessage("Paste a screenshot before submitting the example form.");
      return;
    }

    console.log("Support ticket screenshot:", {
      file: imageFile,
      previewUrl,
      name: imageFile.name,
      type: imageFile.type,
      size: imageFile.size,
    });
    setSubmittedMessage("Screenshot file logged to the console.");
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-3xl flex-col justify-center px-4 py-10">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#0b0f12]">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
            Support
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">
            Paste Screenshot Example
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Click the paste area, press Ctrl+V or Cmd+V, then submit to see the pasted image file logged.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <PasteImageArea
            maxSizeMB={5}
            onImageChange={(file, url) => {
              setImageFile(file);
              setPreviewUrl(url);
              setSubmittedMessage("");
            }}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              Submit Example
            </button>
            {submittedMessage && (
              <p role="status" className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {submittedMessage}
              </p>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
