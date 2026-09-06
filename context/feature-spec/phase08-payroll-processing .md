# Phase 8 - Payruns and Payslips

## Metadata

- **Status:** APPROVED FOR IMPLEMENTATION
- **Target branch:** `feature/phase08-payroll-processing`
- **Assumed baseline:** Phases 2-7 and the Phase 4B Formula Engine are merged and verified
- **PRD coverage:** B5 Payrun Creation Wizard; B6 Payrun Processing; B7 Payslip and Salary Computation; individual Payslip PDF generation
- **Depends on:** Employee, Contract resolution, Working Schedule, Attendance, Time Off, Salary Configuration, Formula Engine, company timezone, RBAC, and AuditLog
- **Blocks:** Bulk Payslip email delivery and the Payroll Dashboard
- **Implementation ownership:** Payroll Prisma models, shared contracts, Payroll API, computation orchestration, Payrun/Payslip UI, final PDF persistence, seeds, and tests

## 1. Goal

Implement the complete payroll batch workflow:

1. Select a Salary Structure and Period without creating a record.
2. Preview eligible and ineligible Employees.
3. Select eligible Employees and create one Draft Payrun with Draft Payslips.
4. Compute each Payslip from its applicable Contract, Schedule, Attendance,
   approved Time Off, and ordered Salary Rules.
5. Review and acknowledge permitted warnings.
6. Validate the entire Payrun and persist immutable final Payslip PDFs.
7. Mark the validated Payrun Paid without initiating a bank transaction.

The result must be reproducible, transactionally safe, Decimal-accurate, and
historically stable after validation.

## 2. Source Priority

1. Attached PeoplePay360 PRD.
2. `context/architecture.md` Payroll, warning, immutability, and Decimal invariants.
3. `context/project-overview.md` canonical vocabulary and role definitions.
4. This specification.
5. Phase 4-7 feature specifications for their public contracts.
6. Existing frontend design system and any Payroll mockup.

If a prototype conflicts with the first four sources, follow this spec.

## 3. Scope

### In scope

- Payrun, Payslip, Payslip Line, and Payroll Warning persistence.
- Two-step Payrun creation wizard.
- Employee eligibility preview without database mutation.
- Transactional creation of selected Payslips.
- Restricted discard of an uncomputed Draft Payrun.
- Full-period Contract and Salary Structure matching.
- Expected/Worked Days, hours, and daily overtime aggregation.
- Approved paid/unpaid Time Off integration.
- Ordered Fixed, Percentage, and Formula Salary Rule execution.
- Decimal rounding and persisted component lines.
- Compute and pre-validation Recompute.
- Typed warnings and warning acknowledgement.
- Transactional Payrun validation and final PDF persistence.
- Transactional Mark Paid status transition.
- Payrun list/processing screen and global Payslip list/detail.
- Individual Payslip PDF preview/download.
- Immutable validated/paid payroll history.
- Transactional audit events.
- Idempotent representative payroll seeds and comprehensive tests.

### Out of scope

- Bulk email delivery and `PayslipDeliveryAttempt`.
- Send Payslips implementation.
- Payroll Dashboard/reporting UI and report-supporting indexes beyond core ones.
- Actual bank transfer or payment gateway.
- Tax slabs, statutory filing, country-specific compliance, or currency conversion.
- Multiple currencies in one deployment.
- Mid-period Contract splitting.
- Partial-hour salary proration.
- Manual Payslip line editing or arbitrary salary overrides.
- Individual Payslip workflow transitions outside its parent Payrun.
- Adding/removing Employees after Payrun creation.
- Deletion of Computed, Validated, or Paid payroll history.

## 4. Canonical Workflow

```text
DRAFT --Compute--> COMPUTED --Validate--> VALIDATED --Mark Paid--> PAID
  ^                    |
  +-----Recompute------+
```

Rules:

1. Payrun and all child Payslips always share the same workflow status.
2. Creation produces one Draft Payrun and Draft Payslips only after wizard
   Step 2 is confirmed.
3. Wizard Continue/eligibility preview never creates a Payrun or Payslip.
4. Compute is allowed from Draft. Recompute is allowed only from Computed.
5. Recompute replaces active generated Lines and Warnings for the whole batch.
6. Validate is allowed only from Computed after stale-input and warning checks.
7. Mark Paid is allowed only from Validated and changes status only.
8. Validated and Paid payroll financial data and final PDFs are immutable.
9. Repeating Validate on Validated or Mark Paid on Paid is idempotent and
   returns the existing result without new audit rows. Calling Compute on an
   already Computed Payrun is a conflict; the caller must explicitly choose
   Recompute. Skipping/reversing states returns a conflict.
10. All batch actions are all-or-nothing transactions. One hard failure rolls
    back every Payslip change in that action.
11. An uncomputed Draft may be discarded only by HR Payroll Manager or Admin.
    This is the correction path for an accidental final wizard submission.
    Once Compute succeeds, the Payrun is permanent.

## 5. Eligibility Rules

An Employee appears as eligible only when all conditions hold:

1. Employee is Active.
2. Exactly one Contract covers the entire selected Period:

   ```text
   contract.startDate <= periodStart
   AND (contract.endDate IS NULL OR contract.endDate >= periodEnd)
   ```

3. Applicable Contract's Salary Structure equals the wizard Structure.
4. Schedule resolves through Contract override, then Employee fallback.
5. Salary Structure is Active and its active Rule graph is valid.
6. The Structure has at least one active BASIC Rule, exactly one active GROSS
   Rule, and exactly one active NET Rule.
7. No Payslip already exists for that Employee and exact Period.

Ineligibility reasons are stable values:

