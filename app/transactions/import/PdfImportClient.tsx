"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { extractTransactionsFromPDF } from "@/app/actions/extract-pdf";
import { pdfFileToBase64 } from "@/lib/pdf/utils";
import type { ExtractionValidationResult } from "@/lib/ai/types";

import ExtractionPreviewTable from "./components/ExtractionPreviewTable";

type PdfImportClientProps = {
  maxFileBytes: number;
};

type UploadState = "idle" | "uploading" | "success" | "error";

function PdfImportClient({ maxFileBytes }: PdfImportClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadState>("idle");
  const [result, setResult] = useState<ExtractionValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ignoreFirstPage, setIgnoreFirstPage] = useState(true);
  const [isPending, startTransition] = useTransition();

  const isUploading = isPending || status === "uploading";

  const summary = useMemo(() => {
    if (!result) return null;
    const totalAmount = result.valid.reduce((sum, trx) => sum + trx.amount * (trx.type === "OUT" ? -1 : 1), 0);
    return {
      totalRecords: result.valid.length + result.invalid.length,
      validRecords: result.valid.length,
      invalidRecords: result.invalid.length,
      netAmount: totalAmount,
    };
  }, [result]);

  const handleSelectFile = (selected: File | null) => {
    setFile(selected);
    setResult(null);
    setError(null);
    setStatus("idle");
  };

  const handleUpload = () => {
    if (!file) {
      setError("Selecione um PDF antes de enviar.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Aceitamos apenas arquivos PDF.");
      return;
    }

    if (file.size === 0) {
      setError("O arquivo selecionado está vazio.");
      return;
    }

    if (file.size > maxFileBytes) {
      setError(`Arquivo maior que o limite de ${(maxFileBytes / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }

    setError(null);
    setStatus("uploading");
    startTransition(async () => {
      try {
        const base64 = await pdfFileToBase64(file);
        const extraction = await extractTransactionsFromPDF({ fileBase64: base64, ignoreFirstPage });
        setResult(extraction);
        setStatus("success");
        toast.success("PDF analisado", {
          description: `Encontramos ${extraction.valid.length} transações válidas.`,
        });
      } catch (err) {
        setResult(null);
        setStatus("error");
        const message = err instanceof Error ? err.message : "Falha ao processar PDF.";
        setError(message);
        toast.error("Erro ao processar PDF", { description: message });
      }
    });
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setStatus("idle");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload do PDF</CardTitle>
          <CardDescription>Arquivos são analisados localmente e enviados ao Gemini apenas durante esta sessão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              type="file"
              accept="application/pdf"
              onChange={(event) => handleSelectFile(event.target.files?.[0] ?? null)}
              disabled={isUploading}
            />
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ignoreFirstPage}
                  onChange={(event) => setIgnoreFirstPage(event.target.checked)}
                  className="h-4 w-4"
                  disabled={isUploading}
                />
                Ignorar capa (primeira página)
              </label>
            </div>
          </div>
          {file ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{file.name}</p>
              <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Arraste um PDF aqui ou selecione pelo botão acima. Limite de {(maxFileBytes / 1024 / 1024).toFixed(1)} MB.
            </p>
          )}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleUpload} disabled={!file || isUploading}>
              {isUploading ? "Processando..." : "Processar PDF"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleReset} disabled={isUploading && !file}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <ExtractionPreviewTable result={result} summary={summary} onDiscard={handleReset} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            O resultado da extração aparecerá aqui assim que o PDF for processado.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PdfImportClient;
