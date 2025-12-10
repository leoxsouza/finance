"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Monitor spending vs. limits",
  },
  {
    href: "/setup",
    label: "Setup",
    description: "Adjust envelope percentages",
  },
  {
    href: "/transactions",
    label: "Transactions",
    description: "Record income & expenses",
  },
] as const;

function AppNav() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-base font-semibold text-emerald-700 transition group-hover:bg-emerald-200">
            PF
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Personal Finance</p>
            <p className="text-base font-semibold text-slate-900">Envelope Manager</p>
          </div>
        </Link>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileOpen}
          onClick={() => setIsMobileOpen((state) => !state)}
        >
          Menu
          <span className="text-lg">{isMobileOpen ? "−" : "+"}</span>
        </button>

        <nav className="hidden gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                isActive(link.href)
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {isMobileOpen ? (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 pb-4 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition",
                isActive(link.href)
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              )}
            >
              <p className="text-sm font-semibold">{link.label}</p>
              <p className="text-xs text-slate-500">{link.description}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}

export default AppNav;
