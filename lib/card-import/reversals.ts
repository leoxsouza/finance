/**
 * Reversals are treated as independent transactions.
 * 
 * This module previously contained `linkReversalsAndAdjustKeys` which attempted
 * to link reversal transactions with their original purchases. Per the refactoring
 * tasks (01_pipeline_normalization.md, 02_persistencia_e_dedupl.md), this logic
 * has been removed. Reversals now enter the system as new, independent transactions
 * with `isReversal = true`.
 */
export {};
