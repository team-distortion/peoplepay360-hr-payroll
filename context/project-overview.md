# Project Overview

## About the Project

Many basic HR tools store employee details, attendance, leave, and salary data as 
separate records. Real HR and payroll teams need these records to work together. An 
employee may have multiple contracts over time, but payroll must use the contract that 
applies to the payroll period. Working hours come from an assigned schedule, attendance 
contains exceptions that may need review, leave balances depend on allocations and 
approved requests, and payroll must transform all of that into understandable payslips 
before payment. 


---

## The Problem It Solves

The goal of this project is to build an HR and Payroll platform that goes beyond simple 
employee CRUD screens and becomes a connected operational flow. The Employee 
record acts as the central hub, related Contracts and Working Schedules provide payroll 
context, Attendance and Time Off capture day-to-day HR activity, Salary Structures and 
Rules define salary computation, and Payruns turn eligible employee records into 
validated payslips that can be printed as PDF and sent to employees. 
Teams are free to use any programming language, framework, or database technology to 
build this solution. The focus is on the business logic, data relationships, payroll 
calculation flow, and end-to-end user experience, not on any specific platform or vendor. 

---

## Pages

```
/                              → Landing (redirects to /login or /dashboard)
/login                         → Auth page

/dashboard                     → Payroll Dashboard: KPIs, salary/attendance charts, alerts

/employees                     → Employee list (Kanban + List views)
/employees/[id]                → Employee form (the hub) — smart buttons to Contracts, Attendance, Time Off, Allocations

/contracts                     → Global contract list (dates, wage, active status)
/contracts/[id]                → Contract form (duration, department, position, wage, salary structure)

/schedules                     → Working schedule list (name, type, weekly hours)
/schedules/[id]                → Schedule form (day/start/end/break grid, auto-computed weekly hours)

/attendance                    → Global attendance list (check-in/out, worked hours, status)
/attendance/[id]               → Attendance form (manual correction, restricted to authorized users)

/time-off/requests             → Time off request list (employee, type, dates, status)
/time-off/requests/[id]        → Request form (approve/refuse workflow)
/time-off/allocations          → Allocation list (balances: taken/remaining/validity)
/time-off/allocations/[id]     → Allocation form
/time-off/types                → Time off type config (units, approval rules, payroll integration)
/time-off/types/[id]           → Type form

/payroll/structures            → Salary structure list (rule count, employees, active status)
/payroll/structures/[id]       → Structure form (manage included rules + sequence)
/payroll/rules                 → Salary rule list (name, code, category, sequence)
/payroll/rules/[id]            → Rule form (fixed / percentage / formula computation)

/payroll/payruns               → Payrun list (historical + in-progress batches)
/payroll/payruns/new           → 2-step wizard: Step 1 scope+period → Step 2 employee selection
/payroll/payruns/[id]          → Payrun processing screen: Compute, Validate, Mark Paid, Send Payslips
/payroll/payslips              → Global payslip list
/payroll/payslips/[id]         → Payslip detail: rule breakdown (Basic/Allowances/Deductions/Gross/Net), Print PDF

/admin/users                   → User management (Admin role)
/admin/roles                   → Role & permission assignment


---

## Core User Flow

### Login & User Access  

- User accounts are created by an Admin, not via self-signup
- When creating a user, the Admin links the account to an employee record and assigns one or more roles
- Roles control which modules, records, and actions become visible after login
- A user cannot assign or elevate their own role
- Password reset, invitations, SSO are explicitly left as future enhancements, not required for the hackathon build

### Employee Hub (Central Record)

- Employees are viewable in both Kanban and List views
- Opening an employee shows their HR details and opens filtered views of related Contracts, Attendance, Time Off, and **Allocations**
- An employee can have multiple contracts over time
- Top nav is: **Employees ▾ · Contracts ▾ · Attendance · Time Off ▾ · Payroll** — Contracts and Attendance are reachable both globally from this bar and filtered from inside an employee

### Contracts

- Global Contracts list shows contract number, employee, start/end date, wage/month, and status (Running / Expired)
- History is retained, but the active **Running** contract must be visually obvious since payroll depends on it
- Payroll always resolves the one contract valid for the selected pay period

### Working Schedules

- Require List and Form views; clicking a row opens that schedule
- List surfaces name, calendar type, days/week, hours/week, company, status
- Form defines the weekly pattern (day, start/end time, optional break); **weekly hours are derived automatically, never entered manually**
- A schedule attaches to an Employee or a Contract, and is used by both Attendance and Payroll as the expected working time
- Shift work, flexible-time, and similar variants are left open to the builder

### Attendance

- Accessible globally or from an individual employee — when opened from an employee, only that employee's records show
- List captures check-in, check-out, worked hours, and status
- **Quick-action widget** *(mockup only)*: clicking a status icon opens a Check In/Check Out popup showing elapsed time; icon turns green once checked in. This is how an Employee logs their own attendance day-to-day
- Manual corrections to an entry are restricted to authorized users
- Attendance data feeds forward into reporting and the Payroll Dashboard

### Time Off

- Requests, Allocations, and Time Off Types are reached only via the **Time Off ▾** dropdown — no separate top-level pages for them
- Time Off Types define how each leave type behaves (unit, whether allocation is required, approval workflow); exact policies are left open
- An Allocation must be approved before its balance becomes available — this is what actually creates usable leave, not the Type itself
- Employee submits a Time Off Request themselves; List view supports a **"My Team"** filter and inline Approve/Refuse actions for managers
- Request detail form shows which specific Allocation the request draws from ("Allocation Used")
- On approval, the request automatically deducts from that linked Allocation

### Salary Structures & Salary Rules

- A Salary Structure is a named container (e.g. "Regular Salary") that groups Salary Rules; List view shows rule count, employee count, active status
- A Salary Rule has Name, Code, Category (Basic / Allowance / Gross / Deduction / Net), Sequence, and a computation method
- Rules run **in sequence** — a later rule (Net) can reference totals from an earlier one (Gross)
- Computation methods: Fixed Amount (exact value, e.g. Meal Allowance = 2,000), Percentage (of a selected base like Contract Wage/Basic/Gross, e.g. HRA = 20% × Basic), or Python Code/Formula (for attendance-based pay, overtime, unpaid-leave deductions, or cross-rule math)
- A Structure is attached at the Contract level, then re-selected as scope when creating a Payrun

### Payrun Creation (2-Step Wizard)

- Clicking **New** opens a popup collecting scope only — nothing is created yet
- Step 1: Pay Structure + Period (date range) → **Continue**
- Step 2: checkbox-select eligible employees from a filtered list (working hours, start date, wage shown per row) → **Create Payrun**
- A Payrun record is only created after this second step — Continue alone never creates one

### Payslip Computation

- Each selected employee gets one Payslip linked to the Payrun
- Computation uses that employee's applicable contract + the Payrun's assigned Salary Structure
- Payslip breaks down into Basic, Allowances, Deductions, Gross, and Net, each tied to the Salary Rule and Code that produced it

### Payrun Review & Validation

- Payrun processing screen has four actions: **Compute, Validate, Mark Paid, Send Payslips**
- Workflow states run **Draft → Compute → Validate → Mark Paid**
- Per-payslip warnings surface inline before finalization — e.g. missing bank/account details, duplicate payslip
- A global **Payslips** list also exists outside any single Payrun, filterable by period, for browsing across payruns

### Payslip Distribution & Archiving

- **Print Payslip** generates an individual PDF from either the Payrun or the Payslips list
- **Send Payslips** on the parent Payrun triggers bulk email delivery to the batch
- Paid/finalized Payruns remain available as historical records

### Payroll Dashboard

- Filters: **Period, Department, Employee Type, and Company** — all affect the data shown
- KPI cards: Total Net Salary Paid, Payslips Generated, Average Salary, Approved Time Off, Attendance Health
- Charts: Salary Cost by Department, Monthly Net Salary Trend
- Payslip Status legend: **Paid / Done / Pending / Warning**
- Operational alerts, e.g.: duplicate payslip warning, drafts still not validated, contracts expiring this month
- Attendance/Time Off overview: present, late, absent, overtime, pending requests, leave balances
- Department breakdown combines headcount with total salary expenditure
- Underlying data to aggregate: Employees/Departments (headcount, grouping) · Contracts (wage, schedule, active employees) · Payruns/Payslips (totals, paid vs. pending, trend) · Attendance (presence, late, overtime) · Time Off (leave taken, balances) — all real data, not hardcoded

---
## Data Architecture

Note: neither source names a database or schema — PDF Section 7 explicitly leaves "backend language, frontend framework, and database technology" to the team. What follows is the entity/relationship structure actually specified across both documents, not a fixed schema.

### Core HR Entities
- **Employee** — central record; department, manager, job position, work location, status, and an assigned Working Schedule
- **Contract** — belongs to one Employee; an employee can hold multiple Contracts over time, but only one may be concurrently active ("Running" in the mockup); carries wage, duration, department, position, and an assigned Salary Structure
- **Working Schedule** — assignable to an Employee *or* a Contract; stores the weekly pattern (day/start/end/break); weekly hours are a derived field, never entered directly

### Attendance & Time Off
- **Attendance** — one record per employee per day: check-in, check-out, worked hours (derived), status; manual correction is a restricted action, not open to all users
- **Time Off Type** — defines leave behavior: unit (days/hours), whether allocation is required, approval workflow, payroll-integration flag
- **Allocation** — belongs to an Employee + Time Off Type; must be approved before its balance is usable; tracks taken/remaining/validity
- **Time Off Request** — belongs to an Employee, references a Type and (per mockup form) the specific Allocation it draws from; approval deducts from that Allocation

### Payroll Entities
- **Salary Rule** — Name, Code, Category (Basic/Allowance/Gross/Deduction/Net), Sequence, computation method (fixed / percentage / formula)
- **Salary Structure** — named ordered grouping of Salary Rules; attached at Contract level, then re-selected as scope on a Payrun
- **Payrun** — scope (Salary Structure + Period) + selected Employees; status flow **Draft → Compute → Validate → Mark Paid** (mockup workflow note); parent of Payslips
- **Payslip** — one per Employee per Payrun; resolves that employee's period-applicable Contract, runs the Payrun's Salary Structure rules against it, stores the resulting Basic/Allowances/Deductions/Gross/Net lines

### User & Access *(mockup only — not in PDF)*
- **User** — created by an Admin only, never self-registered; linked 1:1 to an Employee record; holds one or more Roles
- **Role** — controls module/record/action visibility; the five roles are the ones PDF Section 3 defines (Employee, HR Manager, HR Payroll User, HR Payroll Manager, Admin)

---

## Features In Scope

- Employee Master: Kanban + List + Form views, department/manager/schedule/position/status fields, smart-button links to related Contracts/Attendance/Time Off/Allocations
- Contract Management: historical records retained, active contract clearly highlighted, period-based contract resolution for payroll
- Working Schedule Setup: List + Form, auto-computed weekly hours, assignable to Employee or Contract
- Time Off Type, Allocation & Request lifecycle, with approval workflow and automatic balance deduction
- Salary Structure Setup: container of ordered Salary Rules, List + Form views
- Salary Rule Setup: Name/Code/Category/Sequence, fixed/percentage/formula computation methods
- Payroll Dashboard: live-data KPIs, charts, alerts, filterable by Period/Department/Employee Type
- Role-based permissions across Employee, HR Manager, HR Payroll User, HR Payroll Manager, Admin
- Payrun 2-step creation wizard (scope → employee selection), created only after final confirmation
- Payrun processing screen: Compute, Validate, Mark Paid, Send Payslips
- Payslip detail screen with full rule-by-rule computation breakdown
- Global Payslips list, independent of any single Payrun (PDF B7 confirms this, not mockup-only)
- Payslip PDF generation and bulk email delivery from the Payrun
- Admin-managed user accounts linked to employee records, with role assignment *(mockup only)*
- Attendance quick-action check-in/check-out widget with elapsed-time display *(mockup only)*
- "My Team" filter and inline Approve/Refuse on the Time Off Requests list *(mockup only)*
- Dashboard filter by Company, in addition to Period/Department/Employee Type *(mockup only)*

---

## Features Out of Scope / Deferred

Only one exclusion is explicitly stated:
- **Password reset, invitations, SSO** — mockup note calls these out by name as later enhancements, not required now

Everything below is *not mentioned in either document* — treat this as a reasonable inference from absence, not a stated exclusion:
- Recruitment/hiring, performance reviews, expense claims, or benefits administration modules
- Statutory compliance or tax-authority filing integrations
- Actual bank/payment-gateway transfer — "Mark Paid" changes a status field, no payment execution is described
- Employee self-registration (accounts are Admin-created per the mockup)
- Notifications or alerts beyond the Send Payslips email action
- Mobile app
- Multi-currency handling

---

## Historical Tracking & Auditability

Neither document names an analytics/event-tracking tool (nothing like PostHog appears anywhere) — Section 7 leaves this open along with the rest of the stack. What both sources do explicitly require retained as history:

- Finalized/paid Payruns "remain available as historical data" (mockup) / "preserved as historical records" (PDF B6)
- Expired contracts stay visible in the Contracts list rather than being removed (mockup: "retain contract history... make the active Running contract obvious")
- "Comprehensive historical payroll tracking" is named directly as a system-architecture goal (PDF Section 6)
- Attendance data must remain "usable later for reporting/dashboard insights" (mockup)

---

## Target Users (Roles)


- **Employee** — views own details, attendance, and leave balances; creates their own attendance entries and Time Off Requests; no HR or payroll administration access
- **HR Manager** — full CRUD on Employees, Attendance, Contracts, Working Schedules, Time Off; approves/refuses Time Off Requests; no payroll access
- **HR Payroll User** — all HR Manager permissions + Create/Read/Update on Payruns and Payslips; read-only on Salary Structures/Rules
- **HR Payroll Manager** — all HR Payroll User permissions + full CRUD on Payruns, Payslips, Salary Structures, Salary Rules
- **Admin** — full access to all modules, plus user management, role assignment, and system administration

---

## Success Criteria

- A fully operational platform populated with representative employee, contract, time, salary, and payroll data — not a static mockup
- A 5-minute live walkthrough covering two end-to-end scenarios: employee-to-payslip, and leave allocation-to-request
- A brief written summary of proposed future enhancements
- Payroll correctly resolves the period-applicable contract even when an employee has contract history
- Approved leave correctly consumes the linked Allocation's balance
- Salary Rules execute in sequence so later totals (Net) correctly build on earlier ones (Gross)
- Payroll issues (missing info, duplicate payslips) are surfaced to the user before finalization, not silently allowed through
- The Payroll Dashboard reflects real, live system data — explicitly not hardcoded values
- Payslip PDF generation and bulk email delivery both work from the Payrun