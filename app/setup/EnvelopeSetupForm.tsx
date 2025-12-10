"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PERCENT_SCALE = 100;

export type EditableEnvelope = {
  id: number;
  name: string;
  percentage: number; // 0-1
};

type EnvelopeSetupFormProps = {
  initialEnvelopes: EditableEnvelope[];
};

type EnvelopeState = {
  clientId: string;
  id?: number;
  name: string;
  percentage: number; // 0-100 for UI
  isNew?: boolean;
};

const generateClientId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `env-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createEmptyEnvelope = (): EnvelopeState => ({
  clientId: generateClientId(),
  name: "",
  percentage: 0,
  isNew: true,
});

function normalize(envelopes: EditableEnvelope[]): EnvelopeState[] {
  return envelopes.map((envelope) => ({
    clientId: `existing-${envelope.id}`,
    id: envelope.id,
    name: envelope.name,
    percentage: Number((envelope.percentage * PERCENT_SCALE).toFixed(2)),
    isNew: false,
  }));
}

function EnvelopeSetupForm({ initialEnvelopes }: EnvelopeSetupFormProps) {
  const router = useRouter();
  const [envelopes, setEnvelopes] = useState<EnvelopeState[]>(() => normalize(initialEnvelopes));
  const [removedEnvelopeIds, setRemovedEnvelopeIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalPercentage = useMemo(
    () => envelopes.reduce((sum, envelope) => sum + envelope.percentage, 0),
    [envelopes],
  );

  const isBalanced = Math.abs(totalPercentage - PERCENT_SCALE) < 0.01;
  const hasEmptyName = envelopes.some((envelope) => envelope.name.trim().length === 0);
  const disableSave = envelopes.length === 0 || !isBalanced || hasEmptyName || isPending;

  const handleNameChange = (clientId: string, value: string) => {
    setEnvelopes((prev) =>
      prev.map((env) => (env.clientId === clientId ? { ...env, name: value } : env)),
    );
  };

  const handlePercentageChange = (clientId: string, value: number) => {
    if (Number.isNaN(value)) {
      return;
    }
    setEnvelopes((prev) =>
      prev.map((env) =>
        env.clientId === clientId
          ? { ...env, percentage: Number(Math.max(0, Math.min(100, value)).toFixed(2)) }
          : env,
      ),
    );
  };

  const handleAddEnvelope = () => {
    setEnvelopes((prev) => [...prev, createEmptyEnvelope()]);
  };

  const handleRemoveEnvelope = (envelope: EnvelopeState) => {
    setEnvelopes((prev) => prev.filter((env) => env.clientId !== envelope.clientId));
    if (envelope.id) {
      setRemovedEnvelopeIds((prev) => Array.from(new Set([...prev, envelope.id!])));
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const toCreate = envelopes.filter((envelope) => envelope.isNew);
    const toUpdate = envelopes.filter((envelope) => envelope.id && !envelope.isNew) as Required<
      Pick<EnvelopeState, "id" | "name" | "percentage">
    >[];

    startTransition(async () => {
      try {
        const responses = await Promise.all([
          ...removedEnvelopeIds.map((id) =>
            fetch(`/api/envelopes?id=${id}`, { method: "DELETE" }),
          ),
          ...toUpdate.map((envelope) =>
            fetch("/api/envelopes", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                id: envelope.id,
                name: envelope.name.trim(),
                percentage: envelope.percentage / PERCENT_SCALE,
              }),
            }),
          ),
          ...toCreate.map((envelope) =>
            fetch("/api/envelopes", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: envelope.name.trim(),
                percentage: envelope.percentage / PERCENT_SCALE,
              }),
            }),
          ),
        ]);

        const failed = responses.find((response) => !response.ok);
        if (failed) {
          const payload = await failed.json().catch(() => ({}));
          throw new Error(payload.error ?? "Failed to save envelopes");
        }

        setRemovedEnvelopeIds([]);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unexpected error");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-slate-600">
          <p>
            Total allocation:{" "}
            <strong className={isBalanced ? "text-emerald-600" : "text-rose-600"}>
              {totalPercentage.toFixed(2)}%
            </strong>
          </p>
          {!isBalanced && (
            <p className="text-xs text-rose-600">Percentages must add up to 100% before saving.</p>
          )}
        </div>
        <Button type="button" variant="secondary" onClick={handleAddEnvelope}>
          Add envelope
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-48">Percentage (%)</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {envelopes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-center text-sm text-slate-500">
                No envelopes yet. Use “Add envelope” to create your first category.
              </TableCell>
            </TableRow>
          ) : (
            envelopes.map((envelope) => (
              <TableRow key={envelope.clientId}>
                <TableCell>
                  <Input
                    value={envelope.name}
                    onChange={(event) => handleNameChange(envelope.clientId, event.target.value)}
                    placeholder="Envelope name"
                    required
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.1}
                    value={envelope.percentage}
                    onChange={(event) =>
                      handlePercentageChange(envelope.clientId, Number(event.target.value))
                    }
                    required
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveEnvelope(envelope)}
                    aria-label={`Remove ${envelope.name || "envelope"}`}
                  >
                    <span aria-hidden>×</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Button type="submit" disabled={disableSave}>
        {isPending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}

export default EnvelopeSetupForm;