```text
EMPLOYEE_INACTIVE
NO_APPLICABLE_CONTRACT
MULTIPLE_APPLICABLE_CONTRACTS
SALARY_STRUCTURE_MISMATCH
WORKING_SCHEDULE_MISSING
SALARY_STRUCTURE_INACTIVE
SALARY_STRUCTURE_INVALID
DUPLICATE_PAYSLIP
```

Do not silently substitute a Contract, Structure, or Schedule. Do not hide
ineligible Employees; return them with safe reasons so the wizard explains why
they cannot be selected.

Missing Attendance or bank details does not make an Employee ineligible. Those
conditions become warnings during Compute.

## 6. Payroll Day Calculation

For each Payslip, use the applicable Contract/Schedule and iterate every
calendar date in the inclusive Period.

### Expected dates

- A date is expected when the resolved Schedule has a day row for its weekday.
- `expectedWorkingDays` is the number of expected dates.
- `expectedMinutes` is the sum of net scheduled minutes across expected dates.
- If `expectedWorkingDays = 0`, Compute fails with
  `PAYROLL_NO_EXPECTED_WORKING_DAYS`; it is not acknowledgeable.

### Expected-date contribution

| Data on expected date | Worked-day contribution | Warning |
| --- | ---: | --- |
| Attendance Present/Late | 1 | None unless another conflict exists |
| Attendance Absent | 0 | None unless another conflict exists |
| Approved Paid Time Off, no Attendance | 1 | None |
| Approved Unpaid Time Off, no Attendance | 0 | None |
| No Attendance and no approved Time Off | 0 | `MISSING_ATTENDANCE` |

Rules:

1. Attendance is authoritative when Attendance and approved Time Off both
   exist; create `ATTENDANCE_TIME_OFF_CONFLICT`.
2. An open Present/Late Attendance still contributes one worked day but creates
   `OPEN_ATTENDANCE_RECORD` because worked/overtime minutes are incomplete.
3. Approved DAY or HOUR Time Off covers a date for this table. Phase 7's
   snapshotted PAID/UNPAID treatment is authoritative.
4. Pending/Refused Time Off is ignored.
5. Missing Attendance is never changed to Absent.
6. Attendance on a non-expected date contributes zero Worked Days but its
   persisted worked/overtime minutes are included in hours and overtime.
7. If an Attendance snapshot references a different Schedule expectation from
   the Payrun's resolved Schedule, create `ATTENDANCE_SCHEDULE_MISMATCH` and
   continue using the persisted Attendance worked/overtime minutes.

Totals:

```text
WORKED_DAYS = sum of day contributions
EXPECTED_DAYS = expectedWorkingDays
WORKED_HOURS = sum(attendance.workedMinutes) / 60
EXPECTED_HOURS = expectedMinutes / 60
OVERTIME_HOURS = sum(attendance.overtimeMinutes) / 60
PRORATED_BASIC = WAGE * WORKED_DAYS / EXPECTED_DAYS
```

Use Prisma Decimal for every division and multiplication. Day/minute counts may
be integers at rest, but conversion to hours and salary must never use
JavaScript floating-point arithmetic.

## 7. Salary Rule Execution

Load the active Rules from the Payrun Structure in ascending sequence. Validate
the complete graph before any Payslip mutation.

Initial Decimal variables:

```text
WAGE
PRORATED_BASIC
WORKED_DAYS
EXPECTED_DAYS
WORKED_HOURS
EXPECTED_HOURS
OVERTIME_HOURS
```

Evaluate methods:

```text
FIXED      -> fixedAmount
PERCENTAGE -> variables[percentageBase] * percentageRate / 100
FORMULA    -> Phase 4B evaluateFormula(formula, current variables)
```

After evaluating one Rule:

1. Reject non-finite/out-of-range output through Formula Engine rules.
2. Round the Rule result to currency precision (2 decimals) using
   `ROUND_HALF_UP`.
3. Persist that rounded amount as the Payslip Line.
4. Expose the rounded amount under the Rule code for later Rules.

Formula-internal operations retain full Decimal precision; rounding occurs once
at the Rule boundary. This makes displayed Lines and dependent totals reconcile.

Structure output requirements:

- At least one active BASIC Rule.
- Exactly one active GROSS Rule.
- Exactly one active NET Rule.
- The final GROSS and NET values must be non-negative.
- Multiple BASIC/ALLOWANCE/OVERTIME/DEDUCTION/CONTRIBUTION Lines are allowed.

Payslip summaries:

```text
basicAmount        = sum(BASIC Lines)
allowanceAmount    = sum(ALLOWANCE Lines)
overtimeAmount     = sum(OVERTIME Lines)
deductionAmount    = sum(DEDUCTION Lines)
contributionAmount = sum(CONTRIBUTION Lines)
grossAmount        = the single GROSS Line
netAmount          = the single NET Line
```

Do not automatically add/subtract categories or change signs. Salary Rules are
the computation authority; summaries only categorize their stored outputs.

## 8. Warning Policy

Persist these warning types:

| Type | Blocking | Acknowledgeable | Trigger |
| --- | --- | --- | --- |
| `MISSING_ATTENDANCE` | Yes | Yes | Expected date lacks Attendance and approved Time Off |
| `OPEN_ATTENDANCE_RECORD` | Yes | Yes | Attendance has Check In but no Check Out |
| `ATTENDANCE_TIME_OFF_CONFLICT` | Yes | Yes | Attendance and approved Time Off cover same expected date |
| `ATTENDANCE_SCHEDULE_MISMATCH` | Yes | Yes | Attendance snapshot conflicts with Payrun Schedule |
| `MISSING_BANK_DETAILS` | Yes | Yes | Required account name/number/bank/IFSC is incomplete |

Hard failures are not warnings and cannot be acknowledged:

```text
invalid/missing/multiple Contract
Structure mismatch or invalid Rule graph
missing Schedule
zero expected working days
duplicate Payslip
formula evaluation failure
negative GROSS or NET
stale computation inputs
database integrity failure
```

