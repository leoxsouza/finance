import { z } from "zod";

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid date",
  });

export const recurringTransactionInputSchema = z.object({
  isRecurring: z.boolean().default(false),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const transactionWithRecurringSchema = z.object({
  date: dateStringSchema,
  description: z.string().min(1, "Description is required"),
  value: z.number().positive("Value must be positive"),
  type: z.enum(["IN", "OUT"]),
  envelopeId: z.number().int().positive().optional(),
  isRecurring: z.boolean().default(false),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).superRefine((payload, ctx) => {
  if (payload.type === "OUT" && !payload.envelopeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["envelopeId"],
      message: "Envelope is required for expenses",
    });
  }
});

export const transactionUpdateSchema = z
  .object({
    date: dateStringSchema.optional(),
    description: z.string().min(1, "Description is required").optional(),
    value: z.number().positive("Value must be positive").optional(),
    type: z.enum(["IN", "OUT"]).optional(),
    envelopeId: z.number().int().positive().nullable().optional(),
  })
  .superRefine((payload, ctx) => {
    // If updating type to OUT, envelopeId is required
    if (payload.type === "OUT" && (payload.envelopeId === undefined || payload.envelopeId === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["envelopeId"],
        message: "Envelope is required for expenses",
      });
    }
  })
  .refine((payload) => {
    // At least one field must be provided for update
    const fields = Object.keys(payload);
    return fields.length > 0;
  }, {
    message: "At least one field must be provided for update",
  });
