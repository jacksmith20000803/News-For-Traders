"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ImagePlus, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { getCsrfToken, readJsonResponse } from "@/lib/api/client";
import { COMMUNITY_PRESET_AVATARS, COMMUNITY_PRESET_BADGES } from "@/lib/community/presets";
import { cn } from "@/lib/utils";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export default function NewCommunityPage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const badgeInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [rules, setRules] = useState("");
  const [avatarPreset, setAvatarPreset] = useState(COMMUNITY_PRESET_AVATARS[0]);
  const [badgePreset, setBadgePreset] = useState(COMMUNITY_PRESET_BADGES[0]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [badgeFile, setBadgeFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const avatarPreview = useObjectUrl(avatarFile);
  const badgePreview = useObjectUrl(badgeFile);
  const effectiveAvatar = avatarPreview ?? avatarPreset;
  const effectiveBadge = badgePreview ?? badgePreset;
  const canSubmit = name.trim().length >= 3 && topic.trim().length >= 10 && rules.trim().length >= 20 && !loading;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("topic", topic.trim());
      formData.append("rules", rules.trim());
      formData.append("avatarPreset", avatarPreset);
      formData.append("badgePreset", badgePreset);
      if (avatarFile) formData.append("avatar", avatarFile);
      if (badgeFile) formData.append("badge", badgeFile);

      const response = await fetch("/api/community/communities", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": await getCsrfToken() },
        body: formData,
      });
      const json = await readJsonResponse<ApiResponse<{ community: { id: string } }>>(response);
      if (!json.success) {
        setError(json.error ?? "Failed to submit community request.");
        return;
      }
      router.push("/community");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to submit community request.");
    } finally {
      setLoading(false);
    }
  }

  const sampleRules = useMemo(
    () =>
      [
        "Respect other traders and keep disagreements professional.",
        "No spam, scams, phishing links, or guaranteed-profit claims.",
        "Mark risky trade ideas clearly and include context.",
        "Do not share private personal or financial information.",
      ].join("\n"),
    []
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/community" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Back to community
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={submit} className="overflow-hidden rounded-[1.5rem] border border-border bg-card/95 shadow-xl">
          <div className="border-b border-border p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Admin approval required</p>
            <h1 className="mt-1 text-2xl font-black">Create a community</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Build a focused trading room with rules, moderation, and member consent.
            </p>
          </div>

          <div className="space-y-6 p-5">
            {error ? (
              <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-300">
                {error}
              </p>
            ) : null}

            <Field label="Community name">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Crypto Macro Desk"
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </Field>

            <Field label="Topic">
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="A clean room for daily crypto market structure, catalysts, and risk."
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </Field>

            <Field label="Rules">
              <textarea
                value={rules}
                onChange={(event) => setRules(event.target.value)}
                rows={9}
                placeholder={sampleRules}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
              <button
                type="button"
                onClick={() => setRules(sampleRules)}
                className="mt-2 text-xs font-bold text-primary hover:underline"
              >
                Use starter rules
              </button>
            </Field>

            <AssetPicker
              title="Community avatar"
              presets={COMMUNITY_PRESET_AVATARS}
              selected={avatarPreset}
              uploadedName={avatarFile?.name}
              onSelect={(value) => {
                setAvatarPreset(value);
                setAvatarFile(null);
              }}
              onUpload={() => avatarInputRef.current?.click()}
            />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
            />

            <AssetPicker
              title="Discover badge"
              presets={COMMUNITY_PRESET_BADGES}
              selected={badgePreset}
              uploadedName={badgeFile?.name}
              wide
              onSelect={(value) => {
                setBadgePreset(value);
                setBadgeFile(null);
              }}
              onUpload={() => badgeInputRef.current?.click()}
            />
            <input
              ref={badgeInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => setBadgeFile(event.target.files?.[0] ?? null)}
            />

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Submit for approval
            </button>
          </div>
        </form>

        <aside className="h-fit overflow-hidden rounded-[1.5rem] border border-border bg-card/95 shadow-xl">
          <div
            className="h-40 bg-gradient-to-br from-emerald-500 via-sky-500 to-fuchsia-500"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.35)), url(${effectiveBadge})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <div className="relative p-5 pt-12">
            <div
              className="absolute -top-10 left-5 flex h-20 w-20 items-center justify-center rounded-[1.4rem] border-4 border-card bg-cover bg-center text-xl font-black text-white shadow-xl"
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(16,185,129,0.45), rgba(59,130,246,0.18)), url(${effectiveAvatar})`,
              }}
            >
              {!effectiveAvatar ? name.slice(0, 2).toUpperCase() || "CM" : null}
            </div>
            <h2 className="line-clamp-1 text-xl font-black">{name || "Community name"}</h2>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{topic || "Community topic preview"}</p>
            <div className="mt-5 rounded-2xl border border-border bg-background/75 p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Rules preview</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{rules || sampleRules}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-foreground">{label}</span>
      {children}
    </label>
  );
}

function AssetPicker({
  title,
  presets,
  selected,
  uploadedName,
  wide,
  onSelect,
  onUpload,
}: {
  title: string;
  presets: string[];
  selected: string;
  uploadedName?: string;
  wide?: boolean;
  onSelect: (value: string) => void;
  onUpload: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-foreground">{title}</p>
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-black text-muted-foreground hover:text-primary"
        >
          <UploadCloud className="h-4 w-4" />
          Upload
        </button>
      </div>
      {uploadedName ? (
        <p className="mb-3 inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
          <ImagePlus className="h-4 w-4" />
          {uploadedName}
        </p>
      ) : null}
      <div className={cn("grid gap-3", wide ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-4 sm:grid-cols-8")}>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onSelect(preset)}
            className={cn(
              "relative overflow-hidden border bg-background bg-cover bg-center shadow-sm transition hover:-translate-y-0.5",
              wide ? "aspect-[16/9] rounded-2xl" : "aspect-square rounded-2xl",
              selected === preset && !uploadedName && "border-primary ring-2 ring-primary/25"
            )}
            style={{ backgroundImage: `url(${preset})` }}
            aria-label={`Select ${title}`}
          >
            {selected === preset && !uploadedName ? (
              <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}