Warning statuses:

```text
OPEN | ACKNOWLEDGED | RESOLVED
```

Rules:

1. Compute creates current warnings as Open.
2. Acknowledge requires a trimmed 5-500 character reason, actor, and UTC time.
3. Only warnings marked acknowledgeable may be acknowledged.
4. Recompute logically replaces warnings: prior current warnings become
   Resolved and newly detected warnings are new Open records.
5. An acknowledgement never creates/edits Attendance, Time Off, bank data, or
   another source record.
6. Validate rejects any Open blocking warning. Acknowledged blocking warnings
   allow validation and remain visible in history.
7. Open non-blocking warnings do not prevent validation.

## 9. Historical Snapshot and Staleness

Each Compute/Recompute refreshes the mutable computation snapshot from current
source data. Persist enough data to reproduce the displayed/PDF result without
later joins changing history:

- Employee number, full name, work email, Department name;
- bank account name, masked account display, bank name, IFSC;
- Contract ID/number, job position, monthly wage;
- Salary Structure ID/name;
- Working Schedule ID/name;
- Period, currency, expected/worked days and minutes;
- prorated Basic and all computed summaries;
- one Payslip Line snapshot per executed Rule;
- current warnings and acknowledgements.

Never put full bank account numbers into list DTOs, logs, warning messages, or
AuditLog. The Payslip snapshot may retain the encrypted/plain database value
only if required for the finalized document; the PDF should display a masked
account number. If full number is not printed, store only the masked snapshot.

Create `computationInputHash` as SHA-256 over one canonical serialization of all
inputs that affect calculation:

- applicable Contract terms;
- resolved Schedule pattern;
- Period Attendance facts;
- approved Time Off snapshots covering the Period;
- active Salary Structure/Rule configuration;
- Employee bank warning inputs;
- currency.

Use stable object keys and canonical decimal/date strings. Sort Schedule days
by weekday, Attendance by date/ID, Time Off by start date/ID, and Rules by
sequence/ID before serialization. Do not hash ordinary `JSON.stringify` output
from unordered query results.

Before Validate, rebuild the hash inside the transaction. A mismatch returns
`PAYROLL_COMPUTATION_STALE`; the user must Recompute. Never validate stale
financial results.

Validated/Paid records render only persisted snapshots, Lines, Warnings, and
PDF bytes. They never reread mutable Employee/Contract/Rule data for display.

## 10. Prisma Schema

Add enums and models equivalent to:

```prisma
enum PayrollStatus {
  DRAFT
  COMPUTED
  VALIDATED
  PAID
}

enum PayrollWarningStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
}

enum PayrollWarningType {
  MISSING_ATTENDANCE
  OPEN_ATTENDANCE_RECORD
  ATTENDANCE_TIME_OFF_CONFLICT
  ATTENDANCE_SCHEDULE_MISMATCH
  MISSING_BANK_DETAILS
}

model Payrun {
  id                    String        @id @default(uuid())
  payrunNumber          String        @unique
  name                  String
  salaryStructureId     String
  salaryStructureName   String
  periodStart           DateTime      @db.Date
  periodEnd             DateTime      @db.Date
  currency              String
  status                PayrollStatus @default(DRAFT)
  createdByUserId       String
  computedByUserId      String?
  computedAt            DateTime?     @db.Timestamptz(3)
  validatedByUserId     String?
  validatedAt           DateTime?     @db.Timestamptz(3)
  paidByUserId          String?
  paidAt                DateTime?     @db.Timestamptz(3)
  salaryStructure       SalaryStructure @relation(fields: [salaryStructureId], references: [id], onDelete: Restrict)
  createdByUser         User          @relation("PayrunCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)
  computedByUser        User?         @relation("PayrunComputer", fields: [computedByUserId], references: [id], onDelete: Restrict)
  validatedByUser       User?         @relation("PayrunValidator", fields: [validatedByUserId], references: [id], onDelete: Restrict)
  paidByUser            User?         @relation("PayrunPayer", fields: [paidByUserId], references: [id], onDelete: Restrict)
  payslips              Payslip[]
  warnings              PayrollWarning[]
  createdAt             DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime      @updatedAt @db.Timestamptz(3)

  @@index([periodStart, periodEnd])
  @@index([salaryStructureId, status])
  @@index([status, createdAt])
}

model Payslip {
  id                       String        @id @default(uuid())
  payrunId                 String
  employeeId               String
  contractId               String
  salaryStructureId        String
  periodStart              DateTime      @db.Date
  periodEnd                DateTime      @db.Date
  status                   PayrollStatus @default(DRAFT)
  employeeNumberSnapshot   String?
  employeeNameSnapshot     String?
  workEmailSnapshot        String?
  departmentNameSnapshot  String?
  jobPositionSnapshot      String?
  contractNumberSnapshot  String?
  structureNameSnapshot   String?
  scheduleIdSnapshot       String?
  scheduleNameSnapshot     String?
  bankAccountNameSnapshot String?
  bankAccountMaskSnapshot String?
  bankNameSnapshot        String?
  bankIfscSnapshot        String?
  monthlyWage              Decimal?      @db.Decimal(18, 2)
  expectedDays             Int?
  workedDays               Int?
  expectedMinutes          Int?
  workedMinutes            Int?
  overtimeMinutes          Int?
  proratedBasic            Decimal?      @db.Decimal(18, 2)
  basicAmount              Decimal?      @db.Decimal(18, 2)
  allowanceAmount          Decimal?      @db.Decimal(18, 2)
  overtimeAmount           Decimal?      @db.Decimal(18, 2)
  deductionAmount          Decimal?      @db.Decimal(18, 2)
  contributionAmount       Decimal?      @db.Decimal(18, 2)
  grossAmount              Decimal?      @db.Decimal(18, 2)
  netAmount                Decimal?      @db.Decimal(18, 2)
  computationInputHash     String?
  finalPdf                 Bytes?
  finalPdfSha256           String?
  payrun                   Payrun         @relation(fields: [payrunId], references: [id], onDelete: Restrict)
  employee                 Employee       @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  contract                 Contract       @relation(fields: [contractId], references: [id], onDelete: Restrict)
  salaryStructure          SalaryStructure @relation(fields: [salaryStructureId], references: [id], onDelete: Restrict)
  lines                    PayslipLine[]
  warnings                 PayrollWarning[]
  createdAt                DateTime        @default(now()) @db.Timestamptz(3)
  updatedAt                DateTime        @updatedAt @db.Timestamptz(3)

  @@unique([payrunId, employeeId])
  @@unique([employeeId, periodStart, periodEnd])
  @@index([payrunId, status])
  @@index([employeeId, periodStart, periodEnd])
  @@index([departmentNameSnapshot])
}

model PayslipLine {
  id                 String             @id @default(uuid())
  payslipId          String
  salaryRuleId       String
  name               String
  code               String
  category           SalaryRuleCategory
  sequence           Int
  method             SalaryRuleMethod
  amount             Decimal            @db.Decimal(18, 2)
  payslip            Payslip            @relation(fields: [payslipId], references: [id], onDelete: Cascade)
  salaryRule         SalaryRule          @relation(fields: [salaryRuleId], references: [id], onDelete: Restrict)
  createdAt          DateTime            @default(now()) @db.Timestamptz(3)

  @@unique([payslipId, code])
  @@unique([payslipId, sequence])
  @@index([payslipId, category, sequence])
}

model PayrollWarning {
  id                     String               @id @default(uuid())
  payrunId               String
  payslipId              String?
  type                   PayrollWarningType
  status                 PayrollWarningStatus @default(OPEN)
  message                String
  blocking               Boolean
  acknowledgeable        Boolean
  details                Json?
  acknowledgedByUserId   String?
  acknowledgedAt         DateTime?             @db.Timestamptz(3)
  acknowledgementReason  String?
  resolvedAt             DateTime?             @db.Timestamptz(3)
  payrun                 Payrun                 @relation(fields: [payrunId], references: [id], onDelete: Cascade)
  payslip                Payslip?               @relation(fields: [payslipId], references: [id], onDelete: Cascade)
  acknowledgedByUser     User?                  @relation("WarningAcknowledger", fields: [acknowledgedByUserId], references: [id], onDelete: Restrict)
  createdAt              DateTime                @default(now()) @db.Timestamptz(3)
  updatedAt              DateTime                @updatedAt @db.Timestamptz(3)

  @@index([payrunId, status, blocking])
  @@index([payslipId, status])
  @@index([type, status])
}
```

