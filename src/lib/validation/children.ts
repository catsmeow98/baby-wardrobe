import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/** Birth date and current size are optional. Birth date is only needed for forecasts, so we do not insist on it. */
export const childSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(80, 'Use 80 characters or fewer.'),
  birthDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')
      .refine((v) => !Number.isNaN(Date.parse(v)) && Date.parse(`${v}T00:00:00Z`) <= Date.now(), 'Birth date cannot be in the future.')
      .optional(),
  ),
  currentSizeId: z.preprocess(emptyToUndefined, z.string().uuid('Choose a size from the list.').optional()),
});

export type ChildInput = z.infer<typeof childSchema>;
