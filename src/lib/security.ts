/**
 * Security and Privacy Hardening utilities for FamilyRoots AI.
 * Handles input sanitization, rate limiting, and privacy-safe structured logging.
 */

/**
 * Sanitizes generic user input text by stripping dangerous HTML tags and script injections.
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Validates that an external URL is safe (HTTP/HTTPS only, no data: or javascript: URIs).
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Redacts personal identifiers, email addresses, and tokens from error messages and log outputs.
 */
export function redactSensitiveData(message: string): string {
  if (!message) return '';
  return (
    message
      // Redact email addresses
      .replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        '[REDACTED_EMAIL]',
      )
      // Redact Bearer tokens and JWTs
      .replace(
        /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi,
        'Bearer [REDACTED_TOKEN]',
      )
      // Redact UUIDs if they appear in URL paths or query strings
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '[ID]',
      )
  );
}

/**
 * Client-side in-memory rate limiter for UI actions (e.g. rapid export or search spamming).
 */
export class ClientRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  canProceed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  remainingTime(): number {
    if (this.timestamps.length < this.maxRequests) return 0;
    const oldest = this.timestamps[0];
    return Math.max(0, this.windowMs - (Date.now() - oldest));
  }
}

/**
 * Structured privacy-safe monitoring logger. Never logs PII.
 */
export const PrivacyLogger = {
  info(
    event: string,
    meta: Record<string, unknown> = {},
  ): { event: string; timestamp: string } & Record<string, unknown> {
    const safeMeta: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (typeof value === 'string') {
        safeMeta[key] = redactSensitiveData(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        safeMeta[key] = value;
      }
    }
    return { event, ...safeMeta, timestamp: new Date().toISOString() };
  },

  error(event: string, error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const safeMsg = redactSensitiveData(errorMsg);
    return {
      event,
      error: safeMsg,
      timestamp: new Date().toISOString(),
    };
  },
};