Draft Payslip snapshot/calculation fields are nullable because they are filled
by Compute. After status becomes Computed they are required by service and
validation invariants.

Add inverse relations to User, Employee, Contract, SalaryStructure, and
SalaryRule using the named relations above.

Migration name:

```text
phase08_payroll_processing
```

Create a PostgreSQL sequence for concurrency-safe numbers:

```text
PAY/<periodStart year>/<6-digit nextval>
```

Sequence gaps are acceptable. Never use count/max plus one.

## 11. Database Constraints

Customize migration SQL with checks equivalent to:

- Period end is greater than/equal to start for Payrun and Payslip.
- Payrun name is trimmed, 2-120 characters.
- currency matches `^[A-Z]{3}$`.
- Payrun number matches `^PAY/[0-9]{4}/[0-9]{6}$`.
- Payslip period/Structure/status must match its parent; enforce in services and
  transactional tests because ordinary CHECK constraints cannot reference the
  parent row.
- All minute/day summaries are null or non-negative.
- Monetary summaries are null or fit Decimal(18,2); Gross/Net non-negative
  once Computed.
- `computationInputHash` and final hash are null or lowercase 64-character hex.
- Draft has null computed financial fields, Lines, hash, and final PDF.
- Computed has complete snapshot, financial fields, Lines, and computation
  hash but no final PDF.
- Validated/Paid has final PDF bytes and hash.
- Warning message is trimmed 1-1000 characters.
- Open warnings have no acknowledgement or resolution metadata.
- Acknowledged warnings require acknowledgement actor/time/reason and no
  resolution time.
- Resolved warnings require `resolvedAt`; they may retain internally consistent
  acknowledgement metadata when an acknowledged warning was later resolved by
  Recompute.

Use service validation plus database-safe translations for races. Do not expose
constraint names or raw SQL errors.

## 12. Shared Contracts

Create `packages/shared/src/types/payroll.ts` and export it.

Required values:

```ts
export const PayrollStatusValues = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID'] as const;
export const PayrollWarningStatusValues = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export const PayrollWarningTypeValues = [
  'MISSING_ATTENDANCE',
  'OPEN_ATTENDANCE_RECORD',
  'ATTENDANCE_TIME_OFF_CONFLICT',
  'ATTENDANCE_SCHEDULE_MISMATCH',
  'MISSING_BANK_DETAILS',
] as const;
```

Inputs:

```ts
export interface PayrunEligibilityInput {
  salaryStructureId: string;
  periodStart: string;
  periodEnd: string;
  search?: string;
  departmentId?: string;
  employeeType?: EmployeeType;
  page?: number;
  pageSize?: number;
}

export interface CreatePayrunInput {
  salaryStructureId: string;
  periodStart: string;
  periodEnd: string;
  employeeIds: string[];
}

export interface WarningAcknowledgementInput {
  reason: string;
}
```

Validation:

- IDs are UUIDs.
- Period dates are real company-date `YYYY-MM-DD`, start <= end, maximum 366
  days, and period end cannot be after current company date.
