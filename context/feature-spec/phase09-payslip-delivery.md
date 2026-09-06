# Phase 9 - Payslip Email Delivery

## Metadata

- **Status:** APPROVED FOR IMPLEMENTATION
- **Target branch:** `feature/phase09-payslip-delivery`
- **Assumed baseline:** Phase 8 Payruns/Payslips is merged and verified
- **PRD coverage:** B8 bulk Payslip email delivery from Payrun; delivery history and errors
- **Depends on:** Validated/Paid Payslips, stored final PDF bytes/hash, Payroll RBAC, Nodemailer, Mailpit, and AuditLog
- **Blocks:** Final end-to-end employee-to-payslip demo completion
- **Implementation ownership:** Delivery migration, SMTP configuration/client, delivery service/API, Payrun/Payslip delivery UI, seeds, and tests

## 1. Goal

Implement the Payrun `Send Payslips` action. Authorized Payroll users must be
able to email each selected finalized Payslip PDF to the Employee email stored
in its immutable Payslip snapshot. Every delivery attempt and failure must be
persisted and visible, with explicit retry/resend behavior that avoids
accidental duplicate emails.

Sending does not change Payrun/Payslip financial status and never regenerates
or modifies the finalized PDF.

## 2. Source Priority

1. Attached PeoplePay360 PRD.
2. `context/architecture.md`, especially PDF/email and historical invariants.
3. `context/project-overview.md` workflow and role definitions.
4. This specification.
5. Phase 8 Payrun/Payslip contracts.
6. Existing design system.

## 3. Scope

### In scope

- SMTP environment validation and one Nodemailer transport factory.
- Mailpit delivery during local development.
- Persisted Payslip delivery attempts.
- Bulk Send from a Validated or Paid Payrun.
- Send-unsent, retry-failed, and confirmed resend-all modes.
- Per-Payslip recipient/PDF validation.
- Stored final PDF attachment only.
- Concurrency lease preventing simultaneous sends for one Payrun.
- Pending, Sent, Failed, and Unknown attempt states.
- Sanitized delivery errors and SMTP message identifiers.
- Payrun-level and Payslip-level delivery history APIs/UI.
- Explicit handling of ambiguous crash/interruption states.
- Audit events, minimal deterministic seed fixtures, unit/integration tests,
  and Mailpit manual verification.

### Out of scope

- Background queues, brokers, Redis, workers, cron jobs, or webhooks.
- Scheduled delivery.
- Employee-selected recipients or CC/BCC.
- Editable email templates or rich template administration.
- Email open/click tracking.
- Provider delivery/bounce webhooks.
- Regenerating PDFs during delivery.
- Sending Draft or Computed Payslips.
- Changing payroll status after sending.
- Employee self-service Payslip access.
- Payroll Dashboard/reporting implementation.
- Deleting delivery history.
- Refactoring the existing seed architecture or generating the final
  200-Employee mock dataset.

## 4. Locked Delivery Semantics

1. Only `VALIDATED` and `PAID` Payslips may be sent.
2. Email uses `Payslip.workEmailSnapshot`, not the Employee's current email.
3. Attachment uses `Payslip.finalPdf` exactly as stored at validation.
4. Before sending, recompute SHA-256 of stored bytes and require equality with
   `finalPdfSha256`.
5. Delivery never rereads current Employee, Contract, Salary Rule, or Time Off
   data and never regenerates the PDF.
6. Sending never changes Payrun/Payslip status, totals, Lines, Warnings, hashes,
   or validation/payment timestamps.
7. Each actual or blocked send attempt creates a persistent attempt row.
8. No successful delivery is retried implicitly.
9. Retry/resend mode is explicit:

   ```text
   SEND_UNSENT  -> Payslips with no previous attempt
   RETRY_FAILED -> Payslips whose latest attempt is FAILED
   RESEND_ALL   -> all finalized Payslips; requires confirmResend=true
   ```

10. `PENDING` or `UNKNOWN` attempts are excluded from automatic unsent/failed
    modes. They may be retried only through confirmed `RESEND_ALL` because the
    previous SMTP outcome may be ambiguous.
11. One Payrun may have only one active bulk-send operation. Use a database
    lease, not a process-local boolean.
12. SMTP and PostgreSQL cannot provide exactly-once atomic delivery. Persist an
    attempt as Pending before SMTP. A crash after SMTP accepts the message but
    before status update becomes Unknown and may require a confirmed resend.
13. A successful send means Nodemailer/SMTP accepted the message. It does not
    prove inbox delivery, opening, or absence of a later bounce.
