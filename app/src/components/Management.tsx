import { useState } from 'react'
import { db } from '../db/database'
import type { BusinessType, Location, PaymentAccount, Product, Supplier } from '../domain/types'
import { peso, toCentavos } from '../domain/money'
import { savePaymentAccount, saveProduct, saveSupplier } from '../services/catalog'
import { addBusiness, addLocation } from '../services/setup'
import { localContext, readableLocations } from '../services/local-context'
import { useCommandForm, useLocalQuery } from '../hooks/local'
import { FormFeedback } from './FormFeedback'

type Scope = { businessId: string; locationId: string }
export function Management(scope: Scope) {
  const [tab, setTab] = useState('products')
  const [selected, setSelected] = useState('')
  const query = useLocalQuery(async () => {
    const context = await localContext(scope.businessId, scope.locationId)
    return { context, business: (await db.businesses.get(scope.businessId))!, locations: await readableLocations(), products: await db.products.where('businessId').equals(scope.businessId).toArray(), accounts: await db.paymentAccounts.filter(a => a.workspaceId === context.workspaceId && (a.businessId === scope.businessId || a.businessId === 'shared')).toArray(), suppliers: await db.suppliers.where('businessId').equals(scope.businessId).toArray() }
  }, [scope.businessId, scope.locationId])
  const data = query.value
  if (query.error) return <FormFeedback error={query.error} message="" />
  if (!data) return <p>Opening management…</p>
  if (data.context.role !== 'owner') return <section className="panel">Catalog, account and store management requires the local owner profile.</section>
  return <div className="stack-lg"><div className="segment">{['products', 'accounts', 'suppliers', 'stores'].map(t => <button key={t} className={t === tab ? 'active' : ''} onClick={() => { setTab(t); setSelected('') }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
    {tab === 'products' && <><section className="panel"><h2>Products and services</h2><label>Manage item<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Create product/service</option>{data.products.map(p => <option key={p.id} value={p.id}>{p.name} · {peso(p.priceCentavos)}{p.active ? '' : ' · inactive'}</option>)}</select></label></section><ProductForm key={selected || 'new'} {...scope} product={data.products.find(p => p.id === selected)} locations={data.locations.filter(l => l.businessId === scope.businessId)} type={data.business.type} /></>}
    {tab === 'accounts' && <><section className="panel"><h2>Payment accounts</h2><label>Manage account<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Create payment account</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.kind}{a.active ? '' : ' · inactive'}</option>)}</select></label></section><AccountForm key={selected || 'new'} {...scope} account={data.accounts.find(a => a.id === selected)} locations={data.locations} /></>}
    {tab === 'suppliers' && <><section className="panel"><h2>Suppliers</h2><label>Manage supplier<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Create supplier</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.active ? '' : ' · inactive'}</option>)}</select></label></section><SupplierForm key={selected || 'new'} {...scope} supplier={data.suppliers.find(s => s.id === selected)} /></>}
    {tab === 'stores' && <StoreForm {...scope} />}
  </div>
}

function Availability({ locations, ids, change }: { locations: Location[]; ids: string[]; change: (ids: string[]) => void }) {
  return <div className="availability"><b>Available at</b>{locations.filter(l => l.active).map(l => <label className="check" key={l.id}><input type="checkbox" checked={ids.includes(l.id)} onChange={e => change(e.target.checked ? [...ids, l.id] : ids.filter(id => id !== l.id))} /><span>{l.name}</span></label>)}</div>
}