- Employee IDs contain 1-500 unique values.
- Search max 100; reject unknown keys.
- Eligibility page defaults to 1; page size defaults to 50 and is capped at 100.
- Acknowledgement reason is trimmed 5-500.
- No input accepts Payrun name/number/status, calculated values, snapshots,
  Lines, Warnings, PDFs, totals, actors, or timestamps.

Decimals cross HTTP as canonical strings. Binary PDFs use a PDF response, not
JSON/base64 inside normal DTOs.

## 13. DTO Requirements

### Eligibility item

```text
employee id/number/name/type
department
contract id/number/start/end
monthlyWage string
effective Schedule id/name/weeklyMinutes/source
eligible boolean
ineligibilityReasons[]
```

Never include Employee private/bank fields in eligibility responses.

### Payrun list/detail

- id, number, name, Structure summary, Period, currency, status;
- Payslip count and status counts;
- total Gross/Net for Computed/Validated/Paid only;
- open blocking warning count and total warning count;
- created/computed/validated/paid actor summaries and timestamps;
- detail includes child Payslip summaries ordered by Employee name/ID.

### Payslip list/detail

- identity snapshots, Period, Payrun/Structure/Contract summaries, status;
- expected/worked days and formatted minute source values;
- Decimal wage/prorated Basic/category summaries/Gross/Net as strings;
- ordered Lines and current plus historical Warnings;
- final PDF availability/hash, never PDF bytes in JSON;
- detail may show bank mask only, never full account number.

### Warning

- id, scope, type, status, message, blocking, acknowledgeable;
- safe structured details;
- acknowledgement/resolution actor/time/reason;
- no raw private data or stack traces.

## 14. Authorization

| Capability | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| --- | --- | --- | --- | --- | --- |
| Payrun eligibility/list/detail | Deny | Deny | Allow | Allow | Allow |
| Create Payrun/Payslips | Deny | Deny | Allow | Allow | Allow |
| Compute/Recompute | Deny | Deny | Allow | Allow | Allow |
| Acknowledge warnings | Deny | Deny | Allow | Allow | Allow |
| Validate | Deny | Deny | Allow | Allow | Allow |
| Mark Paid | Deny | Deny | Allow | Allow | Allow |
| Discard uncomputed Draft | Deny | Deny | Deny | Allow | Allow |
| Payslip list/detail/PDF | Deny | Deny | Allow | Allow | Allow |
| Delete computed/finalized or override financials | Deny | Deny | Deny | Deny | Deny |

Salary Config remains read-only for HR Payroll User, but that role may select
and execute existing active configuration in payroll. Every permission is
enforced in Express.

## 15. API - Payrun Wizard and CRUD

Mount under `/api/v1/payroll`.

### `POST /api/v1/payroll/payruns/eligibility`

Accept `PayrunEligibilityInput` and return eligible plus ineligible Employee
items. This endpoint is read-only and must not create/mutate any record or
consume a sequence number.

Revalidate Structure/Period first. Apply search/Department/Employee Type only
as display filters; eligibility logic remains unchanged.

### `POST /api/v1/payroll/payruns`

Accept `CreatePayrunInput`.

Inside one transaction:

1. Rerun eligibility for every selected Employee; never trust preview state.
2. Reject an empty, duplicate, missing, or ineligible selection.
3. Generate immutable Payrun number/name.
4. Create Draft Payrun.
5. Create exactly one Draft Payslip per selected Employee with applicable
   Contract/Structure IDs and exact Period.
6. Write `PAYRUN_CREATED` AuditLog.

Return 201 and the Payrun detail. Database uniqueness protects concurrent exact
Period duplicates; translate the race safely.

### `GET /api/v1/payroll/payruns`

Queries:

```text
search
salaryStructureId
status
periodStart
periodEnd
page
pageSize
sort=payrunNumber|periodStart|periodEnd|status|createdAt|netTotal
order
```

Default sort: `periodStart desc, createdAt desc, id asc`. Period filter returns
Payruns overlapping the supplied range.

### `GET /api/v1/payroll/payruns/:id`

Return full processing detail with Payslip summaries and warning counts.

No general PUT/PATCH or selection-edit endpoint exists. Workflow actions and
the restricted Draft discard below are the only updates.

### `DELETE /api/v1/payroll/payruns/:id`

- HR Payroll Manager/Admin only.
- Lock and require a strictly Draft Payrun with no Lines, Warnings, computation
  hash, or PDF bytes.
- Delete its Draft Payslips and Payrun in one transaction.
- Write `PAYRUN_DRAFT_DISCARDED` AuditLog with the former ID/number/Period and
  selected Employee IDs; the audit row remains after deletion.
- Computed/Validated/Paid returns `PAYRUN_DISCARD_FORBIDDEN`.

## 16. API - Processing Actions

Register named action routes before generic `/:id` handling where required.

### `POST /api/v1/payroll/payruns/:id/compute`

- Allowed only from Draft.
- Lock Payrun, child Payslips, and relevant mutation path.
- Revalidate all hard inputs and compute all Payslips in one transaction.
- Replace Lines/current Warnings, persist snapshots/hash/totals.
- Set every status Computed and actor/time.
- Write `PAYRUN_COMPUTED` and Payslip computation audit summaries.
- Return updated Payrun detail.

### `POST /api/v1/payroll/payruns/:id/recompute`

- Allowed only from Computed.
- Rerun from current source data for the complete Payrun.
- Delete/recreate Lines; resolve prior current warnings and create fresh Open
  warnings. Old acknowledgements remain historical but do not carry forward.
- Replace snapshots, hash, summaries, and computed actor/time.
- Keep status Computed.
- Write `PAYRUN_RECOMPUTED`.