14. A failure for one Payslip does not roll back successful sends for others.
    Bulk delivery is best-effort and returns a per-Payslip summary.
15. Limit SMTP concurrency to three messages per API request using an internal
    worker pool. Do not use unbounded `Promise.all`.
16. Maximum one bulk action handles 500 Payslips.
17. Attempts and delivery audit history are append-only.

## 5. Environment Configuration

Extend validated environment configuration and `.env.example`:

```text
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=PeoplePay360 Payroll
SMTP_FROM_ADDRESS=payroll@peoplepay360.local
SMTP_CONNECTION_TIMEOUT_MS=10000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=30000
PAYSLIP_DELIVERY_LEASE_SECONDS=600
```

Validation:

- host/from address/from name are non-empty and safe;
- port is integer 1-65535;
- timeouts are positive integers with documented upper bounds;
- lease is integer 60-3600 seconds;
- secure is parsed explicitly as boolean, not `Boolean("false")`;
- SMTP user/password are either both present or both absent;
- production must not use the `.local` development sender;
- secrets are never logged, returned by API, stored in attempts, or committed.

Local Mailpit:

```text
SMTP: localhost:1025
Web UI: http://localhost:8025
No authentication
```

API startup should not fail merely because SMTP is temporarily unreachable.
Configuration syntax must validate at startup; connection errors are recorded
when sending.

## 6. Prisma Schema

Add:

```prisma
enum PayslipDeliveryStatus {
  PENDING
  SENT
  FAILED
  UNKNOWN
}

enum PayslipDeliveryMode {
  SEND_UNSENT
  RETRY_FAILED
  RESEND_ALL
}

model PayslipDeliveryAttempt {
  id                  String                 @id @default(uuid())
  batchId             String
  payrunId            String
  payslipId           String
  attemptNumber       Int
  mode                 PayslipDeliveryMode
  status               PayslipDeliveryStatus @default(PENDING)
  recipientEmail       String?
  pdfSha256            String?
  requestedByUserId    String
  smtpMessageId        String?
  errorCode            String?
  errorMessage         String?
  startedAt            DateTime               @default(now()) @db.Timestamptz(3)
  completedAt          DateTime?              @db.Timestamptz(3)
  payrun               Payrun                  @relation(fields: [payrunId], references: [id], onDelete: Restrict)
  payslip              Payslip                 @relation(fields: [payslipId], references: [id], onDelete: Restrict)
  requestedByUser      User                    @relation("PayslipDeliveryRequester", fields: [requestedByUserId], references: [id], onDelete: Restrict)
  createdAt            DateTime                @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime                @updatedAt @db.Timestamptz(3)

  @@unique([payslipId, attemptNumber])
  @@index([payrunId, batchId])
  @@index([payrunId, status, startedAt])
  @@index([payslipId, startedAt])
}
```

Extend `Payrun`:

```prisma
deliveryLeaseToken     String?
deliveryLeaseExpiresAt DateTime? @db.Timestamptz(3)
deliveryAttempts       PayslipDeliveryAttempt[]
```

Extend `Payslip` and `User` with inverse delivery relations.

Migration name:

```text
phase09_payslip_delivery
```

## 7. Database Constraints

Customize migration checks equivalent to:

- `attemptNumber` is positive.
- `batchId` and lease token are UUID-formatted strings when present.
- recipient is null or normalized lowercase, trimmed, valid-looking email,
  max 254. It may be null only for a Failed `RECIPIENT_MISSING` or
  `RECIPIENT_INVALID` attempt; do not persist unsafe invalid header content.
- PDF hash is null or lowercase 64-character hexadecimal. It may be null only
  for a Failed `PDF_MISSING` attempt.
- SMTP message ID is null or trimmed max 500.
- error code is null or uppercase identifier max 100.
- error message is null or trimmed max 1000.
- `PENDING`: recipient/hash present; no completed time, message ID, or error.
- `SENT`: recipient/hash, completed time, and message ID present; error fields null.
- `FAILED`: completed time and error code/message present; message ID null.
- `UNKNOWN`: completed time and error code/message present; message ID may be null.
- Payrun lease token and expiry are either both null or both non-null.

Service validation remains required. Do not expose database constraint names.

## 8. Attempt Lifecycle

```text
PENDING --SMTP accepted--> SENT
PENDING --known failure--> FAILED
PENDING --lease expired / outcome ambiguous--> UNKNOWN
```

