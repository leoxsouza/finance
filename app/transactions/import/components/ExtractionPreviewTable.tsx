"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";

import Badge from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Input from "@/components/ui/input";
import Select from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatCurrency } from "@/lib/format";
import type { CardImportSession, CardImportSessionMeta, NormalizationIssue } from "@/lib/types/card-import";
import type { SaveImportSessionResult } from "@/lib/card-import/persistence";
import { cn } from "@/lib/utils";

import IssueDrawer from "./IssueDrawer";

type ReviewStage = "idle" | "processing" | "review" | "persisted";

type ReviewTab = "summary" | "purchases" | "installments" | "issues" | "ignored";

export type PurchaseOverride = {
  purchaseDate?: string;
  auvpCategory?: string;
  totalAmount?: number;
  installmentCount?: number;
};

export type PurchaseOverrideMap = Record<string, PurchaseOverride>;

type ExtractionPreviewTableProps = {
  session: CardImportSession;
  meta: CardImportSessionMeta;
  stage: ReviewStage;
  onDiscard: () => void;
  onRetry?: () => void;
  onProceed?: (session: CardImportSession, overrides: PurchaseOverrideMap) => void;
  maxFileSizeMb: number;
  isPersisting?: boolean;
  lastPersistResult?: { summary: SaveImportSessionResult; statement: Record<string, unknown> } | null;
};

const STAGE_BADGE: Record<ReviewStage, { label: string; description: string; variant: "neutral" | "success" | "warning" | "error" }> = {
  idle: { label: "Aguardando arquivo", description: "Envie um PDF para iniciar a extração.", variant: "neutral" },
  processing: { label: "Processando", description: "Preparando PDF e executando Gemini.", variant: "warning" },
  review: { label: "Revisão", description: "Analise e ajuste as transações detectadas.", variant: "success" },
  persisted: { label: "Enviado", description: "Transações prontas para persistência.", variant: "success" },
};

const AUVP_OPTIONS = [
  { label: "Selecione uma categoria", value: "" },
  { label: "Custos fixos", value: "Custos fixos" },
  { label: "Conforto", value: "Conforto" },
  { label: "Prazeres", value: "Prazeres" },
  { label: "Metas", value: "Metas" },
  { label: "Liberdade Financeira", value: "Liberdade Financeira" },
  { label: "Conhecimento", value: "Conhecimento" },
] as const;