### `POST /api/v1/payroll/warnings/:id/acknowledge`

- Allowed only while parent Payrun is Computed.
- Warning must be current Open and acknowledgeable.
- Store actor/time/reason transactionally and write
  `PAYROLL_WARNING_ACKNOWLEDGED`.
- Repeating the identical acknowledgement by ID returns current result without
  another audit row; attempting to replace acknowledgement is rejected.

### `POST /api/v1/payroll/payruns/:id/validate`

Inside one transaction:

1. Lock/reread Payrun and children.
2. Require Computed.
3. Rebuild and compare each computation input hash.
4. Reject Open blocking Warnings.
5. Verify every Payslip/Line/summary invariant.
6. Generate each final PDF from persisted snapshots and Lines.
7. Store PDF bytes and SHA-256 hash.
8. Set Payrun/Payslips Validated with actor/time.
9. Write validation AuditLog events.

If PDF generation or any check fails, no status/PDF changes commit.

### `POST /api/v1/payroll/payruns/:id/mark-paid`

- Lock/reread and require Validated.
- Set parent and all children Paid with actor/time in one transaction.
- Do not recompute, regenerate PDFs, or initiate a transfer.
- Write `PAYRUN_MARKED_PAID`.

### `POST /api/v1/payroll/payruns/:id/send-payslips`

Not implemented in Phase 8. Do not create a placeholder success endpoint.

## 17. API Slip API and PDF

### `GET /api/v1/payroll/payslips`

Queries:

```text
search
payrunId
employeeId
department
salaryStructureId
status
periodStart
periodEnd
warningType
page
pageSize
sort=employee|periodStart|status|grossAmount|netAmount
order
```

Default sort: `periodStart desc, employeeNameSnapshot asc, id asc`.

### `GET /api/v1/payroll/payslips/:id`

Return complete snapshot, ordered Lines, and Warning history.

### `GET /api/v1/payroll/payslips/:id/pdf`

- Draft: return conflict; no values exist.
- Computed: generate an unstored live preview from current persisted computed
  snapshot/Lines. Add visible `PREVIEW - NOT VALIDATED` watermark and
  `Cache-Control: no-store`.
- Validated/Paid: return stored PDF bytes only; never regenerate.
- Headers: `Content-Type: application/pdf`, safe filename, inline/download
  behavior from `?download=true`.

Required final PDF content:

- PeoplePay360/company heading and `Payslip` title;
- Payrun number and Period;
- Employee number/name, Department, job position;
- Contract number and Salary Structure;
- expected/worked days and worked/overtime hours;
- ordered salary lines with category/code/name/amount;
- Basic, Allowance, Overtime, Deduction, Gross, and Net summaries;
- currency and generated/validated timestamp;
- masked bank information;
- acknowledgement note indicator when blocking warnings were acknowledged;
- no internal IDs, stack traces, full bank number, private contact data, or
  unresolved template placeholders.

Use existing `pdfkit`. Do not add a second PDF library. Keep layout generation
in a pure/testable service returning `Buffer`.

## 18. Public Errors

Use the standard API envelope and stable codes:

| HTTP | Code | Meaning |
| ---: | --- | --- |
| 400 | `INVALID_PAYROLL_INPUT` | Invalid body/query/path |
| 400 | `INVALID_PAYROLL_PERIOD` | Date format/order/range/future end invalid |
| 401 | existing auth code | Not signed in |
| 403 | `PAYROLL_ACCESS_DENIED` | Role cannot access payroll |
| 404 | `PAYRUN_NOT_FOUND` | Payrun unavailable/missing |
| 404 | `PAYSLIP_NOT_FOUND` | Payslip unavailable/missing |
| 404 | `PAYROLL_WARNING_NOT_FOUND` | Warning unavailable/missing |
| 409 | `PAYROLL_INVALID_TRANSITION` | Workflow state/action mismatch |
| 409 | `PAYSLIP_PERIOD_DUPLICATE` | Employee already has exact Period Payslip |
| 409 | `PAYROLL_COMPUTATION_STALE` | Source inputs changed after Compute |
| 409 | `PAYROLL_WARNING_ALREADY_ACKNOWLEDGED` | Acknowledgement replacement attempted |
| 409 | `PAYRUN_DISCARD_FORBIDDEN` | Payrun is no longer an uncomputed Draft |
| 422 | `PAYROLL_EMPLOYEE_INELIGIBLE` | Selected Employee fails eligibility |
| 422 | `PAYROLL_CONTRACT_INVALID` | Missing/multiple/partial Contract |
| 422 | `PAYROLL_STRUCTURE_MISMATCH` | Contract/Payrun Structure differs |
| 422 | `PAYROLL_STRUCTURE_INVALID` | Active Rules cannot produce required outputs |
| 422 | `PAYROLL_SCHEDULE_MISSING` | Schedule cannot resolve |
| 422 | `PAYROLL_NO_EXPECTED_WORKING_DAYS` | Period has zero expected days |
| 422 | `PAYROLL_FORMULA_FAILED` | Rule evaluation failed safely |
| 422 | `PAYROLL_NEGATIVE_TOTAL` | GROSS or NET is negative |
| 422 | `PAYROLL_BLOCKING_WARNINGS` | Open blocking Warnings prevent Validate |
| 500 | `PAYSLIP_PDF_GENERATION_FAILED` | PDF failed; validation rolled back |

Include safe Employee/Rule/date fields where useful. Never expose formula stack
traces, SQL/Prisma errors, full bank data, PDF bytes in JSON, or inaccessible IDs.

## 19. Backend Organization

Create:

```text
apps/api/src/modules/payroll/
  payroll-calculation.ts
  payroll-input-hash.ts
  payroll-warning.ts
  payroll.mapper.ts
  payroll.schemas.ts
  payroll.routes.ts
  eligibility.service.ts
  payrun.controller.ts
  payrun.service.ts
  payslip.controller.ts
  payslip.service.ts
  payslip-pdf.service.ts
  index.ts
```

