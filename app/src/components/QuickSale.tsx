import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db/database'
import type { PaymentAccount, Product } from '../domain/types'
import { peso } from '../domain/money'
import { createSale } from '../services/sales'

type Props = { businessId: string; onSaved: () => void }

export function QuickSale({ businessId, onSaved }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [productId, setProductId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [qty, setQty] = useState(1)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const commandId = useRef(crypto.randomUUID())

  useEffect(() => {
    void (async () => {
      const p = await db.products.where('businessId').equals(businessId).filter(x => x.active).toArray()
      const a = await db.paymentAccounts.filter(x => x.active && (x.businessId === businessId || x.businessId === 'shared')).toArray()
      setProducts(p); setAccounts(a)
      setProductId(p[0]?.id ?? '')
      setAccountId(a[0]?.id ?? '')
      setQty(1); setMessage('')
    })()
  }, [businessId])

  const selected = useMemo(() => products.find(x => x.id === productId), [products, productId])
  const total = selected ? selected.priceCentavos * qty : 0

  const save = async () => {
    if (savingRef.current || !productId || !accountId || !Number.isFinite(qty) || qty <= 0) return
    savingRef.current = true
    setSaving(true); setMessage('')
    try {
      await createSale({ businessId, productId, quantity: qty, paymentAccountId: accountId, commandId: commandId.current })
      commandId.current = crypto.randomUUID()
      setMessage('Sale saved locally. Cloud sync is disabled in this demo.')
      setQty(1); onSaved()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save sale')
    } finally { savingRef.current = false; setSaving(false) }
  }

  return (
    <section className="panel sale-panel">
      <div className="panel-head"><h2>Quick sale</h2><span>Local commit first</span></div>
      <label>Item
        <select value={productId} onChange={e => setProductId(e.target.value)}>{products.map(p => <option key={p.id} value={p.id}>{p.name} — {peso(p.priceCentavos)}</option>)}</select>
      </label>
      <label>Quantity <span className="hint">{selected?.unitLabel}</span>
        <input type="number" min="1" step={selected?.baseUnit === 'kg' ? '1' : '1'} value={qty} onChange={e => setQty(Number(e.target.value))} />
      </label>
      <label>Paid via
        <select value={accountId} onChange={e => setAccountId(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      </label>
      <div className="sale-total"><span>Total</span><strong>{peso(total)}</strong></div>
      <button className="primary" onClick={save} disabled={saving || !productId || !accountId}>{saving ? 'Saving…' : 'Finalize sale'}</button>
      {message && <div className="notice" role="status">{message}</div>}
      <p className="microcopy">Demo rule: no customer credit. Finalized history is not destructively edited.</p>
    </section>
  )
}
