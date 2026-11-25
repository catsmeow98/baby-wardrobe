import { z } from 'zod';

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optUuid = z.preprocess(blank, z.string().uuid().optional());

export const CONDITION_VALUES = ['new', 'like_new', 'good', 'worn', 'unusable'] as const;
export const SEASON_VALUES = ['year_round', 'spring', 'summer', 'fall', 'winter'] as const;
export const STATUS_VALUES = ['active', 'stored', 'daycare', 'outgrown', 'donated', 'sold'] as const;

export const itemSchema = z.object({
  name: z.string().trim().max(160, 'Use 160 characters or fewer for the name.').default(''),
  categoryId: z.string().uuid('Choose a category.'),
  brand: z.string().trim().max(80, 'Use 80 characters or fewer for the brand.').default(''),
  quantity: z.coerce.number().int('Quantity must be a whole number.').min(1, 'Quantity must be at least 1.').max(999),
  tagId: optUuid,
  customTag: z.preprocess(blank, z.string().trim().max(20, 'The tag range is too long.').optional()),
  fitFromId: optUuid,
  fitToId: optUuid,
  condition: z.enum(CONDITION_VALUES).default('good'),
  season: z.enum(SEASON_VALUES).default('year_round'),
  status: z.enum(STATUS_VALUES).default('active'),
  fitOverride: z.preprocess(blank, z.enum(['fits', 'notyet', 'small', 'outgrown']).optional()),
  fitFeedback: z.preprocess(blank, z.coerce.number().int().min(-1).max(1).optional()),
  notes: z.string().trim().max(1000, 'Use 1000 characters or fewer for notes.').default(''),
});
export type ItemInput = z.infer<typeof itemSchema>;