Tests:

```text
apps/api/tests/payroll-calculation.test.ts
apps/api/tests/payroll.test.ts
apps/api/tests/payslip-pdf.test.ts
```

Reuse Phase 4 Formula Engine, Phase 5 Contract/Schedule resolution, Phase 6
company date utilities, and Phase 7 Time Off snapshots. Do not duplicate their
logic or query through frontend-oriented APIs.

## 20. Audit Requirements

Required actions:

```text
PAYRUN_CREATED
PAYRUN_DRAFT_DISCARDED
PAYRUN_COMPUTED
PAYRUN_RECOMPUTED
PAYROLL_WARNING_ACKNOWLEDGED
PAYRUN_VALIDATED
PAYRUN_MARKED_PAID
```

Audit stores actor, entity type/ID, action, safe summary before/after, warning
reason when applicable, and UTC timestamp. Do not store full Payslip PDFs,
bank numbers, every formula input, or Employee private data in AuditLog.

Every action and its audit rows commit together. Idempotent no-op repeats do not
append duplicate audit events.

## 21. Frontend Routes and Behavior

Create/connect:

```text
/payroll/payruns
/payroll/payruns/new
/payroll/payruns/:id
/payroll/payslips
/payroll/payslips/:id
```

Register `/new` before `/:id`. Payroll navigation is visible only to HR Payroll
User, HR Payroll Manager, and Admin.

### Payrun list

- Real API data only; no local mock Payruns.
- Columns: Payrun, Structure, Period, Payslips, Status, Warnings, Gross, Net.
- Preserve search/filter/sort/page in URL.
- New opens the wizard route.
- Payroll Manager/Admin may Discard an uncomputed Draft after confirmation.
- Historical Validated/Paid rows remain visible and open read-only.
- Include loading, Retry, empty dataset, and filtered-empty states.

### Two-step wizard

Step 1:

- Select active Salary Structure and Period.
- Continue calls eligibility only; it creates nothing.

Step 2:

- Show eligible and ineligible Employees with Contract start, wage, expected
  weekly hours, and explicit ineligibility reasons.
- Only eligible rows have selectable checkboxes.
- Preserve selection while filtering the current eligibility result.
- Create Payrun requires at least one selection, disables while pending, and
  posts once.
- On success navigate to `/payroll/payruns/:id`.
- Back returns to Step 1 without server mutation.

### Payrun processing

- Header: number/name, Structure, Period, status, actor timestamps.
- Actions visible only when legal: Compute, Recompute, Validate, Mark Paid.
- Send Payslips is disabled/hidden with no fake success until its later phase.
- Summary table shows Employee, worked/expected days, warning state, Gross,
  Net, and status.
- Expand/open a Payslip for Lines and warnings.
- Warning acknowledgement requires reason and confirmation.
- After any action, replace state from server and invalidate list/detail queries.
- Show action-level errors without losing the current review state.

### Global Payslip list/detail

- List is independent of a parent Payrun and supports Period/Employee/status/
  warning filters.
- Detail shows immutable snapshots, component summaries, ordered Lines, and
  Warning history.
- Decimal strings are formatted with `Intl.NumberFormat`; never converted for
  arithmetic.
- Print Payslip opens/downloads the PDF endpoint.
- Computed preview is visibly watermarked; Validated/Paid PDF uses stored bytes.
- Validated/Paid detail has no edit/recompute controls.

## 22. Seed Data

Extend seeds after all Phase 2-7 fixtures.

Create idempotent representative records:

- Draft Payrun with two selected Employees.
- Computed Payrun with component Lines and at least one Open warning.
- Computed Payrun with an Acknowledged blocking warning.
- Validated Payrun with stored final PDFs and hashes.
- Paid historical Payrun.
- Fixed, Percentage, and Formula Lines.
- Paid and unpaid Time Off effects.
- Present, Late, Absent, missing Attendance, overtime, and open Attendance cases.

Prefer invoking shared computation/PDF helpers where safe. If final state is
seeded directly, use fixed IDs/numbers and internally consistent snapshots,
hashes, totals, warning metadata, and bytes. Rerunning seed must not consume new
sequence values or duplicate exact Employee/Period Payslips.

Never use fake dashboard aggregates; later reporting must derive from these
real records.

## 23. Automated Tests

### Eligibility and creation

- Continue/eligibility performs zero writes and consumes no number sequence;
- active Employee with exact Contract/Structure/Schedule is eligible;
- every ineligibility reason is covered;
- duplicate exact-period Payslip is shown ineligible and database-rejected;
- selected Employees are revalidated inside create transaction;
- concurrent creation yields one success and one safe duplicate conflict;
- selected IDs are unique, limited, and only selected Employees get Payslips;
- failed child/audit creation rolls back the entire Payrun.
- only Manager/Admin can discard Draft; discard frees exact-Period uniqueness;
- Computed/Validated/Paid discard is always rejected;

### Day/hour aggregation

- expected dates follow Schedule weekdays and inclusive Period;
- Present/Late contribute one, Absent contributes zero;
- paid leave contributes one without Attendance;
- unpaid leave contributes zero without warning;
- missing data contributes zero and creates warning;
- Attendance wins over leave and creates conflict warning;
- open Attendance contributes day but creates warning;
- non-expected Attendance adds worked/overtime minutes, not Worked Days;
- daily stored overtime sums without cross-day cancellation;
- zero expected days hard-fails;
- host timezone does not alter business dates.

### Decimal/Rule calculation

