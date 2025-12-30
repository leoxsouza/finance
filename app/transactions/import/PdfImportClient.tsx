"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import Badge from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { extractTransactionsFromPDF } from "@/app/actions/extract-pdf";
import { pdfFileToBase64 } from "@/lib/pdf/utils";
import type { CardImportSession } from "@/lib/types/card-import";
import type { CardStatementImportDTO } from "@/lib/card-import/dto";
import type { SaveImportSessionResult } from "@/lib/card-import/persistence";

import ExtractionPreviewTable, { type PurchaseOverrideMap } from "./components/ExtractionPreviewTable";

type PdfImportClientProps = {
  maxFileBytes: number;
};

type ImportStage = "idle" | "processing" | "review" | "persisted";

type ImportFlowState =
  | { status: "idle" }
  | { status: "processing" }
  | { status: "review" }
  | { status: "persisted" };

type PersistImportResponse = {
  summary: SaveImportSessionResult;
  statement: CardStatementImportDTO;
};

const STAGE_COPY: Record<ImportStage, { label: string; description: string; variant: "neutral" | "success" | "warning" | "error" }> = {
  idle: { label: "Aguardando arquivo", description: "Envie um PDF para iniciar a extração.", variant: "neutral" },
  processing: { label: "Processando", description: "Preparando PDF e executando Gemini.", variant: "warning" },
  review: { label: "Revisão", description: "Analise e ajuste as transações detectadas.", variant: "success" },
  persisted: { label: "Enviado", description: "Transações prontas para persistência.", variant: "success" },
};

