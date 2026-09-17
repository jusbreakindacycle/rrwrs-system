import { assertQuantity, peso, proportionalCentavos } from '../domain/money'
import type { Sale } from '../domain/types'
import { createSale, type SaleItemInput } from '../services/sales'
import { operationChoices } from '../services/queries'
import { useCommandForm, useLocalQuery } from '../hooks/local'
import { FormFeedback } from './FormFeedback'

function preview(price: number, quantity: number) {
  try { assertQuantity(quantity); return proportionalCentavos(price, Math.round(quantity * 1000), 1000) } catch { return 0 }
}

export function QuickSale({ businessId, locationId }: { businessId: string; locationId: string }) {
  const choices = useLocalQuery(() => operationChoices(businessId, locationId), [businessId, locationId])
  const form = useCommandForm(`sale:${locationId}`, { productId: '', accountId: '', quantity: '1', cart: [] as (SaleItemInput & { name: string; price: number })[] })
  const { data, change } = form
  const products = choices.value?.products ?? [], accounts = choices.value?.accounts ?? []
  const selected = products.find(p => p.id === (data.productId || products[0]?.id))
  const accountId = data.accountId || accounts[0]?.id || ''
  const item = selected ? { productId: selected.id, quantity: Number(data.quantity), expectedVersion: selected.version ?? 1, expectedPriceCentavos: selected.priceCentavos, name: selected.name, price: selected.priceCentavos } : undefined
  const total = data.cart.length ? data.cart.reduce((sum, l) => sum + preview(l.price, l.quantity), 0) : item ? preview(item.price, item.quantity) : 0
  const displayedTotal = form.saved ? (form.result as Sale | undefined)?.totalCentavos ?? 0 : total
  return <section className="panel sale-panel">
    <div className="panel-head"><h2>Quick sale</h2><span>Local commit first</span></div>
    <FormFeedback error={choices.error || form.error} message={form.message} />
    {!products.length && <p>Add an active product in Manage before recording sales.</p>}
    <form onSubmit={e => { e.preventDefault(); void form.submit(async (draft, commandId) => {
      const lines = draft.cart.length ? draft.cart : item ? [item] : []
      return createSale({ businessId, locationId, commandId, lines: lines.map(l => ({ productId: l.productId, quantity: l.quantity, expectedVersion: l.expectedVersion, expectedPriceCentavos: l.expectedPriceCentavos })), paymentAccountId: accountId })
    }, 'Sale saved locally. Cloud sync is disabled. Start a new sale for the next customer.') }}>
      <fieldset disabled={form.disabled}>
        <label>Item<select value={selected?.id ?? ''} onChange={e => change({ productId: e.target.value })}>{products.map(p => <option key={p.id} value={p.id}>{p.name} — {peso(p.priceCentavos)}</option>)}</select></label>
        <label>Quantity <span className="hint">{selected?.unitLabel}</span><input required type="number" min="1" step={selected?.baseUnit === 'kg' ? '.001' : '1'} value={data.quantity} onChange={e => change({ quantity: e.target.value })} /></label>
        <button type="button" onClick={() => { if (item && Number.isFinite(item.quantity) && item.quantity >= 1) change({ cart: [...data.cart, item], quantity: '1' }) }} disabled={!selected}>Add to basket</button>
        {data.cart.length > 0 && <div className="rows" aria-label="Sale basket">{data.cart.map((l, i) => <div className="row" key={i}><span>{l.quantity} × {l.name}<small>{peso(preview(l.price, l.quantity))}</small></span><button type="button" aria-label={`Remove ${l.name}`} onClick={() => change({ cart: data.cart.filter((_, index) => index !== i) })}>Remove</button></div>)}<p className="hint">Only basket items will be finalized. Add the selected item to include it.</p></div>}
        <label>Paid via<select value={accountId} onChange={e => change({ accountId: e.target.value })}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <div className="sale-total"><span>{form.saved ? 'Recorded total' : 'Total'}</span><strong>{peso(Number.isFinite(displayedTotal) ? displayedTotal : 0)}</strong></div>
        <button className="primary" disabled={!selected || !accountId}>{form.busy ? 'Saving…' : 'Finalize sale'}</button>
      </fieldset>
    </form>
    {form.saved && <button className="primary" onClick={() => form.reset()}>New sale</button>}
    <p className="microcopy">Fully paid sales only. Cash requires an open drawer in Ops. Finalized sales are read-only. Prices are checked again when saved.</p>
  </section>
}
