"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";

type CsvImportSummary = {
  created: number;
  skipped: number;
  errors: { rowNumber: number; message: string }[];
};

type CsvImportPanelProps = {
  onImportComplete?: () => void;
};

const MAX_FILE_SIZE_BYTES = 1_000_000;

function CsvImportPanel({ onImportComplete }: CsvImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSummary(null);
    setError(null);
    const nextFile = event.target.files?.[0];
    setFile(nextFile ?? null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Select a CSV file before uploading.");
      return;
    }

    if (!file.name.endsWith(".csv")) {
      setError("Only .csv files are supported.");
      return;
    }

    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("File exceeds 1MB limit.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch("/api/transactions/import", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<CsvImportSummary> & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to import CSV file");
      }

      const normalizedSummary: CsvImportSummary = {
        created: payload.created ?? 0,
        skipped: payload.skipped ?? 0,
        errors: payload.errors ?? [],
      };

      setSummary(normalizedSummary);
      if (normalizedSummary.created > 0) {
        onImportComplete?.();
      }
    } catch (uploadError) {
      setSummary(null);
      setError(uploadError instanceof Error ? uploadError.message : "Unexpected error during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Import expenses</p>
        <h2 className="text-2xl font-semibold text-slate-900">Upload CSV and convert to envelopes</h2>
        <p className="text-sm text-slate-600">
          Headers must match exactly:
          <strong className="font-semibold"> Contas</strong> → Description,
          <strong className="font-semibold"> Data de Compra</strong> → Date (dd/MM/yyyy),
          <strong className="font-semibold"> Valor Total</strong> → Value,
          <strong className="font-semibold"> Tipo</strong> → Envelope. Every row becomes an
          expense (`OUT`) automatically.
        </p>
        <p className="text-sm text-slate-600">
          Need a reference?{" "}
          <Link href="/samples/transactions-example.csv" className="text-emerald-600 underline" target="_blank">
            Download the CSV example
          </Link>
          .
        </p>
      </header>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          aria-label="Select CSV file"
          disabled={isUploading}
        />
        <Button type="button" disabled={isUploading || !file} onClick={handleUpload}>
          {isUploading ? "Uploading..." : "Upload CSV"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {summary ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <p>
              Created: <strong className="text-emerald-600">{summary.created}</strong>
            </p>
            <p>
              Skipped (duplicates): <strong className="text-slate-700">{summary.skipped}</strong>
            </p>
            <p>
              Errors: <strong className="text-rose-600">{summary.errors.length}</strong>
            </p>
          </div>

          {summary.errors.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Issues found</p>
              <ul className="space-y-1 text-sm text-slate-600">
                {summary.errors.map((rowError) => (
                  <li key={`${rowError.rowNumber}-${rowError.message}`}>
                    Row {rowError.rowNumber}: {rowError.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-emerald-700">All rows imported successfully!</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default CsvImportPanel;