No transition leaves Sent, Failed, or Unknown. Retrying creates a new attempt
with the next attempt number.

Before each SMTP call:

1. Verify current Payrun/Payslip status remains Validated/Paid.
2. Validate normalized snapshot recipient.
3. Verify final PDF bytes and hash.
4. Create/commit one Pending attempt.
5. Send using the exact recipient/PDF hash stored on that attempt.
6. Update only that Pending attempt to Sent or Failed.

Recipient/PDF precondition failures still create a Failed attempt without
calling SMTP, using stable codes such as `RECIPIENT_MISSING`,
`RECIPIENT_INVALID`, `PDF_MISSING`, or `PDF_INTEGRITY_FAILED`.

Never keep an ordinary database transaction open during SMTP network I/O.

## 9. Payrun Delivery Lease

Acquire in one conditional database update:

```text
lease may be acquired when token is null OR expiry <= database now()
```

On acquisition:

- create a random UUID token;
- use database time for expiry;
- update rows atomically and require exactly one affected Payrun;
- reject an unexpired existing lease with `PAYSLIP_DELIVERY_IN_PROGRESS`.

On normal completion, clear the lease only when its token still matches.

When replacing an expired lease:

1. Mark that Payrun's old Pending attempts Unknown with completion time and
   `DELIVERY_OUTCOME_UNKNOWN`.
2. Acquire the new token.
3. Exclude Unknown attempts from automatic modes.

Renew the lease between messages when necessary. Stop creating new attempts if
lease ownership is lost. Do not use a Node process-local mutex as authority.

## 10. Email Contract

Subject:

```text
PeoplePay360 Payslip - <Month/Period>
```

Do not include Net salary, bank details, internal IDs, warnings, or sensitive
information in the subject.

Body requirements:

- plain-text and escaped HTML alternatives;
- greeting using Employee name snapshot;
- identify the Payrun period;
- state that the validated Payslip is attached;
- advise contacting HR/payroll for questions;
- no password, bank account, formula internals, warning details, or private HR
  fields;
- no user-controlled raw HTML.

Attachment:

```text
filename: payslip-<safe employee number>-<periodStart>-<periodEnd>.pdf
contentType: application/pdf
content: stored finalPdf bytes
```

Use a safe filename allowlist. Never load an attachment from a client path/URL.

Set a deterministic `Message-ID` derived from the delivery attempt ID and a
configured safe sender domain when possible. Store the SMTP-returned message ID
for diagnostics. This supports provider deduplication but is not treated as a
guarantee.

## 11. Sanitized Failure Policy

Persist stable internal codes:

```text
RECIPIENT_MISSING
RECIPIENT_INVALID
PDF_MISSING
PDF_INTEGRITY_FAILED
SMTP_CONFIGURATION_INVALID
SMTP_CONNECTION_FAILED
SMTP_AUTH_FAILED
SMTP_RECIPIENT_REJECTED
SMTP_TIMEOUT
SMTP_SEND_FAILED
DELIVERY_OUTCOME_UNKNOWN
```

Map Nodemailer/provider errors to these codes. Store a short sanitized message
without credentials, connection strings, stack traces, raw SMTP transcript, or
untrusted HTML. Public DTOs may return the stable code/message.

## 12. Shared Contracts

Create `packages/shared/src/types/payslip-delivery.ts` and export it.

```ts
export const PayslipDeliveryStatusValues = [
  'PENDING', 'SENT', 'FAILED', 'UNKNOWN',
] as const;

export const PayslipDeliveryModeValues = [
  'SEND_UNSENT', 'RETRY_FAILED', 'RESEND_ALL',
] as const;

export interface SendPayslipsInput {
  mode: PayslipDeliveryMode;
  confirmResend?: boolean;
}
```

Validation:

- body rejects unknown keys;
- `confirmResend === true` is required only for `RESEND_ALL`;
- no body accepts recipients, PDF data/hash, template HTML, SMTP settings,
  Payrun status, attempt status, or Employee IDs.

Attempt DTO:

```text
id, batchId, Payrun/Payslip/Employee summaries
attemptNumber, mode, status
recipientEmail or null
pdfSha256 or null
requestedBy summary
smtpMessageId (Payroll/Admin only)
safe error code/message
startedAt, completedAt
```

Bulk result DTO:

```ts
interface SendPayslipsResultDto {
  batchId: string;
  payrunId: string;
  mode: PayslipDeliveryMode;
  targeted: number;
  sent: number;
  failed: number;
  unknown: number;
  skipped: number;
  results: Array<{
    payslipId: string;
    employeeName: string;
    attemptId: string | null;
    status: PayslipDeliveryStatus | 'SKIPPED';
    errorCode: string | null;
  }>;
}
```

