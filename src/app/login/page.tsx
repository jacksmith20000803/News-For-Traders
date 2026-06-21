import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { isGoogleOAuthConfigured, isGitHubOAuthConfigured } from "@/auth";

export const metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Suspense>
        <LoginForm
          googleEnabled={isGoogleOAuthConfigured()}
          githubEnabled={isGitHubOAuthConfigured()}
        />
      </Suspense>
    </div>
  );
}
