import { z } from 'zod';

export const emailSchema = z.email('Enter a valid email address.');
export const codeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Enter the six-digit code.');
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .refine(
    (value) =>
      Array.from(value).reduce((bytes, character) => {
        const point = character.codePointAt(0) ?? 0;
        return (
          bytes +
          (point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4)
        );
      }, 0) <= 72,
    'Use no more than 72 bytes.',
  );
