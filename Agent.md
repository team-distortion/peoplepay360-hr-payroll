## Application Building Context

Read the following files in order before implementing
or making any architectural decision:

1. `context/project-overview.md` — product definition,
   goals, features, and scope
2. `context/architecture.md` — system structure,
   boundaries, storage model, and invariants
3. `context/schema-roadmap.md` — current schema fitness,
   target domains, relationships, and migration order
4. `context/ui-context.md` — theme, colors, typography,
   and component conventions
5. `context/code-standards.md` — implementation rules
   and conventions
6. `context/ai-workflow-rules.md` — development workflow,
   scoping rules, and delivery approach
7. `context/development-workflow.md` — branch, feature-spec,
   verification, PR, merge, and parallel-work process
8. The exact approved feature spec named in the task — do not
   select a different spec or implement from a roadmap alone
9. `context/progress-tracker.md` — current phase,
   completed work, open questions, and next steps

Update `context/progress-tracker.md` after each meaningful
implementation change. On a feature branch, only append a uniquely
identified entry under `Branch Updates`; the main-branch integrator
owns the mutable summary sections.

If implementation changes the architecture, scope, or
standards documented in the context files, update the
relevant file before continuing.
