"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";

const errorMessages: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  Default: "Unable to sign in. Please try again.",
};

type LoginFormProps = {
  callbackUrl?: string;
  initialErrorCode?: string;
};

function LoginForm({ callbackUrl, initialErrorCode }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialErrorCode) {
      setError(errorMessages[initialErrorCode] ?? errorMessages.Default);
    }
  }, [initialErrorCode]);

  const destination = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: destination,
      });

      if (result?.error) {
        setError(errorMessages[result.error] ?? errorMessages.Default);
        return;
      }

      router.push(result?.url ?? destination);
      router.refresh();
    });
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-rose-600" role="alert">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

export default LoginForm;
