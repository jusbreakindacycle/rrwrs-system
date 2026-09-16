# Tax / Compliance Boundary

The system is designed as an internal operational record and management tool.

It may store internal transaction references, manual invoice/reference numbers, sales summaries, purchases, expenses, owner-money movements and accountant exports.

It must not claim that its internal receipt/screen is an official BIR invoice or that its internal ledgers are registered books unless the owner separately completes the applicable registration/compliance process and the product is explicitly upgraded for that scope.

Compliance items use fields such as `authority`, `source_reference`, `last_verified_at`, `effective_from`, `effective_to`, and `status` so changing rules can be maintained without code changes.

## Financial classification invariants

- Owner capital is contribution/equity, not sales revenue.
- Owner withdrawal is a draw, not operating expense.
- Account transfer has matching account legs and is neither income nor expense.
- Inventory acquisition is a purchase/stock-value increase, not utilities/misc expense.
- Abono: one legitimate expense + owner payable; no store-cash reduction. Later
  reimbursement reduces payable and the paying account, with no second expense.
- Split payments sum to a single sale: ₱700 paid ₱500 GCash + ₱200 cash remains ₱700.
- Cash expected = opening + cash inflows − purchases/expenses/authorized outflows;
  variance = actual − expected. Retain shortages and overages, with review history.
- Show Estimated Gross Profit with its costing assumptions. Do not label it Net
  Profit or imply complete accounting profit from partial operating records.

This document states product boundaries, not legal advice or a list of current
government requirements. Actual permit/testing schedules are owner-maintained,
source-referenced configuration, with last-verification dates.
