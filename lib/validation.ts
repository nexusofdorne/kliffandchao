import { z } from 'zod';

export const gateRequestSchema = z.object({
  password: z.string().min(1),
});

export type GateRequest = z.infer<typeof gateRequestSchema>;

export const MESSAGE_MAX_LENGTH = 500;

export const rsvpResponseSchema = z.object({
  guestId: z.string().min(1),
  status: z.enum(['ATTENDING', 'NOT_ATTENDING']),
});

export const rsvpRequestSchema = z.object({
  submittedByGuestId: z.string().min(1),
  responses: z.array(rsvpResponseSchema).min(1),
  message: z.string().max(MESSAGE_MAX_LENGTH).optional(),
  clientSubmissionId: z.string().min(1),
});

export type RsvpRequest = z.infer<typeof rsvpRequestSchema>;
export type RsvpResponseInput = z.infer<typeof rsvpResponseSchema>;

// The Apps Script webhook's payload: the edited row(s) from the Guests
// tab, each keyed by column header — docs/BUILD_PLAN.md "Sheet -> DB".
export const syncRequestSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1),
});

export type SyncRequest = z.infer<typeof syncRequestSchema>;