- wage proration uses Decimal only;
- Fixed, Percentage, and Formula methods execute in sequence;
- each result rounds half-up at Rule boundary and later Rules use rounded value;
- all category summaries reconcile with stored Lines;
- exactly one Gross/Net and at least one Basic are required;
- formula failure and negative Gross/Net roll back all Payslips;
- no JS `number` arithmetic handles salary/Decimal hours.

### Warnings/workflow

- correct warning type/policy/details generated;
- acknowledgement requires role/reason and cannot alter source data;
- Recompute resolves old warnings and opens fresh ones without carrying ack;
- Open blocking warning prevents Validate; acknowledged blocking allows it;
- stale source hash prevents Validate;
- invalid transitions and skips/reversals conflict;
- idempotent repeated Validate/Mark Paid does not duplicate audit/mutations;
- parent/child statuses always match;
- Validated/Paid records reject all recomputation/mutation.

### PDF and persistence

- preview is generated but not stored and contains watermark;
- Validate stores non-empty valid `%PDF` bytes and matching SHA-256 hash;
- final PDF contains required snapshot text and omits sensitive/internal data;
- one PDF failure rolls back all validation/PDF/status changes;
- Validated/Paid endpoint returns stored identical bytes after source edits;
- Mark Paid changes only status/actor/time and not financial/PDF hashes.

### RBAC/UI regression

- Employee and HR Manager are denied all Payroll routes;
- Payroll User, Payroll Manager, and Admin follow the matrix;
- wizard creates nothing before final confirmation;
- UI contains no payroll sample totals/Payslips;
- all earlier phase tests remain passing.

## 24. Exact Implementation Order

1. Verify Phases 2-7 migrations, Formula Engine, seeds, and full tests.
2. Add shared Payroll enums, schemas, inputs, DTOs, and exports.
3. Add Prisma models/relations/sequence and migration checks.
4. Apply migration to development/test databases; regenerate Prisma Client.
5. Implement pure day aggregation, Rule execution, rounding, warning, and hash
   helpers with unit tests.
6. Implement eligibility preview and reasons without writes.
7. Implement transactional Payrun/Payslip creation and concurrency tests.
8. Implement restricted Draft discard and audit tests.
9. Implement Compute/Recompute with complete rollback tests.
10. Implement warning acknowledgement and policy tests.
11. Implement PDF renderer and content/security tests.
12. Implement Validate with hash/warning/PDF atomicity.
13. Implement Mark Paid and immutability tests.
14. Implement list/detail/PDF APIs and RBAC.
15. Extend seeds idempotently.
16. Build Payrun list and two-step wizard.
17. Build processing screen and warning interactions.
18. Build global Payslip list/detail and PDF actions.
19. Run full verification and manual end-to-end payroll scenario.
20. Append one Branch Updates tracker entry; do not edit tracker summaries.

## 25. Verification

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

Manual verification:

1. Open New Payrun, set Structure/Period, and confirm Continue writes nothing.
2. Verify eligible/ineligible Employees and reasons, select a subset, create.
3. Compute and inspect day totals, Lines, Decimal summaries, and warnings.
4. Correct one source and Recompute; confirm old warning resolves and values
   refresh.
5. Acknowledge a permitted blocking warning with reason.
6. Modify a source after Compute and confirm Validate reports stale calculation.
7. Recompute, Validate, and confirm every final PDF is stored/downloadable.
8. Edit source Employee/Contract/Rules and confirm validated detail/PDF remains
   unchanged.
9. Mark Paid and confirm no monetary or PDF value changes.
10. Attempt duplicate Employee/exact Period payroll and confirm safe rejection.
11. Verify Payroll User/Manager/Admin access and Employee/HR Manager denial.

## 26. Definition of Done

- [ ] Migration, indexes, uniqueness, checks, and number sequence apply cleanly.
- [ ] Wizard preview creates nothing and final creation is transactional.
- [ ] Eligibility strictly enforces Contract, Structure, Schedule, and duplicate rules.
- [ ] Day/hour/Time Off aggregation matches architecture invariants.
- [ ] Salary Rules drive every stored Line using Decimal-safe ordered execution.
- [ ] Warnings are typed, reviewable, acknowledgeable only by policy, and tested.
- [ ] Compute/Recompute/Validate/Paid transitions and audit are atomic/idempotent.
- [ ] Stale inputs cannot be validated.
- [ ] Validated/Paid snapshots and PDFs are immutable.
- [ ] Payrun/Payslip frontend uses real APIs with no mock payroll data.
- [ ] Seeds cover Draft, Computed, Validated, Paid, warnings, and formulas.
- [ ] Earlier tests, migrations, seed, typecheck, build, and full tests pass.

## 27. Non-Negotiables

- Do not create a Payrun during wizard Step 1/Continue.
- Do not trust preview eligibility at final creation; revalidate transactionally.
- Do not select partial-period Contracts or substitute Structures/Schedules.
- Do not permit duplicate Employee/exact Period Payslips.
- Do not use JavaScript floating-point arithmetic for salary or Decimal hours.
- Do not hardcode salary Lines; active Salary Rules must generate them.
- Do not execute Formula data with `eval`, `Function`, or JavaScript execution.
- Do not convert missing Attendance into Absent.
- Do not let short days cancel overtime from other days.
- Do not treat warnings as statuses or hard failures as acknowledgeable warnings.
- Do not validate stale calculations or Open blocking warnings.
- Do not mutate/recompute/regenerate finalized payroll or PDFs.
- Do not mark Paid through a real payment integration in this phase.
- Do not expose full bank details, raw SQL/Prisma errors, or PDF bytes in JSON.
- Do not implement fake Send Payslips success or dashboard data.
- Do not delete Computed, Validated, or Paid Payruns/Payslips, and never delete
  historical Lines, Warnings, PDFs, or AuditLogs. Only the explicitly permitted
  uncomputed Draft discard may remove Draft Payrun/Payslip rows.