function ProductForm({ businessId, locationId, product, locations, type }: Scope & { product?: Product; locations: Location[]; type: BusinessType }) {
  const initial = { name: product?.name ?? '', sku: product?.sku ?? '', kind: product?.domainKind ?? (type === 'rice' ? 'rice_grain' : 'water_refill') as NonNullable<Product['domainKind']>, unit: product?.baseUnit ?? (type === 'rice' ? 'kg' : 'service') as Product['baseUnit'], price: product ? String(product.priceCentavos / 100) : '', cost: product ? String(product.estimatedCostCentavos / 100) : '', costKnown: product?.costKnown ?? false, low: String(product?.lowStockThreshold ?? 0), active: product?.active ?? true, locationIds: product?.locationIds ?? (product ? locations.map(l => l.id) : [locationId]), metadata: product?.metadata ?? {}, note: String(product?.metadata?.note ?? ''), version: product?.version ?? (product ? 1 : undefined) }
  const form = useCommandForm(`product:${locationId}:${product?.id ?? 'new'}`, initial)
  const d = form.data
  return <section className="panel sale-panel"><h2>{product ? 'Edit catalog item' : 'New catalog item'}</h2><FormFeedback error={form.error} message={form.message} />
    <form onSubmit={e => { e.preventDefault(); void form.submit((v, commandId) => saveProduct({ businessId, locationId, commandId, id: product?.id, expectedVersion: v.version, name: v.name, sku: v.sku, domainKind: v.kind, baseUnit: v.unit, priceCentavos: toCentavos(Number(v.price)), estimatedCostCentavos: toCentavos(Number(v.cost || 0)), costKnown: v.costKnown, lowStockThreshold: Number(v.low), active: v.active, locationIds: v.locationIds, metadata: { ...v.metadata, note: v.note } }), 'Catalog item saved. Earlier sales keep their original price and cost.') }}><fieldset disabled={form.disabled}>
      <label>Product name<input required maxLength={200} value={d.name} onChange={e => form.change({ name: e.target.value })} /></label>
      <label>SKU<input required maxLength={60} value={d.sku} onChange={e => form.change({ sku: e.target.value })} /></label>
      <label>Product type<select disabled={!!product} value={d.kind} onChange={e => { const kind = e.target.value as typeof d.kind; form.change({ kind, unit: kind === 'rice_grain' ? 'kg' : kind === 'water_refill' || kind === 'service' ? 'service' : 'unit' }) }}>{type === 'rice' ? <option value="rice_grain">Rice variety · kilograms</option> : <><option value="water_refill">Water refill · service</option><option value="water_container">New container · stock</option></>}<option value="service">Other service</option><option value="stock_item">Other stock item</option></select></label>
      <label>Base unit<select disabled={!!product || d.kind !== 'stock_item'} value={d.unit} onChange={e => form.change({ unit: e.target.value as typeof d.unit })}><option value="kg">kg</option><option value="unit">unit</option><option value="service">service</option></select></label>
      <label>Selling price per unit (₱)<input required type="number" min=".01" step=".01" value={d.price} onChange={e => form.change({ price: e.target.value })} /></label>
      {d.unit === 'service' && <><label className="check"><input type="checkbox" checked={d.costKnown} onChange={e => form.change({ costKnown: e.target.checked })} /><span>Estimated variable cost is known</span></label><label>Estimated variable cost per service (₱)<input required={d.costKnown} type="number" min="0" step=".01" value={d.cost} onChange={e => form.change({ cost: e.target.value })} /></label></>}
      {d.unit !== 'service' && <label>Low stock threshold<input type="number" min="0" step={d.unit === 'kg' ? '.001' : '1'} value={d.low} onChange={e => form.change({ low: e.target.value })} /></label>}
      <Availability locations={locations} ids={d.locationIds} change={ids => form.change({ locationIds: ids })} />
      <label className="check"><input type="checkbox" checked={d.active} onChange={e => form.change({ active: e.target.checked })} /><span>Active for new operations</span></label>
      <label>Catalog note <span className="hint">optional</span><input value={d.note} maxLength={500} onChange={e => form.change({ note: e.target.value })} /></label>
      <button className="primary">Save product</button>
    </fieldset></form>
    <button type="button" disabled={form.busy || !form.ready} onClick={() => form.reset(initial)}>{product ? 'Reload current product for editing' : 'New product'}</button>
    <p className="microcopy">Stock quantity and cost come from receipts and explained ledger movements. Price changes apply to future sales only.</p>
  </section>
}

