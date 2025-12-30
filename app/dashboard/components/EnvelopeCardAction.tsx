"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListFilter } from "lucide-react";
import { EnvelopeTransactionsModal } from "./EnvelopeTransactionsModal";

interface EnvelopeCardActionProps {
  envelopeId: number;
  envelopeName: string;
  month: string;
}

export function EnvelopeCardAction({
  envelopeId,
  envelopeName,
  month,
}: EnvelopeCardActionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="h-8 w-8 rounded-full hover:bg-slate-100"
        title="Ver transações"
        aria-label={`Ver transações do envelope ${envelopeName}`}
      >
        <ListFilter className="h-4 w-4 text-slate-500" />
      </Button>

      <EnvelopeTransactionsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        envelopeId={envelopeId}
        envelopeName={envelopeName}
        month={month}
      />
    </>
  );
}
