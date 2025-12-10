export type EnvelopeOption = {
  id: number;
  name: string;
};

export type TransactionRow = {
  id: number;
  date: string; // ISO
  description: string;
  value: number;
  type: "IN" | "OUT";
  envelopeId: number | null;
  envelopeName?: string | null;
};
