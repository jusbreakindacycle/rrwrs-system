# Future Module Contract

Future modules must reuse shared primitives instead of cloning them.

## Laundry module may add
- service order
- kilograms/pieces
- service type
- received/processing/ready/released states
- claim/release reference

## Coffee module may add
- recipe/BOM
- ingredient consumption
- sizes/modifiers
- wastage
- prepared-item sales

Neither module should require redesigning payment accounts, owner money, cash sessions, expense, audit or synchronization primitives.
