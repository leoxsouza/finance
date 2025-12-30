import type { Metadata } from "next";

import { requireSession } from "@/lib/auth/serverSession";
import { GEMINI_LIMITS } from "@/lib/ai/config";

import PdfImportClient from "./PdfImportClient";

export const metadata: Metadata = {
  title: "Import PDF transactions",
};

async function PdfImportPage() {
  await requireSession();

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-2 pb-16 sm:px-0">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AI Import</p>
        <h1 className="text-3xl font-semibold text-slate-900">Convert PDF statements into transactions</h1>
        <p className="max-w-3xl text-base text-slate-600">
          Upload a PDF invoice, let Gemini extract every transaction, and review the results before saving them.
          Nothing is stored until you choose to continue.
        </p>
      </header>

      <PdfImportClient maxFileBytes={GEMINI_LIMITS.maxPdfBytes} />
    </section>
  );
}

export default PdfImportPage;
