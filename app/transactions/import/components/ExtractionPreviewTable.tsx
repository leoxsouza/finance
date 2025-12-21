import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ExtractedTransactionCandidate, ExtractionValidationResult } from "@/lib/ai/types";

type ExtractionPreviewTableProps = {
  result: ExtractionValidationResult;
  summary: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    netAmount: number;
  } | null;
  onDiscard: () => void;
  onProceed?: (rows: ExtractedTransactionCandidate[]) => void;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function ExtractionPreviewTable({ result, summary, onDiscard, onProceed }: ExtractionPreviewTableProps) {
  const validRows = result.valid;
  const invalidRows = result.invalid;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Prévia das transações</CardTitle>
          <CardDescription>
            Revise as transações detectadas pela IA. Você poderá editar e salvar em etapas seguintes.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={onDiscard}>
            Descartar
          </Button>
          <Button type="button" disabled={validRows.length === 0} onClick={() => onProceed?.(validRows)}>
            Enviar para revisão
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {summary ? (
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <Statistic label="Total" value={summary.totalRecords} accent />
            <Statistic label="Válidas" value={summary.validRecords} accent />
            <Statistic label="Com alerta" value={summary.invalidRecords} />
            <Statistic label="Saldo líquido" value={currency.format(summary.netAmount)} accent />
          </div>
        ) : null}

        {validRows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validRows.map((transaction, index) => (
                  <TableRow key={`${transaction.description}-${index}`}>
                    <TableCell>{transaction.date}</TableCell>
                    <TableCell className="font-medium text-slate-800">{transaction.description}</TableCell>
                    <TableCell className="text-right">
                      {currency.format(transaction.amount * (transaction.type === "OUT" ? -1 : 1))}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          transaction.type === "OUT" ? "text-rose-600 font-semibold" : "text-emerald-600 font-semibold"
                        }
                      >
                        {transaction.type === "OUT" ? "Despesa" : "Receita"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma transação válida encontrada neste PDF.</p>
        )}

        {invalidRows.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {invalidRows.length} linha(s) precisam de atenção antes de continuar:
            </p>
            <ul className="space-y-1 text-sm text-amber-900">
              {invalidRows.map((issue, index) => (
                <li key={`${issue.index}-${issue.field}-${index}`}>
                  Linha {issue.index + 1}: <strong>{issue.field}</strong> — {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
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
