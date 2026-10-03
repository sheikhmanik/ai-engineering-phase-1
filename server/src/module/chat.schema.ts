import { z } from "zod";

export const chatRequestSchema = z.object({
  conversationId: z.number().int().positive().optional(),

  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(10_000, "Message is too long"),
});