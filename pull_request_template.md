## Feature

- Feature spec: `context/feature-spec/<file>.md`
- Spec status: APPROVED
- Branch owner:
- Roadmap phase/unit:

## Outcome

Describe what now works for the user or system.

## Scope Check

- [ ] Implementation matches the approved feature spec.
- [ ] No unrelated feature or refactor is included.
- [ ] Any spec change was approved and documented before code changed.
- [ ] File-ownership boundaries were respected.

## Data and Integrity

- [ ] Prisma migration is committed and reviewed, or no migration was required.
- [ ] Development and test database migrations were applied successfully.
- [ ] Database constraints back critical uniqueness/integrity rules.
- [ ] Money uses Decimal, durations use integer minutes, and dates follow the architecture.
- [ ] Multi-record operations are transactional/idempotent where required.
- [ ] Historical/finalized records remain protected.

## Security and Permissions

- [ ] Inputs are validated with Zod.
- [ ] Authentication, role authorization, and record ownership are enforced by the API.
- [ ] Safe API errors are returned; internal errors/secrets are not exposed.
- [ ] Sensitive mutations are audited where required.

## Verification

List the exact results; do not check commands that were not run.

- [ ] `npm run prisma:generate`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] Feature-specific automated tests:
- [ ] Manual end-to-end verification:

## UI Evidence

Add screenshots for changed UI, or write `Not applicable`.

## Progress and Documentation

- [ ] Feature branch appended one unique `Branch Updates` entry only.
- [ ] Relevant context/spec documentation is current.
- [ ] Main-branch summary reconciliation is left to the integrator.

## Assumptions / Open Issues

List remaining limitations or write `None`.