Do not return PDF bytes or SMTP secrets.

## 13. Authorization

| Capability | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| --- | --- | --- | --- | --- | --- |
| Send/retry/resend Payslips | Deny | Deny | Allow | Allow | Allow |
| Read Payrun/Payslip delivery history | Deny | Deny | Allow | Allow | Allow |
| Read SMTP message ID/error | Deny | Deny | Allow | Allow | Allow |
| Modify/delete attempts | Deny | Deny | Deny | Deny | Deny |

Every route uses authentication and explicit Payroll authorization. Employee
roles still have no payroll access in the PRD.

## 14. API Contract

Mount within `/api/v1/payroll`.

### `POST /api/v1/payroll/payruns/:id/send-payslips`

Accept `SendPayslipsInput`.

Flow:

1. Require Validated or Paid Payrun.
2. Acquire Payrun delivery lease.
3. Resolve targets using mode and latest attempt per Payslip.
4. Reject more than 500 targets.
5. If no target exists, return `NO_PAYSLIPS_TO_SEND` without SMTP calls.
6. Generate one `batchId` for this API action.
7. Process with maximum concurrency three and persist every attempt/result.
8. Clear owned lease in `finally`.
9. Write request/completion audit summaries.
10. Return 200 with complete per-Payslip result, even when some/all attempts
    failed after the action started.

Target selection:

- `SEND_UNSENT`: no historical attempt for Payslip.
- `RETRY_FAILED`: latest attempt exactly Failed.
- `RESEND_ALL`: every finalized Payslip, including Sent/Failed/Unknown, after
  explicit confirmation; exclude an active Pending attempt under current lease.

### `GET /api/v1/payroll/payruns/:id/deliveries`

Queries: `status`, `batchId`, `page`, `pageSize`, `sort`, `order`.

Return:

```text
total attempts by status
unique Payslips ever sent
latest attempt status per Payslip
paginated append-only attempt history
active lease boolean/expiry (never token)
```

### `GET /api/v1/payroll/payslips/:id/deliveries`

Return ordered attempts for one Payslip plus `latestStatus`, `everSent`, and
`lastSentAt`.

No attempt mutation/delete endpoint. Retrying always goes through the Payrun
bulk action so lease/mode rules remain centralized.

## 15. Public Errors

| HTTP | Code | Meaning |
| ---: | --- | --- |
| 400 | `INVALID_DELIVERY_INPUT` | Body/query validation failed |
| 400 | `PAYSLIP_RESEND_CONFIRMATION_REQUIRED` | Resend All lacks confirmation |
| 401 | existing auth code | Not signed in |
| 403 | `PAYSLIP_DELIVERY_ACCESS_DENIED` | Role denied |
| 404 | `PAYRUN_NOT_FOUND` | Payrun missing/unavailable |
| 404 | `PAYSLIP_NOT_FOUND` | Payslip missing/unavailable |
| 409 | `PAYSLIP_DELIVERY_INVALID_STATUS` | Payrun is not Validated/Paid |
| 409 | `PAYSLIP_DELIVERY_IN_PROGRESS` | Active lease exists |
| 409 | `NO_PAYSLIPS_TO_SEND` | Selected mode has no targets |
| 413 | `PAYSLIP_DELIVERY_BATCH_TOO_LARGE` | More than 500 targets |
| 500 | `PAYSLIP_DELIVERY_SETUP_FAILED` | Failed before per-item processing |

Individual SMTP/data failures belong in the successful bulk result as Failed
attempts, not raw 500 responses. Never expose SMTP credentials/provider traces.

## 16. Backend Organization

Create:

```text
apps/api/src/modules/payroll/delivery/
  delivery.constants.ts
  delivery.errors.ts
  delivery.mapper.ts
  delivery.schemas.ts
  delivery.types.ts
  delivery-lease.service.ts
  delivery-selection.ts
  email-content.ts
  smtp-client.ts
  payslip-delivery.service.ts
  payslip-delivery.controller.ts
  payslip-delivery.routes.ts
  index.ts
```

Tests:

```text
apps/api/tests/payslip-delivery.test.ts
apps/api/tests/payslip-delivery-mailpit.test.ts
```

Use existing Nodemailer. Do not add a queue or another mail library.

## 17. Audit Requirements

Required actions:

