# FamilyRoots AI — Security Audit & Privacy Hardening Report

**Audit Date:** November 25, 2026  
**Auditor:** Automated System & Architecture Review  
**Status:** Pre-Release Security Audit Complete  
**Disclaimer:** _This audit reviews technical controls, automated policies, and architecture. It does not constitute formal legal compliance certification or independent third-party penetration testing._

---

## Executive Summary

A comprehensive security and privacy hardening review was conducted across the FamilyRoots AI application stack (Supabase PostgreSQL migrations, Row Level Security, Edge Functions, React Native client, storage buckets, and background job queues). All critical security domains—cross-tenant isolation, role escalation, storage privacy, input sanitization, background job security, and personal data governance—have been verified with automated regression tests.

---

## Security Domains & Audit Findings

| Category                                        | Status       | Details                                                                                                                                                                        |
| ----------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Row Level Security (RLS)**                 | **VERIFIED** | Every public table (14 tables) enforces RLS. Anonymous users have 0 access to personal records.                                                                                |
| **2. Cross-Tree & Cross-Account Isolation**     | **VERIFIED** | Users cannot read, link, cite, or mutate records from trees they do not belong to. Multi-tenant composite keys enforce referential integrity.                                  |
| **3. Role-Based Access Control (RBAC)**         | **VERIFIED** | Enforces strict separation between `owner`, `editor`, and `viewer`. Viewers cannot write or upload; editors cannot escalate permissions or rename trees.                       |
| **4. Server-Side Authentication & AuthZ**       | **VERIFIED** | Edge functions verify JWT claims via `supabase.auth.getUser()`, validate worker secrets, and reject unauthorized callers.                                                      |
| **5. Storage Bucket Privacy**                   | **VERIFIED** | `family-media`, `family-archive`, and `family-books` buckets are private (`public = false`). Direct downloads use signed URLs (max 60s).                                       |
| **6. API Keys & Secrets**                       | **VERIFIED** | No service-role secrets are committed to client code. Edge workers consume keys strictly via server environment variables.                                                     |
| **7. External Input Validation**                | **VERIFIED** | Zod schemas validate client requests, parameters, and payloads. `sanitizeInput()` strips script and iframe injections.                                                         |
| **8. File Upload Security**                     | **VERIFIED** | File upload envelopes check MIME type, magic bytes (JPEG/PNG/PDF), file sizes (<= 10MB), and sanitize filenames.                                                               |
| **9. Rate Limiting**                            | **VERIFIED** | Database rate limiting (`check_rate_limit`) and client rate limiting protect against abuse on exports, search, and job claims.                                                 |
| **10. Background Job Security**                 | **VERIFIED** | Worker jobs use atomic leases (`claim_family_book`), optimistic revision concurrency, timeout handling (3-minute lease expiries), and clean rollback of uncommitted artifacts. |
| **11. Privacy & Redaction**                     | **VERIFIED** | Redacting logger (`PrivacyLogger`) strips emails, bearer tokens, and UUIDs from client logs and telemetry.                                                                     |
| **12. Data Subject Rights (Export & Deletion)** | **VERIFIED** | Full JSON export (`export_personal_data`) and cascaded account deletion (`delete_user_account`) with automated ownership transfer.                                             |

---

## Resolved Vulnerabilities & Hardening Measures

1. **Storage Path Traversal Protection**: Enforced strict tree UUID prefix validation on storage upload paths to prevent cross-tenant bucket pollution.
2. **AI Provenance Restrictions**: Prohibited AI-suggested parent-child connections from being recorded directly as `verified` without explicit editor confirmation.
3. **Draft Concurrency Locks**: Implemented optimistic revision checking (`p_revision`) on section edits and draft updates to eliminate race conditions.
4. **Push Notification Privacy**: Guaranteed that push notification payloads and previews contain zero sensitive family biographical information.
5. **Minor Protection Controls**: Added schema support for minor accounts (`is_minor`), parental consent verification (`parental_consent_verified`), and restricted discovery visibility.

---

## Outstanding Risks & Recommended Next Steps

1. **Third-Party Penetration Testing**: Prior to high-volume public launch, commission an independent external CREST-certified penetration test of API endpoints and edge functions.
2. **Formal Legal Privacy Review**: Have qualified legal counsel review the GDPR / COPPA framework against target operational jurisdictions.
3. **WAF & DDoS Mitigation**: Deploy Cloudflare / Supabase Enterprise WAF rules to rate-limit edge endpoints at the network perimeter.
