import { useState } from 'react'
import { db } from '../db/database'
import { peso, toCentavos } from '../domain/money'
import { calculateExpectedCash, closeCashSession, expenseCategories, openCashSession, receiveStock, recordExpense } from '../services/operations'
import { operationChoices } from '../services/queries'
import { useCommandForm, useLocalQuery } from '../hooks/local'
import { FormFeedback } from './FormFeedback'

type Scope = { businessId: string; locationId: string }
type Choices = Awaited<ReturnType<typeof operationChoices>>
type Props = Scope & { choices: Choices }

export function Operations(scope: Scope) {
  const [mode, setMode] = useState('stock')
  const choices = useLocalQuery(() => operationChoices(scope.businessId, scope.locationId), [scope.businessId, scope.locationId])
  return <div className="stack-lg"><div className="segment">
    <button className={mode === 'stock' ? 'active' : ''} onClick={() => setMode('stock')}>Receive stock</button>
    <button className={mode === 'expense' ? 'active' : ''} onClick={() => setMode('expense')}>Expense</button>
    <button className={mode === 'cash' ? 'active' : ''} onClick={() => setMode('cash')}>Cash close</button>
  </div><FormFeedback error={choices.error} message="" />
    {choices.value && mode === 'stock' && <ReceiveStock {...scope} choices={choices.value} />}
    {choices.value && mode === 'expense' && <ExpenseForm {...scope} choices={choices.value} />}
    {choices.value && mode === 'cash' && <CashDrawer {...scope} choices={choices.value} />}
  </div>
}

