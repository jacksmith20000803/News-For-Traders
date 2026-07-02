"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type OAuthProviderId = "google" | "github" | "discord" | "telegram";

export type OAuthAvailability = Partial<Record<OAuthProviderId, boolean>>;

const oauthProviders: Array<{
  id: OAuthProviderId;
  name: string;
  icon: string;
}> = [
  { id: "google", name: "Google", icon: "/oauth/oauth-google.svg" },
  { id: "telegram", name: "Telegram", icon: "/oauth/oauth-telegram.svg" },
  { id: "discord", name: "Discord", icon: "/oauth/oauth-discord.svg" },
  { id: "github", name: "GitHub", icon: "/oauth/oauth-github.svg" },
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
        const content = (
          <>
            <Image
              src={provider.icon}
              alt=""
              width={22}
              height={22}
              className="h-5 w-5 shrink-0"
            />
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
