import { RegisterForm } from "@/components/auth/register-form";
import {
  isDiscordOAuthConfigured,
  isGitHubOAuthConfigured,
  isGoogleOAuthConfigured,
  isTelegramOAuthConfigured,
} from "@/auth";

export const metadata = {
  title: "Sign Up",
};

export default function RegisterPage() {
  return (
    <div className="auth-market-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="relative z-10 w-full max-w-5xl">
        <RegisterForm
          oauthAvailability={{
            google: isGoogleOAuthConfigured(),
            github: isGitHubOAuthConfigured(),
            discord: isDiscordOAuthConfigured(),
            telegram: isTelegramOAuthConfigured(),
          }}
        />
      </div>
    </div>
  );
}