function ReceiveStock({ businessId, locationId, choices }: Props) {
  const products = choices.products.filter(p => p.inventoryTracked)
  const form = useCommandForm(`purchase:${locationId}`, { productId: '', accountId: '', quantity: '', cost: '', supplierId: '', reference: '', note: '' })
  const d = form.data, productId = d.productId || products[0]?.id || '', accountId = d.accountId || choices.accounts[0]?.id || ''
  const product = products.find(p => p.id === productId)
  return <section className="panel sale-panel"><div className="panel-head"><h2>Receive COD stock</h2><span>Paid purchase + inventory receipt</span></div>
    <FormFeedback error={form.error} message={form.message} />
    {!products.length && <p>Add an inventory item in Manage first.</p>}
    <form onSubmit={e => { e.preventDefault(); void form.submit(async (draft, commandId) => {
      await receiveStock({ businessId, locationId, commandId, productId, quantity: Number(draft.quantity), totalCostCentavos: toCentavos(Number(draft.cost)), paidFromAccountId: accountId, supplierId: draft.supplierId || undefined, reference: draft.reference, note: draft.note })
    }, 'Stock received locally. Purchase, payment and inventory were committed together.') }}><fieldset disabled={form.disabled}>
      <label>Inventory item<select value={productId} onChange={e => form.change({ productId: e.target.value })}>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Quantity received <span className="hint">{product?.unitLabel}; enter total base quantity</span><input required type="number" min={product?.baseUnit === 'kg' ? '.001' : '1'} step={product?.baseUnit === 'kg' ? '.001' : '1'} value={d.quantity} onChange={e => form.change({ quantity: e.target.value })} /></label>
      <label>Total supplier cost (₱)<input required type="number" min=".01" step=".01" value={d.cost} onChange={e => form.change({ cost: e.target.value })} /></label>
      <label>Supplier<select value={d.supplierId} onChange={e => form.change({ supplierId: e.target.value })}><option value="">Unspecified supplier</option>{choices.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Supplier receipt/reference<input maxLength={100} value={d.reference} onChange={e => form.change({ reference: e.target.value })} /></label>
      <label>Paid from<select value={accountId} onChange={e => form.change({ accountId: e.target.value })}>{choices.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>Purchase note<input maxLength={500} value={d.note} onChange={e => form.change({ note: e.target.value })} /></label>
      <div className="sale-total"><span>Purchase total</span><strong>{peso(Math.round(Number(d.cost) * 100))}</strong></div>
      <button className="primary" disabled={!productId || !accountId}>Receive stock</button>
    </fieldset></form>
    {form.saved && <button className="primary" onClick={() => form.reset()}>New receipt</button>}
    <p className="microcopy">Cash purchases require an open drawer. Inventory buying is separate from operating expenses. Supplier references protect against receiving the same receipt again.</p>
  </section>
}

function ExpenseForm({ businessId, locationId, choices }: Props) {
  const form = useCommandForm(`expense:${locationId}`, { category: 'Utilities', amount: '', accountId: '', ownerFunded: false, ownerId: '', note: '' })
  const d = form.data, accountId = d.accountId || choices.accounts[0]?.id || '', ownerId = d.ownerId || choices.owners[0]?.userId || ''
  return <section className="panel sale-panel"><div className="panel-head"><h2>Record expense</h2><span>Operating expense, not inventory</span></div>
    <FormFeedback error={form.error} message={form.message} />
    <form onSubmit={e => { e.preventDefault(); void form.submit(async (draft, commandId) => {
      await recordExpense({ businessId, locationId, commandId, category: draft.category, amountCentavos: toCentavos(Number(draft.amount)), fundedByOwner: draft.ownerFunded, paidFromAccountId: draft.ownerFunded ? '' : accountId, ownerId: draft.ownerFunded ? ownerId : undefined, note: draft.note })
    }, d.ownerFunded ? 'Expense saved as owner-funded abono; store cash was not reduced. Owner payable increased.' : 'Expense saved locally with its business payment.') }}><fieldset disabled={form.disabled}>
      <label>Category<select value={d.category} onChange={e => form.change({ category: e.target.value })}>{expenseCategories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Amount (₱)<input required type="number" min=".01" step=".01" value={d.amount} onChange={e => form.change({ amount: e.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={d.ownerFunded} onChange={e => form.change({ ownerFunded: e.target.checked })} /><span>Owner paid personally (abono)</span></label>
      {d.ownerFunded ? <label>Owner who paid<select value={ownerId} onChange={e => form.change({ ownerId: e.target.value })}>{choices.owners.map(o => <option key={o.userId} value={o.userId}>{o.displayName || o.userId}</option>)}</select></label> : <label>Payment account<select value={accountId} onChange={e => form.change({ accountId: e.target.value })}>{choices.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      <label>Note <span className="hint">required for Other</span><input maxLength={500} required={d.category === 'Other'} value={d.note} onChange={e => form.change({ note: e.target.value })} /></label>
      <button className="primary">Save expense</button>
    </fieldset></form>
    {form.saved && <button className="primary" onClick={() => form.reset()}>New expense</button>}
    <p className="microcopy">Abono creates an amount owed to the owner. Reimbursement is deferred to Milestone 6; never record it as another expense.</p>
  </section>
}

function CashDrawer({ businessId, locationId, choices }: Props) {
  const accounts = choices.accounts.filter(a => a.kind === 'cash')
  const [chosen, setChosen] = useState('')
  const accountId = chosen || accounts[0]?.id || ''
  const state = useLocalQuery(async () => {
    const sessions = await db.cashSessions.where('accountId').equals(accountId).filter(s => s.locationId === locationId && s.businessId === businessId).toArray()
    const session = sessions.find(s => s.status === 'open')
    return { session, expected: session ? await calculateExpectedCash(session) : undefined, closed: sessions.filter(s => s.status === 'closed').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? '')) }
  }, [accountId, businessId, locationId])
  return <section className="panel sale-panel"><div className="panel-head"><h2>Cash drawer</h2><span>Opening → expected → physical count</span></div>
    <label>Cash account<select value={accountId} onChange={e => setChosen(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    {!accounts.length && <p>Create a cash drawer for this location in Manage.</p>}
    <FormFeedback error={state.error} message="" />
    {state.value && accountId && (state.value.session ? <CloseDrawer key={state.value.session.id} sessionId={state.value.session.id} expected={state.value.expected!} opening={state.value.session.openingCentavos} /> : <OpenDrawer key={accountId} businessId={businessId} locationId={locationId} accountId={accountId} />)}
    <h3>Reconciliation history</h3>
    {!state.value?.closed.length && <p className="empty">No closed sessions yet.</p>}
    {state.value?.closed.map(s => <article className="history-entry" key={s.id}><b>{new Date(s.closedAt!).toLocaleString('en-PH')}</b><p>Expected {peso(s.expectedClosingCentavos ?? 0)} · Counted {peso(s.actualClosingCentavos ?? 0)}</p><p className={s.varianceCentavos ? 'stock-low' : 'stock-ok'}>Variance {peso(s.varianceCentavos ?? 0)}{(s.varianceCentavos ?? 0) < 0 ? ' · Shortage' : (s.varianceCentavos ?? 0) > 0 ? ' · Overage' : ' · Balanced'}</p><p>{s.note}</p></article>)}
  </section>
}

function OpenDrawer({ businessId, locationId, accountId }: Scope & { accountId: string }) {
  const form = useCommandForm(`cash-open:${accountId}`, { opening: '' })
  return <><FormFeedback error={form.error} message={form.message} /><form onSubmit={e => { e.preventDefault(); void form.submit(async (d, commandId) => { await openCashSession(businessId, accountId, toCentavos(Number(d.opening)), { locationId, commandId }) }, 'Cash session opened locally.') }}><fieldset disabled={form.disabled}><label>Opening cash (₱)<input required type="number" min="0" step=".01" value={form.data.opening} onChange={e => form.change({ opening: e.target.value })} /></label><button className="primary">Open cash session</button></fieldset></form>{form.saved && <button onClick={() => form.reset()}>Prepare new cash session</button>}</>
}

function CloseDrawer({ sessionId, opening, expected }: { sessionId: string; opening: number; expected: number }) {
  const form = useCommandForm(`cash-close:${sessionId}`, { actual: '', note: '' })
  const variance = Math.round(Number(form.data.actual) * 100) - expected
  return <><div className="cash-summary"><div><span>Opening</span><strong>{peso(opening)}</strong></div><div><span>Expected now</span><strong>{peso(expected)}</strong></div></div>
    <FormFeedback error={form.error} message={form.message} />
    <form onSubmit={e => { e.preventDefault(); void form.submit(async (d, commandId) => { await closeCashSession(sessionId, toCentavos(Number(d.actual)), { commandId, note: d.note }) }, 'Cash session closed locally.') }}><fieldset disabled={form.disabled}>
      <label>Actual cash counted (₱)<input required type="number" min="0" step=".01" value={form.data.actual} onChange={e => form.change({ actual: e.target.value })} /></label>
      {form.data.actual !== '' && <p>Variance {peso(variance)} · {variance < 0 ? 'Shortage' : variance > 0 ? 'Overage' : 'Balanced'}</p>}
      <label>Variance explanation<input required={variance !== 0} maxLength={500} value={form.data.note} onChange={e => form.change({ note: e.target.value })} /></label>
      <button className="primary">Close and reconcile</button>
    </fieldset></form><p className="microcopy">Count the drawer before closing. The count and variance are permanent; no automatic balance adjustment is created.</p></>
}
