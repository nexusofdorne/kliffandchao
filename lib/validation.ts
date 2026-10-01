import { z } from 'zod';

export const gateRequestSchema = z.object({
  password: z.string().min(1),
});

export type GateRequest = z.infer<typeof gateRequestSchema>;
