import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Login",
};

type LoginPageProps = {
  searchParams?: {
    callbackUrl?: string;
    error?: string;
  };
};

function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl = typeof searchParams?.callbackUrl === "string" ? searchParams.callbackUrl : undefined;
  const errorCode = typeof searchParams?.error === "string" ? searchParams.error : undefined;

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-12">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Secure access</p>
          <CardTitle className="text-3xl text-slate-900">Sign in to continue</CardTitle>
          <CardDescription className="text-base text-slate-600">
            Authenticate to view your personal finance dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl} initialErrorCode={errorCode} />
        </CardContent>
      </Card>
    </section>
  );
}

export default LoginPage;
