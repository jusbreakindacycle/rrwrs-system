import { getInventory } from '../services/analytics'
import { operationChoices } from '../services/queries'
import { adjustStock } from '../services/stock'
import { peso, toCentavos } from '../domain/money'
import { useCommandForm, useLocalQuery } from '../hooks/local'
import { FormFeedback } from './FormFeedback'

export function Inventory({ businessId, locationId }: { businessId: string; locationId: string }) {
  const query = useLocalQuery(() => getInventory(businessId, locationId), [businessId, locationId])
  return <div className="stack-lg"><section className="panel"><div className="panel-head"><h2>Inventory position</h2><span>Derived from stock movements</span></div><FormFeedback error={query.error} message="" />
    {!query.value && !query.error && <p role="status">Reading inventory…</p>}
    {query.value?.length === 0 && <p className="empty">No inventory items in this scope. Refill services do not hold container stock.</p>}
    <div className="inventory-grid">{query.value?.map(({ product, location, onHand, valueCentavos, basis, ledger }) => <article className="stock-card" key={`${location.id}:${product.id}`}><span className="eyebrow">{product.category}</span><h3>{product.name}{product.active ? '' : ' · inactive'}</h3><small>{location.name}</small><strong>{onHand} <small>{product.unitLabel}</small></strong><div className={onHand <= product.lowStockThreshold ? 'stock-low' : 'stock-ok'}>{onHand <= product.lowStockThreshold ? 'Low stock' : 'In range'}</div><p className="hint">Stock value {peso(valueCentavos)}{onHand > 0 && ` · ${peso(Math.round(valueCentavos / onHand))}/${product.baseUnit}`}{basis === 'legacy_estimate' && onHand > 0 && ' · includes legacy estimate'}</p><details><summary>Movement ledger ({ledger.length})</summary>{ledger.map(m => <div className="history-entry" key={m.id}><b>{m.quantityDelta > 0 ? '+' : ''}{m.quantityDelta} · {m.reason}</b><small>{new Date(m.createdAt).toLocaleString('en-PH')}</small><p>{m.note}</p><small className="record-id">Reference {m.referenceId}</small></div>)}</details></article>)}</div>
    </section>{businessId !== 'all' && locationId !== 'all' && <Adjustment key={locationId} businessId={businessId} locationId={locationId} />}</div>
}

function Adjustment({ businessId, locationId }: { businessId: string; locationId: string }) {
  const choices = useLocalQuery(() => operationChoices(businessId, locationId), [businessId, locationId])
  const form = useCommandForm(`adjustment:${locationId}`, { productId: '', delta: '', cost: '', note: '' })
  const products = choices.value?.products.filter(p => p.inventoryTracked) ?? []
  const d = form.data, product = products.find(p => p.id === (d.productId || products[0]?.id))
  if (choices.value?.context.role !== 'owner') return null
  return <section className="panel sale-panel"><h2>Owner stock adjustment</h2><p className="microcopy">For witnessed opening stock or an explained manual change. Use receiving for paid inventory purchases. This adds a permanent movement; it does not alter existing history or move money.</p><FormFeedback error={choices.error || form.error} message={form.message} />
    <form onSubmit={e => { e.preventDefault(); void form.submit((v, commandId) => adjustStock({ businessId, locationId, commandId, productId: product?.id ?? '', quantityDelta: Number(v.delta), unitCostCentavos: Number(v.delta) > 0 ? toCentavos(Number(v.cost)) : undefined, note: v.note }), 'Explained adjustment saved in the stock ledger.') }}><fieldset disabled={form.disabled}>
      <label>Adjustment item<select value={product?.id ?? ''} onChange={e => form.change({ productId: e.target.value })}>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Quantity change <span className="hint">positive to add, negative to remove</span><input required type="number" step={product?.baseUnit === 'kg' ? '.001' : '1'} value={d.delta} onChange={e => form.change({ delta: e.target.value })} /></label>
      {Number(d.delta) > 0 && <label>Cost per added unit (₱)<input required type="number" min="0" step=".01" value={d.cost} onChange={e => form.change({ cost: e.target.value })} /></label>}
      <label>Adjustment reason<input required maxLength={500} value={d.note} onChange={e => form.change({ note: e.target.value })} /></label><button className="primary" disabled={!product}>Record permanent adjustment</button>
    </fieldset></form>{form.saved && <button onClick={() => form.reset()}>New adjustment</button>}</section>
}
