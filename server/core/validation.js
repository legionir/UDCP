import { z } from 'zod';

// Additional validation helpers
export const DeviceMetadataSchema = z.object({
  location: z.string().optional(),
  battery: z.number().min(0).max(100).optional(),
  rssi: z.number().optional()
});

export const CommandPayloadSchema = z.object({
  state: z.boolean().optional(),
  value: z.number().optional(),
  text: z.string().optional()
}).passthrough();
