import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Sign Up",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <RegisterForm />
    </div>
  );
}
