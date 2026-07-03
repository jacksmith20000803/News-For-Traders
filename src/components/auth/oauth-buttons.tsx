"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type OAuthProviderId = "google" | "github" | "discord" | "telegram";

export type OAuthAvailability = Partial<Record<OAuthProviderId, boolean>>;

const oauthProviders: Array<{
  id: OAuthProviderId;
  name: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "google", name: "Google", icon: GoogleIcon },
  { id: "telegram", name: "Telegram", icon: TelegramIcon },
  { id: "discord", name: "Discord", icon: DiscordIcon },
  { id: "github", name: "GitHub", icon: GitHubIcon },
];

interface AuthOAuthButtonsProps {
  mode: "signin" | "signup";
  availability?: OAuthAvailability;
  returnTo?: string;
  className?: string;
}

export function AuthOAuthButtons({
  mode,
  availability,
  returnTo = "/dashboard",
  className,
}: AuthOAuthButtonsProps) {
  const action = mode === "signin" ? "Sign in" : "Sign up";
  const authPage = mode === "signin" ? "/login" : "/register";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="mb-2 mt-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Fast access
        </p>
      </div>

      {oauthProviders.map((provider) => {
        const configured = availability?.[provider.id] ?? true;
        const Icon = provider.icon;
        const content = (
          <>
            <Icon className="h-5 w-5 shrink-0" />
            <span>{action} with {provider.name}</span>
          </>
        );
        const buttonClassName = cn(
          "group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/90 px-3 text-sm font-semibold text-foreground shadow-sm transition-all",
          "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg active:translate-y-0.5 active:scale-95",
          !configured && "border-amber-400/40"
        );

        return (
          <Link
            key={provider.id}
            href={`/api/auth/oauth/${provider.id}?returnTo=${encodeURIComponent(returnTo)}&authPage=${encodeURIComponent(authPage)}`}
            className={buttonClassName}
            prefetch={false}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="-3 0 262 262" className={className} aria-hidden="true">
      <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4" />
      <path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853" />
      <path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05" />
      <path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#2AABEE" />
      <path fill="#fff" d="M49.7 17.6 43.8 47c-.4 2.1-1.6 2.6-3.3 1.6l-9-6.6-4.3 4.2c-.5.5-.9.9-1.9.9l.7-9.2 16.7-15.1c.7-.7-.2-1-1.1-.4L21 35.4l-8.9-2.8c-1.9-.6-2-1.9.4-2.8l34.7-13.4c1.6-.6 3 .4 2.5 1.2Z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="#5865F2" />
      <path fill="#fff" d="M44.7 20.5A31.7 31.7 0 0 0 37 18l-.4.8a29.4 29.4 0 0 1 6.8 3.5 23 23 0 0 0-20.7 0 29 29 0 0 1 6.8-3.5L29 18a31.7 31.7 0 0 0-7.7 2.5c-4.9 7.2-6.2 14.3-5.5 21.3a31 31 0 0 0 9.4 4.8l1.9-3.1a20 20 0 0 1-3-1.4l.7-.5a22 22 0 0 0 18.4 0l.7.5c-.9.5-1.9 1-3 1.4l1.9 3.1a31 31 0 0 0 9.4-4.8c.8-8.1-1.3-15-5.5-21.3ZM27 37.5c-1.8 0-3.3-1.7-3.3-3.7s1.5-3.7 3.3-3.7 3.3 1.7 3.3 3.7-1.5 3.7-3.3 3.7Zm10 0c-1.8 0-3.3-1.7-3.3-3.7s1.5-3.7 3.3-3.7 3.3 1.7 3.3 3.7-1.5 3.7-3.3 3.7Z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 -3.1 2490.3 2493" className={className} aria-hidden="true">
      <ellipse cx="1245.2" cy="1243.4" fill="#fff" rx="1217.6" ry="1246.5" />
      <path d="m1245.2 1.6c-687.6 0-1245.2 557.4-1245.2 1245.1 0 550.2 356.8 1016.9 851.5 1181.5 62.2 11.5 85.1-27 85.1-59.9 0-29.7-1.2-127.8-1.7-231.8-346.4 75.3-419.5-146.9-419.5-146.9-56.6-143.9-138.3-182.2-138.3-182.2-113-77.3 8.5-75.7 8.5-75.7 125 8.8 190.9 128.3 190.9 128.3 111.1 190.4 291.3 135.3 362.3 103.5 11.2-80.5 43.4-135.4 79.1-166.5-276.6-31.5-567.3-138.3-567.3-615.4 0-135.9 48.6-247 128.3-334.2-12.9-31.3-55.5-157.9 12.1-329.4 0 0 104.6-33.5 342.5 127.6 99.3-27.6 205.8-41.4 311.7-41.9 105.8.5 212.4 14.3 311.9 41.9 237.7-161.1 342.1-127.6 342.1-127.6 67.8 171.5 25.1 298.2 12.2 329.5 79.8 87.2 128.1 198.3 128.1 334.2 0 478.2-291.3 583.6-568.6 614.4 44.7 38.6 84.5 114.4 84.5 230.6 0 166.6-1.4 300.7-1.4 341.7 0 33.1 22.4 72 85.5 59.7 494.5-164.8 850.8-631.4 850.8-1181.4 0-687.7-557.5-1245.1-1245.1-1245.1" fill="#5c6bc0" />
    </svg>
  );
}