function ExtractionPreviewTable({
  session,
  meta,
  stage,
  onDiscard,
  onRetry,
  onProceed,
  maxFileSizeMb,
  isPersisting = false,
  lastPersistResult,
}: ExtractionPreviewTableProps) {
  const [activeTab, setActiveTab] = useState<ReviewTab>("summary");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overrides, setOverrides] = useState<PurchaseOverrideMap>({});
  const [highlightedPurchase, setHighlightedPurchase] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const purchases = session.purchases;
  const installments = session.installments;
  const issues = session.issues;
  const fileLimitLabel = `${maxFileSizeMb.toFixed(1)} MB`;

  const purchaseByKey = useMemo(() => {
    return new Map(session.purchases.map((purchase) => [purchase.cardPurchaseKey, purchase]));
  }, [session.purchases]);

  const resolvedPurchases = useMemo(
    () =>
      purchases.map((purchase) => {
        const override = overrides[purchase.cardPurchaseKey];
        return {
          ...purchase,
          displayDate: override?.purchaseDate ?? purchase.purchaseDate,
          displayCategory: override?.auvpCategory ?? purchase.auvpCategory ?? "",
          displayTotal: override?.totalAmount ?? purchase.totalAmount,
          displayInstallmentCount: override?.installmentCount ?? purchase.metadata?.installmentCount ?? undefined,
        };
      }),
    [purchases, overrides],
  );

  const totals = useMemo(() => {
    const netAmount = resolvedPurchases.reduce(
      (sum, purchase) => sum + (purchase.isReversal ? -purchase.displayTotal : purchase.displayTotal),
      0,
    );
    const reversalCount = resolvedPurchases.filter((purchase) => purchase.isReversal).length;
    const installmentSum = installments.reduce(
      (sum, installment) => sum + installment.installmentAmount,
      0,
    );
    // Total invoice amount: installment amounts + non-installment purchases
    const nonInstallmentPurchases = resolvedPurchases.filter(
      (purchase) => !purchase.isReversal && (!purchase.displayInstallmentCount || purchase.displayInstallmentCount === 1)
    );
    const totalInvoiceAmount = installmentSum + nonInstallmentPurchases.reduce(
      (sum, purchase) => sum + purchase.displayTotal,
      0,
    );
    return { netAmount, reversalCount, installmentSum, totalInvoiceAmount };
  }, [resolvedPurchases, installments]);

  const issuesByPurchase = useMemo(() => {
    const map = new Map<string, NormalizationIssue[]>();
    issues.forEach((issue) => {
      if (issue.cardPurchaseKey) {
        const list = map.get(issue.cardPurchaseKey) ?? [];
        list.push(issue);
        map.set(issue.cardPurchaseKey, list);
      }
    });
    return map;
  }, [issues]);

  const stageInfo = STAGE_BADGE[stage];
  const statementLabel = meta.statementMonth ? `Fatura ${meta.statementMonth}` : "Fatura não informada";
  const disableProceed = stage !== "review" || resolvedPurchases.length === 0;

  const handleOverrideChange = <Key extends keyof PurchaseOverride>(cardPurchaseKey: string, field: Key, value: PurchaseOverride[Key]) => {
    setOverrides((current) => {
      const existing = current[cardPurchaseKey] ?? {};
      const next = { ...existing, [field]: value };
      const hasValues = Object.values(next).some((entry) => entry !== undefined && entry !== null && entry !== "");
      if (!hasValues) {
        const clone = { ...current };
        delete clone[cardPurchaseKey];
        return clone;
      }
      return {
        ...current,
        [cardPurchaseKey]: next,
      };
    });
  };

  useEffect(() => {
    setOverrides({});
    setHighlightedPurchase(null);
    setActiveTab("summary");
  }, [session.sessionId]);

  useEffect(() => {
    if (stage !== "review") {
      setActiveTab("summary");
    }
  }, [stage]);

  const handleDownloadJson = () => {
    const payload = { session, overrides };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `card-import-session-${session.sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleProceedReview = () => {
    onProceed?.(session, overrides);
  };

  const handleSelectIssue = (issue: NormalizationIssue) => {
    if (issue.cardPurchaseKey) {
      setHighlightedPurchase(issue.cardPurchaseKey);
      rowRefs.current[issue.cardPurchaseKey]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveTab("purchases");
    }
  };

  return (
    <Card className="relative">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Fluxo de revisão</p>
            <CardTitle>Resultados da importação</CardTitle>
            <CardDescription>Analise o que o Gemini normalizou antes de salvar no sistema.</CardDescription>
          </div>
          <div className="text-right">
            <Badge variant={stageInfo.variant}>{stageInfo.label}</Badge>
            <p className="text-xs text-slate-500">{stageInfo.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" className="gap-2" onClick={handleDownloadJson}>
            <Download className="h-4 w-4" />
            Download JSON
          </Button>
          <Button type="button" variant="secondary" className="gap-2" onClick={() => setDrawerOpen(true)}>
            <AlertTriangle className="h-4 w-4" />
            Alertas ({issues.length})
          </Button>
          {onRetry ? (
            <Button type="button" variant="secondary" className="gap-2" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              Reprocessar PDF
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-2 lg:grid-cols-5">
          <Statistic label="Compras" value={meta.totalPurchases} accent />
          <Statistic label="Parcelas mapeadas" value={meta.totalInstallments} />
          <Statistic label="Alertas" value={meta.totalIssues} accent={meta.totalIssues > 0} />
          <Statistic label="Valor líquido" value={formatCurrency(totals.netAmount)} accent />
          <Statistic label="Valor da fatura" value={formatCurrency(totals.totalInvoiceAmount)} accent={totals.totalInvoiceAmount !== totals.netAmount} />
          <Statistic label="Estornos" value={totals.reversalCount} />
          <Statistic label="Transações brutas" value={meta.rawTransactions ?? "—"} />
          <Statistic label="Cartão" value={meta.cardIdentifier ?? "—"} />
          <Statistic label="Geração" value={new Date(meta.generatedAt).toLocaleString("pt-BR")} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="summary" value={activeTab} onValueChange={(value) => setActiveTab(value as ReviewTab)}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <TabsList>
              <TabsTrigger value="summary">Resumo</TabsTrigger>
              <TabsTrigger value="purchases">Compras</TabsTrigger>
              <TabsTrigger value="installments">Parcelas</TabsTrigger>
              <TabsTrigger value="issues">Alertas</TabsTrigger>
              <TabsTrigger value="ignored">Ignorados</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="ghost" onClick={onDiscard}>
                Descartar sessão
              </Button>
              <Button type="button" onClick={handleProceedReview} disabled={disableProceed || isPersisting}>
                {isPersisting ? "Enviando..." : "Enviar para revisão"}
              </Button>
            </div>
          </div>
          <TabsContent value="summary" className="space-y-4 pt-4">
            <div className="rounded-2xl border border-slate-100 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{statementLabel}</p>
              <p className="text-base text-slate-600">Total de {meta.totalPurchases} compras e {meta.totalInstallments} parcelas detectadas.</p>
              <p className="text-base text-slate-600">
                Arquivo analisado com {meta.pdfBytes ? `${(meta.pdfBytes / 1024 / 1024).toFixed(2)}MB` : "tamanho desconhecido"} e {meta.rawTransactions ?? "—"} registros brutos.
              </p>
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-100 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Lista de checagem</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Limite de arquivo atual: {fileLimitLabel}. PDF enviado tinha {meta.pdfBytes ? `${(meta.pdfBytes / 1024 / 1024).toFixed(2)} MB` : "tamanho desconhecido"}.</li>
                <li>A opção &quot;Ignorar primeira página&quot; pode ser alternada antes do upload para remover capas ou propagandas.</li>
                <li>O botão &quot;Reprocessar PDF&quot; roda o pipeline novamente sem recarregar a página.</li>
              </ul>
            </div>
          </TabsContent>
          <TabsContent value="purchases" className="pt-4">
            {resolvedPurchases.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Nenhuma compra detectada neste PDF.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria AUVP</TableHead>
                    <TableHead className="text-right">Valor total</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-center">Alertas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolvedPurchases.map((purchase) => {
                    const issueList = issuesByPurchase.get(purchase.cardPurchaseKey) ?? [];
                    const badgeVariant = issueList.some((issue) => issue.severity === "error") ? "error" : "warning";
                    return (
                      <TableRow
                        key={purchase.cardPurchaseKey}
                        ref={(node) => {
                          rowRefs.current[purchase.cardPurchaseKey] = node;
                        }}
                        className={cn(highlightedPurchase === purchase.cardPurchaseKey ? "ring-1 ring-emerald-400" : undefined)}
                      >
                        <TableCell className="max-w-[140px]">
                          <Input
                            type="date"
                            value={purchase.displayDate}
                            onChange={(event) => handleOverrideChange(purchase.cardPurchaseKey, "purchaseDate", event.target.value || undefined)}
                          />
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-slate-900">{purchase.description}</p>
                          <p className="text-xs text-slate-500">
                            Cartão •••• {purchase.cardIdentifier ?? meta.cardIdentifier ?? "—"} · {purchase.statementMonth ?? meta.statementMonth ?? "mês?"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Select
                            options={AUVP_OPTIONS as unknown as { label: string; value: string | number }[]}
                            value={purchase.displayCategory}
                            onChange={(event) => handleOverrideChange(purchase.cardPurchaseKey, "auvpCategory", event.target.value || undefined)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={purchase.displayTotal.toFixed(2)}
                            onChange={(event) =>
                              handleOverrideChange(purchase.cardPurchaseKey, "totalAmount", event.target.value ? Number(event.target.value) : undefined)
                            }
                          />
                          {purchase.isReversal ? <p className="text-xs text-rose-600">Estorno</p> : null}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={1}
                            value={purchase.displayInstallmentCount ? purchase.displayInstallmentCount.toString() : ""}
                            onChange={(event) =>
                              handleOverrideChange(
                                purchase.cardPurchaseKey,
                                "installmentCount",
                                event.target.value ? Number(event.target.value) : undefined,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {issueList.length > 0 ? (
                            <Badge variant={badgeVariant as "warning" | "error"}>
                              {issueList.length} alerta(s)
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">OK</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="installments" className="pt-4">
            {installments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Nenhuma parcela detectada.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Compra</TableHead>
                    <TableHead className="text-right">Valor parcela</TableHead>
                    <TableHead className="text-right">Valor total</TableHead>
                    <TableHead className="text-center">Statement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map((installment) => {
                    const purchase = purchaseByKey.get(installment.cardPurchaseKey);
                    const purchaseTotal = purchase?.totalAmount ?? null;
                    const installmentStatementMonth = installment.statementMonth ?? purchase?.statementMonth ?? null;

                    return (
                      <TableRow key={`${installment.cardPurchaseKey}-${installment.installmentNumber}`}>
                        <TableCell>
                          {installment.installmentNumber}/{installment.installmentCount ?? "?"}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">{installment.cardPurchaseKey}</TableCell>
                        <TableCell className="text-right">{formatCurrency(installment.installmentAmount)}</TableCell>
                        <TableCell className="text-right">{purchaseTotal ? formatCurrency(purchaseTotal) : "—"}</TableCell>
                        <TableCell className="text-center">{installmentStatementMonth ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="issues" className="pt-4">
            {issues.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-emerald-600">Nenhum alerta pendente.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="text-center">Severidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue, index) => (
                    <TableRow key={`${issue.scope}-${issue.field}-${index}`}>
                      <TableCell>{issue.scope}</TableCell>
                      <TableCell>{issue.field ?? "Geral"}</TableCell>
                      <TableCell>{issue.message}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={issue.severity === "error" ? "error" : "warning"}>{issue.severity}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="ignored" className="pt-4">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm text-slate-600">
                  Parcelas duplicadas dentro da mesma sessão de importação são ignoradas.
                  Todas as compras e parcelas são salvas como novos registros.
                </p>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Parcelas Ignoradas</h4>
                  {lastPersistResult?.summary.ignoredInstallments && lastPersistResult.summary.ignoredInstallments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Compra</TableHead>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lastPersistResult.summary.ignoredInstallments.map((installment, index) => (
                          <TableRow key={`${installment.cardPurchaseKey}-${installment.installmentNumber}-${index}`}>
                            <TableCell className="font-medium">{installment.rawLine || installment.cardPurchaseKey}</TableCell>
                            <TableCell>
                              {installment.installmentNumber}/{installment.installmentCount ?? '?'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="warning">Duplicado na sessão</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma parcela ignorada.</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <IssueDrawer open={drawerOpen} issues={issues} onClose={() => setDrawerOpen(false)} onSelectIssue={handleSelectIssue} />
    </Card>
  );
}

function Statistic({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-base font-semibold ${accent ? "text-slate-900" : "text-slate-600"}`}>{value}</p>
    </div>
  );
}

export default ExtractionPreviewTable;
