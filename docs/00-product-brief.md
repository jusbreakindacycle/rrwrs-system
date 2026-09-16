# Product Brief v0.1

## Goal
Give small owner-run businesses one practical system for daily operations while preserving each business type's real workflow. Water and rice share the money, permissions, reporting, audit, purchasing, and synchronization foundations; their inventory and service rules remain separate.

## Primary users
1. **Owner** — sees all authorized businesses and locations, approves corrections, maintains pricing/master data, reviews cash and exceptions.
2. **Store Operator** — one primary encoder at a location. Can perform daily work but cannot silently rewrite finalized history.

## Platforms and present stage

Android phones/tablets, Windows laptops/desktops and modern browsers. Remain a
web application and installable PWA; normal local operations cannot require cloud.
The current M0 practice workspace is explicitly demo-only. Provisioning and remote
owner monitoring are later milestones, not implied by the combined local dashboard.

## Initial businesses
- Water refilling station
- Rice retail / bigasan

## Future modules
- Laundry
- Coffee shop

Future modules plug into the shared core. They do not inherit rice or water-specific assumptions.

## Product principles
- Offline sale is a first-class happy path, not an error mode.
- Finalized financial history is append-only; corrections create reversals/adjustments.
- Current stock is derived from stock movements, never edited as a naked number.
- Payment method is not revenue. Sales, payment accounts, expenses, transfers, and owner money are different concepts.
- Low-friction store UX beats accounting jargon.
- Compliance data is configurable and source-aware; changing government rules are not hard-coded as eternal truths.
- Internal operations first; BIR-regulated POS/accounting scope is a separate future project.

## Success definition
A store operator can complete a normal day without internet, and the owner can later see synchronized, auditable results without reconstructing the day from notebooks, screenshots, or chat messages.