```text
PAYSLIP_DELIVERY_BATCH_REQUESTED
PAYSLIP_DELIVERY_SENT
PAYSLIP_DELIVERY_FAILED
PAYSLIP_DELIVERY_OUTCOME_UNKNOWN
PAYSLIP_DELIVERY_BATCH_COMPLETED
```

Audit stores actor, Payrun/Payslip IDs, batch/attempt IDs, mode, recipient
domain or masked address, status, safe error code, and UTC time. Do not store
PDF bytes, SMTP secrets, raw provider responses, salary totals, or full bank data.

Attempt persistence is authoritative delivery history; AuditLog records actor
actions and important transitions. A status update failure must be surfaced and
leave the attempt Pending for later Unknown recovery.

## 18. Frontend Behavior

### Payrun processing screen

- Enable `Send Payslips` only for Validated/Paid Payruns and authorized roles.
- Open a confirmation dialog showing total Payslips and current delivery
  summary.
- Offer:
  - Send Unsent;
  - Retry Failed, only when failures exist;
  - Resend All, behind a stronger duplicate-email confirmation.
- Disable controls while request is active.
- Display sent/failed/skipped result counts and per-Employee failures.
- Refresh Payrun/Payslip delivery summaries after completion.
- Do not optimistically mark an email Sent.
- If a lease is active, show delivery in progress and its expiry, not token.

### Delivery history

- Add a delivery section/tab to Payrun detail with latest status per Payslip and
  append-only attempt history.
- Add one Payslip-level delivery history section.
- Status styling: Pending neutral, Sent green, Failed red, Unknown amber.
- Show recipient, attempt number, mode, requester, safe error, and timestamps.
- Explain Unknown: SMTP may have accepted the email; resending can duplicate it.
- No edit/delete controls.

### Security/accessibility

- Never render raw SMTP/provider responses as HTML.
- Confirmation dialogs are keyboard accessible and focus-managed.
- Failure details remain readable without relying on color alone.

## 19. Seed Data

The Prisma schema is still evolving. Phase 9 must work with the current
`apps/api/prisma/seed.ts` instead of refactoring it into generators or
phase-specific seed modules. Add only the smallest fixtures needed to verify
Payslip delivery. The complete reusable mock-data generator, including the
target 200-Employee dataset, is deferred until the application schema is
stable after the remaining phases.

Seed changes must:

- preserve all existing seed records required by earlier phases;
- reuse the existing Phase 8 Payrun, Payslip, User, and Employee fixtures;
- follow the current seed file's idempotency convention;
- avoid introducing Faker or a new mock-data dependency;
- avoid broad cleanup or architectural refactoring of `seed.ts`;
- never send real emails or call SMTP while seeding.

Create idempotent attempt history attached to Phase 8 Validated/Paid fixtures:

- one Sent first attempt;
- one Failed attempt with a sanitized recipient/SMTP error;
- one Failed then Sent retry;
- one Unknown interrupted attempt;
- multiple attempts sharing a batch ID.

Use stable IDs and attempt numbers. Keep status metadata internally consistent.
Payrun lease fields must end null after seed.

## 20. Automated Tests

### Selection and validation

- Draft/Computed Payrun rejected without attempts/SMTP calls;
- Send Unsent selects only zero-history Payslips;
- Retry Failed selects only latest-Failed Payslips;
- Resend All requires confirmation and includes Sent/Unknown;
- active Pending attempts are not duplicated;
- missing/invalid recipient and PDF/hash mismatch create safe Failed attempts;
- actual attachment bytes/hash equal Phase 8 stored PDF;
- current Employee email/PDF changes are never used.

### Attempt and lease behavior

- Pending is committed before SMTP invocation;
- success stores Sent/message ID/completed time;
- known error stores Failed/sanitized code/message;
- expired lease turns old Pending attempts Unknown;
- concurrent bulk calls allow one lease owner only;
- losing lease stops creation of new attempts;
- lease clears only for matching token;
- attempt numbers remain unique under retries/concurrency;
- attempts cannot be updated through public APIs.

### Email content

- plain and escaped HTML bodies contain required snapshot fields;
- subject contains Period but no salary/bank/internal IDs;
- filename is safe and deterministic;
- PDF attachment has `application/pdf` and stored bytes;
- header/HTML injection attempts cannot alter recipients/content;
- SMTP secrets never appear in logs/API/attempt errors.

### Bulk and RBAC

