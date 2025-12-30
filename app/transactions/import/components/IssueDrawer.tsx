"use client";

import { Button } from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import type { NormalizationIssue } from "@/lib/types/card-import";

type IssueDrawerProps = {
  open: boolean;
  issues: NormalizationIssue[];
  onClose: () => void;
  onSelectIssue?: (issue: NormalizationIssue) => void;
};

function IssueDrawer({ open, issues, onClose, onSelectIssue }: IssueDrawerProps) {
  if (!open) {
    return null;
  }

  const grouped = groupIssues(issues);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Alertas</p>
            <h2 className="text-xl font-semibold text-slate-900">Normalização</h2>
            <p className="text-sm text-slate-500">{issues.length} alerta(s) encontrados.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {["purchases", "installments", "general"].map((section) => {
            const current = grouped[section as keyof typeof grouped];
            if (current.length === 0) {
              return null;
            }
            return (
              <section key={section} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
                </p>
                <div className="space-y-3">
                  {current.map(({ label, issues: groupedIssues }) => (
                    <div key={label} className="rounded-xl border border-slate-100 p-4">
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <ul className="mt-3 space-y-2">
                        {groupedIssues.map((issue, index) => (
                          <li key={`${issue.scope}-${issue.field}-${index}`} className="space-y-1 rounded-md border border-slate-100 p-3">
                            <div className="flex items-center justify-between">
                              <Badge variant={issue.severity === "error" ? "error" : "warning"}>
                                {issue.severity === "error" ? "Erro" : "Aviso"}
                              </Badge>
                              {onSelectIssue ? (
                                <Button variant="ghost" size="sm" onClick={() => onSelectIssue(issue)}>
                                  Ver transação
                                </Button>
                              ) : null}
                            </div>
                            <p className="text-sm text-slate-900">{issue.message}</p>
                            {issue.field ? <p className="text-xs uppercase tracking-wide text-slate-500">{issue.field}</p> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

const SECTION_LABELS = {
  purchases: "Compras",
  installments: "Parcelas",
  general: "Outros",
} as const;

export type GroupedIssues = {
  label: string;
  issues: NormalizationIssue[];
};

export function groupIssues(issues: NormalizationIssue[]): {
  purchases: GroupedIssues[];
  installments: GroupedIssues[];
  general: GroupedIssues[];
} {
  const purchases = new Map<string, NormalizationIssue[]>();
  const installments = new Map<string, NormalizationIssue[]>();
  const general: NormalizationIssue[] = [];

  issues.forEach((issue) => {
    if (issue.scope === "PURCHASE" && issue.cardPurchaseKey) {
      const existing = purchases.get(issue.cardPurchaseKey) ?? [];
      purchases.set(issue.cardPurchaseKey, [...existing, issue]);
      return;
    }
    if (issue.scope === "INSTALLMENT" && issue.cardPurchaseKey) {
      const label = `${issue.cardPurchaseKey}-#${issue.installmentNumber ?? "?"}`;
      const existing = installments.get(label) ?? [];
      installments.set(label, [...existing, issue]);
      return;
    }
    general.push(issue);
  });

  return {
    purchases: Array.from(purchases.entries()).map(([key, groupedIssues]) => ({
      label: `Compra ${key}`,
      issues: groupedIssues,
    })),
    installments: Array.from(installments.entries()).map(([key, groupedIssues]) => ({
      label: `Parcela ${key}`,
      issues: groupedIssues,
    })),
    general: general.length ? [{ label: "Geral", issues: general }] : [],
  };
}

export default IssueDrawer;