function PdfImportClient({ maxFileBytes }: PdfImportClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<CardImportSession | null>(null);
  const [flowState, setFlowState] = useState<ImportFlowState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [ignoreFirstPage, setIgnoreFirstPage] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isPersisting, setIsPersisting] = useState(false);
  const [lastPersistResult, setLastPersistResult] = useState<PersistImportResponse | null>(null);

  const stage = flowState.status;
  const isProcessing = stage === "processing" || isPending;
  const summary = useMemo(() => session?.meta ?? null, [session]);
  const maxFileSizeLabel = (maxFileBytes / 1024 / 1024).toFixed(1);

  const handleSelectFile = (selected: File | null) => {
    setFile(selected);
    setError(null);
    if (!selected) {
      setSession(null);
    }
    setFlowState({ status: "idle" });
  };

  const validateFile = () => {
    if (!file) {
      setError("Selecione um PDF antes de enviar.");
      return false;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Aceitamos apenas arquivos PDF.");
      return false;
    }
    if (file.size === 0) {
      setError("O arquivo selecionado está vazio.");
      return false;
    }
    if (file.size > maxFileBytes) {
      setError(`Arquivo maior que o limite de ${maxFileSizeLabel}MB.`);
      return false;
    }
    return true;
  };

  const handleUpload = () => {
    if (!validateFile()) {
      return;
    }

    setError(null);
    const previousStage = stage;
    const hadSession = Boolean(session);
    const currentFile = file!;
    setFlowState({ status: "processing" });
    startTransition(async () => {
      try {
        const base64 = await pdfFileToBase64(currentFile);
        const extraction = await extractTransactionsFromPDF({ 
          fileBase64: base64, 
          fileName: currentFile.name,
          fileSize: currentFile.size,
          ignoreFirstPage 
        });
        setSession(extraction);
        setFlowState({ status: "review" });
        toast.success("PDF analisado", {
          description: `Detectamos ${extraction.meta.totalPurchases} compras e ${extraction.meta.totalIssues} alertas.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao processar PDF.";
        setError(message);
        toast.error("Erro ao processar PDF", { description: message });
        setFlowState(hadSession ? { status: previousStage } : { status: "idle" });
      }
    });
  };

  const handleReset = () => {
    setFile(null);
    setSession(null);
    setError(null);
    setFlowState({ status: "idle" });
  };

  const handleRetry = () => {
    if (!file) {
      toast.warning("Selecione novamente o arquivo para reprocessar.");
      return;
    }
    handleUpload();
  };

  const persistSession = async (_session: CardImportSession, overrides: PurchaseOverrideMap) => {
    setIsPersisting(true);
    console.log("Persisting session", _session, overrides);
    try {
      const response = await fetch("/api/imports/card-statements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: _session,
          overrides,
          force: true,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = typeof payload?.error === "string" ? payload.error : "Falha ao salvar importação.";
        throw new Error(detail);
      }

      setLastPersistResult(payload as PersistImportResponse);
      setFlowState({ status: "persisted" });
      toast.success("Importação salva", {
        description: `Compras criadas: ${payload.summary.createdPurchases}, parcelas: ${payload.summary.createdInstallments}`,
      });
    } catch (persistError) {
      const description =
        persistError instanceof Error ? persistError.message : "Ocorreu um erro desconhecido ao salvar a importação.";
      toast.error("Erro ao enviar revisão", { description });
    } finally {
      setIsPersisting(false);
    }
  };

  const handleProceed = (_session: CardImportSession, overrides: PurchaseOverrideMap) => {
    void persistSession(_session, overrides);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <CardTitle>Upload do PDF</CardTitle>
            <CardDescription>Arquivos são analisados localmente e enviados ao Gemini apenas durante esta sessão.</CardDescription>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{file ? file.name : "Nenhum arquivo selecionado"}</p>
          </div>
          <div className="text-right">
            <Badge variant={STAGE_COPY[stage].variant}>{STAGE_COPY[stage].label}</Badge>
            <p className="text-xs text-slate-500">{STAGE_COPY[stage].description}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              type="file"
              accept="application/pdf"
              onChange={(event) => handleSelectFile(event.target.files?.[0] ?? null)}
              disabled={isProcessing}
            />
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ignoreFirstPage}
                  onChange={(event) => setIgnoreFirstPage(event.target.checked)}
                  className="h-4 w-4"
                  disabled={isProcessing}
                />
                Ignorar capa (primeira página)
              </label>
              {file ? <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span> : null}
            </div>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleUpload} disabled={!file || isProcessing}>
              {isProcessing ? "Processando..." : stage === "review" ? "Reprocessar PDF" : "Processar PDF"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleReset} disabled={isProcessing && !file}>
              Limpar
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Limite: {maxFileSizeLabel} MB · Ignorar primeira página está {ignoreFirstPage ? "ativado" : "desativado"}.
          </p>
        </CardContent>
      </Card>

      {session && summary ? (
        <ExtractionPreviewTable
          session={session}
          meta={summary}
          onDiscard={handleReset}
          onProceed={handleProceed}
          onRetry={handleRetry}
          stage={stage}
          maxFileSizeMb={Number(maxFileSizeLabel)}
          isPersisting={isPersisting}
          lastPersistResult={lastPersistResult}
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            O resultado da extração aparecerá aqui assim que o PDF for processado.
          </CardContent>
        </Card>
      )}

      {flowState.status === "persisted" && lastPersistResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Importação registrada</CardTitle>
            <CardDescription>
              Arquivo salvo como #{lastPersistResult.statement.id}. Consulte a API de importações para detalhes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Statistic label="Compras criadas" value={lastPersistResult.summary.createdPurchases} />
            <Statistic label="Parcelas criadas" value={lastPersistResult.summary.createdInstallments} />
            <Statistic label="Parcelas ignoradas" value={lastPersistResult.summary.skippedInstallments} />
            <Statistic label="Arquivo" value={lastPersistResult.statement.fileName} />
            <Statistic label="Hash" value={lastPersistResult.statement.fileHash.slice(0, 10)} />
            <Statistic
              label="Fatura"
              value={lastPersistResult.statement.statementMonth ?? "—"}
            />
            <Statistic label="Cartão" value={lastPersistResult.statement.cardIdentifier ?? "—"} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Statistic({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default PdfImportClient;