- one failure does not roll back successful deliveries;
- result counts and per-Payslip statuses reconcile with database;
- concurrency never exceeds three mocked sends;
- more than 500 targets rejected before SMTP;
- Payroll User/Manager/Admin allowed; Employee/HR Manager denied;
- Send action changes no Payrun/Payslip status, total, Line, Warning, or PDF hash;
- audit summaries and per-attempt events contain no sensitive data;
- all Phase 8 and earlier tests continue passing.

### Mailpit integration

Run an opt-in integration test when Mailpit is available:

- send one Validated fixture;
- verify Mailpit receives one message;
- verify To, Subject, text/HTML body, filename, MIME type, and PDF bytes;
- clean test messages through Mailpit API if configured for isolated tests;
- normal unit tests must not depend on external SMTP availability.

## 21. Exact Implementation Order

1. Verify Phase 8 migration, final PDF/hash behavior, and complete test suite.
2. Add/validate SMTP and lease environment settings.
3. Add shared delivery enums/input/DTOs and exports.
4. Add DeliveryAttempt and Payrun lease Prisma fields/migration checks.
5. Implement email content and SMTP client with mocked tests.
6. Implement attempt mapper/error sanitization.
7. Implement lease acquisition/renewal/recovery/release tests.
8. Implement target selection for all three explicit modes.
9. Implement bounded worker pool and per-Payslip send lifecycle.
10. Implement bulk/history routes, RBAC, and audit.
11. Append only the minimum delivery-attempt fixtures to the existing
    `seed.ts`; do not refactor it or generate the final workforce dataset.
12. Connect Payrun Send action, confirmation modes, and result summary.
13. Add Payrun/Payslip delivery history UI.
14. Run unit/integration/full regression tests.
15. Verify one real local delivery through Mailpit.
16. Append one Branch Updates tracker entry; do not edit tracker summaries.

## 22. Verification

```bash
npm install
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run db:test:prepare
npm run db:seed
npm run typecheck
npm run build
npm test
```

Manual Mailpit verification:

1. Open a Validated Payrun containing at least two Payslips.
2. Send Unsent and confirm per-Employee result summary.
3. Open `http://localhost:8025`; inspect recipient, subject, body, attachment,
   MIME type, and PDF content.
4. Confirm Payrun/Payslip status and PDF hash did not change.
5. Stop Mailpit, Retry Failed/send another unsent Payslip, and confirm a safe
   Failed attempt.
6. Restart Mailpit and Retry Failed; confirm a new Sent attempt and preserved
   failure history.
7. Attempt Send Unsent again and confirm no targets.
8. Use Resend All and confirm duplicate warning/confirmation appears.
9. Verify Employee and HR Manager cannot access delivery APIs/UI.

## 23. Definition of Done

- [ ] SMTP configuration is validated without exposing secrets.
- [ ] Only Validated/Paid stored PDFs are attached and their hash is verified.
- [ ] Send Unsent, Retry Failed, and confirmed Resend All select exact targets.
- [ ] Every attempted/blocked send has immutable persisted history.
- [ ] Payrun lease prevents concurrent bulk delivery and recovers stale Pending.
- [ ] Sent/Failed/Unknown semantics accurately represent known/ambiguous outcome.
- [ ] Bulk results are best-effort, bounded, and reconcile with attempts.
- [ ] Payrun/Payslip financial state and PDFs never change during delivery.
- [ ] Delivery actions/history are RBAC-protected and transactionally audited.
- [ ] UI has real send/history behavior with no fake success.
- [ ] Existing seed remains intact and gains only the minimum idempotent
      delivery history needed for Phase 9; it sends no email.
- [ ] Mailpit manual delivery and all regression checks pass.

## 24. Non-Negotiables

- Do not send Draft/Computed Payslips.
- Do not regenerate or modify finalized PDFs.
- Do not use current Employee email instead of the Payslip snapshot.
- Do not accept recipient/PDF/template/SMTP values from the client.
- Do not claim exactly-once delivery across SMTP and PostgreSQL.
- Do not silently retry Sent, Pending, or Unknown attempts.
- Do not allow concurrent sends for the same Payrun.
- Do not hold a database transaction open across SMTP network I/O.
- Do not use unbounded parallel email sends.
- Do not change payroll status or financial data during delivery.
- Do not expose secrets, provider traces, raw HTML, full bank data, or PDF bytes
  in JSON/AuditLog.
- Do not delete or rewrite attempt history.
- Do not add queues, Redis, brokers, another mail library, or dashboard code.
- Do not refactor the evolving seed architecture or add the final 200-Employee
  generator in this phase.
