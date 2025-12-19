"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type CsvImportError = {
  rowNumber: number;
  message: string;
};

type CsvImportSummary = {
  created: number;
  skipped: number;
  errors: CsvImportError[];
  overwritten: boolean;
};

type CsvImportResult =
  | { ok: true; summary: CsvImportSummary }
  | { ok: false; error: string };

type CsvImportButtonProps = {
  onImportStart?: () => void;
  onImportComplete?: () => void;
  onImportResult?: (result: CsvImportResult) => void;
};

const MAX_FILE_SIZE_BYTES = 1_000_000;

function CsvImportButton({ onImportStart, onImportComplete, onImportResult }: CsvImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const triggerFilePicker = () => {
    if (isUploading) return;
    inputRef.current?.click();
  };

  const handleUpload = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      onImportResult?.({ ok: false, error: "Only .csv files are supported." });
      return;
    }

    if (file.size === 0) {
      onImportResult?.({ ok: false, error: "The selected file is empty." });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      onImportResult?.({ ok: false, error: "File exceeds 1MB limit." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);

    try {
      const response = await fetch("/api/transactions/import", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<CsvImportSummary> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to import CSV file");
      }

      const summary: CsvImportSummary = {
        created: payload.created ?? 0,
        skipped: payload.skipped ?? 0,
        errors: payload.errors ?? [],
        overwritten: payload.overwritten ?? false,
      };

      onImportResult?.({ ok: true, summary });
      if (summary.created > 0) {
        onImportComplete?.();
      }
    } catch (error) {
      onImportResult?.({
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error during upload.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    onImportStart?.();
    void handleUpload(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
      <Button type="button" variant="secondary" disabled={isUploading} onClick={triggerFilePicker}>
        {isUploading ? "Importing..." : "Import CSV"}
      </Button>
      <Link href="/samples/transactions-example.csv" className="text-xs text-emerald-600 underline" target="_blank">
        CSV example
      </Link>
    </div>
  );
}

export default CsvImportButton;
