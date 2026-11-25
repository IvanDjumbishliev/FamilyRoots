import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ClientRateLimiter,
  isSafeUrl,
  PrivacyLogger,
  redactSensitiveData,
  sanitizeInput,
} from './security';

test('sanitizeInput strips script, iframe, style, and inline event handlers', () => {
  const dirty =
    'Hello <script>alert("hack")</script><b>World</b> <iframe src="evil.com"></iframe><img src=x onerror="alert(1)">';
  const clean = sanitizeInput(dirty);
  assert.doesNotMatch(clean, /<script>/i);
  assert.doesNotMatch(clean, /<iframe>/i);
  assert.doesNotMatch(clean, /onerror=/i);
  assert.match(clean, /Hello <b>World<\/b>/);
});

test('isSafeUrl allows valid http and https URLs and rejects unsafe protocols', () => {
  assert.equal(isSafeUrl('https://example.com/record'), true);
  assert.equal(isSafeUrl('http://archive.org/photo.jpg'), true);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(isSafeUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeUrl('file:///etc/passwd'), false);
  assert.equal(isSafeUrl(''), false);
});

test('redactSensitiveData masks emails, bearer tokens, and UUIDs', () => {
  const message =
    'User john.doe@example.com failed with Bearer eyJhbGciOiJIUzI1Ni.abc.xyz at /people/12345678-1234-1234-1234-123456789abc';
  const redacted = redactSensitiveData(message);
  assert.doesNotMatch(redacted, /john\.doe@example\.com/);
  assert.match(redacted, /\[REDACTED_EMAIL\]/);
  assert.match(redacted, /Bearer \[REDACTED_TOKEN\]/);
  assert.match(redacted, /\[ID\]/);
});

test('ClientRateLimiter enforces request thresholds within window', () => {
  const limiter = new ClientRateLimiter(2, 1000);
  assert.equal(limiter.canProceed(), true);
  assert.equal(limiter.canProceed(), true);
  assert.equal(limiter.canProceed(), false);
  assert.ok(limiter.remainingTime() > 0);
});

test('PrivacyLogger logs structured events without exposing PII', () => {
  const log = PrivacyLogger.info('user_action', {
    email: 'secret@domain.com',
    action: 'save_draft',
  });
  assert.equal(log.event, 'user_action');
  assert.equal(log.email, '[REDACTED_EMAIL]');
  assert.equal(log.action, 'save_draft');
});
