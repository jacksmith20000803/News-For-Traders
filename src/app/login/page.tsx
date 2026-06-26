import { LoginForm } from "@/components/auth/login-form";
import { isGoogleOAuthConfigured, isGitHubOAuthConfigured } from "@/auth";

export const metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <div className="auth-market-bg flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <LoginForm
          googleEnabled={isGoogleOAuthConfigured()}
          githubEnabled={isGitHubOAuthConfigured()}
        />
      </div>
    </div>
  );
}
