import type { Metadata } from "next";
import "./globals.css";
import AppNav from "@/components/layout/AppNav";
import AppSessionProvider from "@/components/providers/AppSessionProvider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Personal Finance Manager",
  description: "Track envelopes, transactions, and budgets with ease.",
};

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <AppSessionProvider>
          <div className="min-h-screen bg-slate-50">
            <AppNav />
            <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
            <Toaster richColors closeButton position="top-right" />
          </div>
        </AppSessionProvider>
      </body>
    </html>
  );
}

export default RootLayout;