function AccountForm({ businessId, locationId, account, locations }: Scope & { account?: PaymentAccount; locations: Location[] }) {
  const initial = { name: account?.name ?? '', kind: account?.kind ?? 'cash', shared: account?.businessId === 'shared', active: account?.active ?? true, locationIds: account?.locationIds ?? (account ? locations.filter(l => account.businessId === 'shared' || l.businessId === businessId).map(l => l.id) : [locationId]), version: account?.version ?? (account ? 1 : undefined) }
  const form = useCommandForm(`account:${locationId}:${account?.id ?? 'new'}`, initial), d = form.data
  return <section className="panel sale-panel"><h2>{account ? 'Edit account' : 'New account'}</h2><FormFeedback error={form.error} message={form.message} />
    <form onSubmit={e => { e.preventDefault(); void form.submit((v, commandId) => savePaymentAccount({ ...v, businessId, locationId, commandId, id: account?.id, expectedVersion: v.version }), 'Payment account saved locally.') }}><fieldset disabled={form.disabled}>
      <label>Account name<input required maxLength={200} value={d.name} onChange={e => form.change({ name: e.target.value })} /></label>
      <label>Account type<select disabled={!!account} value={d.kind} onChange={e => form.change({ kind: e.target.value as typeof d.kind, shared: false, locationIds: [locationId] })}><option value="cash">Cash drawer</option><option value="ewallet">E-wallet</option><option value="bank">Bank</option></select></label>
      {d.kind !== 'cash' && <label className="check"><input disabled={!!account} type="checkbox" checked={d.shared} onChange={e => form.change({ shared: e.target.checked, locationIds: [locationId] })} /><span>Shared across workspace businesses</span></label>}
      {d.kind === 'cash' ? <label>Drawer location<select disabled={!!account} value={d.locationIds[0] ?? locationId} onChange={e => form.change({ locationIds: [e.target.value] })}>{locations.filter(l => l.businessId === businessId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label> : <Availability locations={locations.filter(l => d.shared || l.businessId === businessId)} ids={d.locationIds} change={ids => form.change({ locationIds: ids })} />}
      <label className="check"><input type="checkbox" checked={d.active} onChange={e => form.change({ active: e.target.checked })} /><span>Active for payments</span></label><button className="primary">Save account</button>
    </fieldset></form><button disabled={form.busy || !form.ready} onClick={() => form.reset(initial)}>{account ? 'Reload current account for editing' : 'New account'}</button>
    <p className="microcopy">Accounts describe where money is paid. They are not revenue categories. Opening float is entered in a cash session.</p>
  </section>
}

function SupplierForm({ businessId, locationId, supplier }: Scope & { supplier?: Supplier }) {
  const initial = { name: supplier?.name ?? '', contact: supplier?.contact ?? '', active: supplier?.active ?? true, version: supplier?.version }
  const form = useCommandForm(`supplier:${locationId}:${supplier?.id ?? 'new'}`, initial), d = form.data
  return <section className="panel sale-panel"><h2>{supplier ? 'Edit supplier' : 'New supplier'}</h2><FormFeedback error={form.error} message={form.message} /><form onSubmit={e => { e.preventDefault(); void form.submit((v, commandId) => saveSupplier({ ...v, businessId, locationId, commandId, id: supplier?.id, expectedVersion: v.version }), 'Supplier saved locally.') }}><fieldset disabled={form.disabled}>
    <label>Supplier name<input required maxLength={200} value={d.name} onChange={e => form.change({ name: e.target.value })} /></label><label>Contact/reference<input maxLength={200} value={d.contact} onChange={e => form.change({ contact: e.target.value })} /></label><label className="check"><input type="checkbox" checked={d.active} onChange={e => form.change({ active: e.target.checked })} /><span>Active</span></label><button className="primary">Save supplier</button>
  </fieldset></form><button disabled={form.busy || !form.ready} onClick={() => form.reset(initial)}>{supplier ? 'Reload current supplier for editing' : 'New supplier'}</button></section>
}

function StoreForm({ businessId, locationId }: Scope) {
  const form = useCommandForm(`store:${businessId}`, { name: '', locationName: '', type: 'water' as BusinessType, mode: 'business' })
  const d = form.data
  return <section className="panel sale-panel"><h2>Add a business or location</h2><FormFeedback error={form.error} message={form.message} /><form onSubmit={e => { e.preventDefault(); void form.submit((v, commandId) => v.mode === 'business' ? addBusiness({ businessId, locationId, commandId, name: v.name, type: v.type, locationName: v.locationName }) : addLocation({ businessId, locationId, commandId, name: v.locationName }), 'Store scope saved locally. Choose it in the header, then configure availability and accounts.') }}><fieldset disabled={form.disabled}>
    <label>Add<select value={d.mode} onChange={e => form.change({ mode: e.target.value })}><option value="business">New business with first location</option><option value="location">Location in selected business</option></select></label>
    {d.mode === 'business' && <><label>Business name<input required value={d.name} onChange={e => form.change({ name: e.target.value })} /></label><label>Business type<select value={d.type} onChange={e => form.change({ type: e.target.value as BusinessType })}><option value="water">Water</option><option value="rice">Rice</option></select></label></>}
    <label>Location name<input required value={d.locationName} onChange={e => form.change({ locationName: e.target.value })} /></label><button className="primary">Add store scope</button>
  </fieldset></form>{form.saved && <button onClick={() => form.reset()}>Add another</button>}</section>
}
