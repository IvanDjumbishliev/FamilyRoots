# Privacy, Minors, and Data Governance Framework

_Notice: This document provides legal review guidance and operational architecture for FamilyRoots AI. Formal compliance determinations require independent legal counsel and accredited certification._

---

## 1. Privacy by Default & Data Architecture

FamilyRoots AI operates under strict **Privacy by Default** standards:

- **Private Workspaces**: All trees, people profiles, events, photographs, and generated books are private to the owning account and explicitly invited collaborators.
- **Living Relatives Protection**: Living individuals and those with unknown vital status have their biographical facts, private documents, and event notes redacted from shared views and book exports unless explicit owner consent is granted.
- **Separation of Verified Records vs Private Data**: Verified historical records and GEDCOM evidence maintain strict cryptographic integrity and source provenance, stored distinctly from editable narrative layers (e.g., book drafts).

---

## 2. GDPR and International Privacy Obligations

### Right of Access & Data Portability (GDPR Art. 15 & 20)

- Users can export a complete, machine-readable JSON archive of their profile, tree memberships, notifications, books, and preferences at any time via the Settings menu or the `export_personal_data()` database RPC.
- Exports are rate-limited (maximum 5 requests per hour) to prevent automated bulk exfiltration while ensuring user access.

### Right to Erasure / "Right to Be Forgotten" (GDPR Art. 17)

- Account deletion (`delete_user_account()`) follows a verified ownership and retention protocol:
  1. **Multi-Member Trees**: If the deleting user owns a family tree with other contributors, ownership is automatically transitioned to the next active editor or member to protect shared heritage continuity.
  2. **Sole-Member Trees**: If no other members exist, the tree and all linked data (profiles, events, archive items, citations) are permanently deleted via database cascade.
  3. **Personal Data**: The user's personal notifications, preferences, drafts, and profile records are erased immediately.

### Data Minimization & Storage Buckets (GDPR Art. 5)

- All Supabase storage buckets (`family-media`, `family-archive`, `family-books`) have `public = false`.
- Direct storage object downloads require authenticated, tree-membership-verified signed URLs with short 60-second expiration windows.

---

## 3. Minors' Accounts and Child Data Protection

In compliance with the Children's Online Privacy Protection Act (COPPA), GDPR Article 8, and age-appropriate design standards:

1. **Age Thresholds**:
   - Users under 13 (or under 16 in applicable EU jurisdictions) are classified as minors (`is_minor = true`).
2. **Parental Consent Requirement**:
   - Accounts for minors require verified parental or legal guardian consent (`parental_consent_verified = true`) before enabling collaboration, invitations, or book publishing.
3. **Restricted Features for Minors**:
   - Minors cannot make trees or media publicly accessible.
   - Profile information for minors is automatically excluded from search indexing and external discovery matching.
   - Direct messaging and open invitation links are restricted to verified family circles.
4. **Data Subject Rights for Children**:
   - Parents and legal guardians retain the right to review, export, and request the deletion of all data associated with a minor's profile or account.

---

## 4. Transparent AI & Genealogy Processing Disclosures

- **No Generative AI Model Training**: Family tree data, uploaded family documents, and private memories are never used to train or fine-tune public foundation models.
- **Source-Grounded Genealogy Assistant**: The Genealogy Assistant Edge Worker passes private evidence exclusively as untrusted context; it does not hallucinate citations and enforces provenance flags (`provenance = 'ai_suggested'` vs `'contributor_asserted'`).
- **Clear Distinctions**: Automated narrative assembly in family history books is composed from verified database facts without generative AI fabrications.

---

## 5. Database Backup, Restoration, and Disaster Recovery

### Automated Backups

- **Daily Snapshots**: Automated daily physical and logical backups configured via Supabase infrastructure.
- **Point-in-Time Recovery (PITR)**: Write-Ahead Logs (WAL) archived continuously to enable granular restoration to any second within a 7-day retention window.

### Restoration Procedure

1. **Verification**: In the event of catastrophic data corruption, initiate restoration into an isolated staging instance.
2. **Integrity Check**: Run automated pgTAP test suites (`supabase/tests/*.sql`) to confirm RLS policies, foreign key integrity, and trigger functions.
3. **Failover**: Update application connection strings (`EXPO_PUBLIC_SUPABASE_URL`) to point to the restored production cluster.
