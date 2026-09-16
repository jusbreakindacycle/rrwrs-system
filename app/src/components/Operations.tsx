import { useEffect, useState } from 'react'
import { db } from '../db/database'
import { peso, toCentavos } from '../domain/money'
import type { CashSession, PaymentAccount, Product } from '../domain/types'
import { calculateExpectedCash, closeCashSession, getOpenCashSession, openCashSession, receiveStock, recordExpense } from '../services/operations'

type Props = { businessId: string; onSaved: () => void }
type Mode = 'stock' | 'expense' | 'cash'

export function Operations({ businessId, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('stock')
  const [products, setProducts] = useState<Product[]>([])
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    void (async () => {
      setProducts(await db.products.where('businessId').equals(businessId).filter(x => x.active && x.inventoryTracked).toArray())
      setAccounts(await db.paymentAccounts.filter(x => x.active && (x.businessId === businessId || x.businessId === 'shared')).toArray())
      setMessage('')
    })()
  }, [businessId])

  return (
    <div className="stack-lg">
      <div className="segment">
        <button className={mode === 'stock' ? 'active' : ''} onClick={() => setMode('stock')}>Receive stock</button>
        <button className={mode === 'expense' ? 'active' : ''} onClick={() => setMode('expense')}>Expense</button>
        <button className={mode === 'cash' ? 'active' : ''} onClick={() => setMode('cash')}>Cash close</button>
      </div>
      {mode === 'stock' && <ReceiveStock businessId={businessId} products={products} accounts={accounts} done={text => { setMessage(text); onSaved() }} />}
      {mode === 'expense' && <ExpenseForm businessId={businessId} accounts={accounts} done={text => { setMessage(text); onSaved() }} />}
      {mode === 'cash' && <CashClose businessId={businessId} accounts={accounts.filter(x => x.kind === 'cash')} done={text => { setMessage(text); onSaved() }} />}
      {message && <div className="notice">{message}</div>}
    </div>
  )
}

function ReceiveStock({ businessId, products, accounts, done }: { businessId: string; products: Product[]; accounts: PaymentAccount[]; done: (x: string) => void }) {
  const [productId, setProductId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [qty, setQty] = useState(50)
  const [cost, setCost] = useState(2400)
  useEffect(() => { setProductId(products[0]?.id ?? ''); setAccountId(accounts[0]?.id ?? '') }, [products, accounts])
  const product = products.find(x => x.id === productId)
  return <section className="panel sale-panel">
    <div className="panel-head"><h2>Receive COD stock</h2><span>Purchase + stock movement + cash out</span></div>
    <label>Inventory item<select value={productId} onChange={e => setProductId(e.target.value)}>{products.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <label>Quantity received <span className="hint">{product?.unitLabel}</span><input type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))}/></label>
    <label>Total supplier cost (₱)<input type="number" min="1" value={cost} onChange={e => setCost(Number(e.target.value))}/></label>
    <label>Paid from<select value={accountId} onChange={e => setAccountId(e.target.value)}>{accounts.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
    <div className="sale-total"><span>Purchase total</span><strong>{peso(Math.round(cost * 100))}</strong></div>
    <button className="primary" onClick={async () => { try { await receiveStock({ businessId, productId, quantity: qty, totalCostCentavos: toCentavos(cost), paidFromAccountId: accountId }); done('Stock received. Weighted average cost was refreshed and the purchase was queued for sync.') } catch(e) { done(e instanceof Error ? e.message : 'Could not receive stock') } }}>Receive stock</button>
  </section>
}

function ExpenseForm({ businessId, accounts, done }: { businessId: string; accounts: PaymentAccount[]; done: (x: string) => void }) {
  const [category, setCategory] = useState('Utilities')
  const [amount, setAmount] = useState(500)
  const [accountId, setAccountId] = useState('')
  const [abono, setAbono] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => setAccountId(accounts[0]?.id ?? ''), [accounts])
  return <section className="panel sale-panel">
    <div className="panel-head"><h2>Record expense</h2><span>Operating expense, not inventory</span></div>
    <label>Category<select value={category} onChange={e => setCategory(e.target.value)}><option>Utilities</option><option>Rent</option><option>Fuel / delivery</option><option>Maintenance</option><option>Filters / treatment</option><option>Packaging</option><option>Labor</option><option>Permits / laboratory</option><option>Other</option></select></label>
    <label>Amount (₱)<input type="number" min="1" value={amount} onChange={e => setAmount(Number(e.target.value))}/></label>
    <label>Payment account<select value={accountId} disabled={abono} onChange={e => setAccountId(e.target.value)}>{accounts.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
    <label className="check"><input type="checkbox" checked={abono} onChange={e => setAbono(e.target.checked)}/><span>Owner paid personally (abono). Record owner reimbursement payable instead of reducing a business account now.</span></label>
    <label>Note <span className="hint">optional</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="What was this for?"/></label>
    <button className="primary" onClick={async () => { try { await recordExpense({ businessId, category, amountCentavos: toCentavos(amount), paidFromAccountId: accountId || 'owner-personal', fundedByOwner: abono, note }); done(abono ? 'Expense saved as owner-funded abono; it was not deducted from the store cash account.' : 'Expense saved and queued for sync.') } catch(e) { done(e instanceof Error ? e.message : 'Could not save expense') } }}>Save expense</button>
  </section>
}

function CashClose({ businessId, accounts, done }: { businessId: string; accounts: PaymentAccount[]; done: (x: string) => void }) {
  const [accountId, setAccountId] = useState('')
  const [session, setSession] = useState<CashSession | undefined>()
  const [opening, setOpening] = useState(1000)
  const [actual, setActual] = useState(0)
  const [expected, setExpected] = useState<number | undefined>()

  const load = async (id: string) => {
    if (!id) return
    const found = await getOpenCashSession(businessId, id)
    setSession(found)
    setExpected(found ? await calculateExpectedCash(found) : undefined)
  }
  useEffect(() => { const id = accounts[0]?.id ?? ''; setAccountId(id); void load(id) }, [businessId, accounts])

  return <section className="panel sale-panel">
    <div className="panel-head"><h2>Cash drawer</h2><span>Opening float → expected → actual</span></div>
    <label>Cash account<select value={accountId} onChange={e => { setAccountId(e.target.value); void load(e.target.value) }}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    {!session ? <>
      <label>Opening cash (₱)<input type="number" min="0" value={opening} onChange={e => setOpening(Number(e.target.value))}/></label>
      <button className="primary" onClick={async () => { try { const s = await openCashSession(businessId, accountId, toCentavos(opening)); setSession(s); setExpected(await calculateExpectedCash(s)); done('Cash session opened. Cash sales and cash expenses will now affect the expected drawer.') } catch(e) { done(e instanceof Error ? e.message : 'Could not open cash session') } }}>Open cash session</button>
    </> : <>
      <div className="cash-summary"><div><span>Opening</span><strong>{peso(session.openingCentavos)}</strong></div><div><span>Expected now</span><strong>{peso(expected ?? 0)}</strong></div></div>
      <label>Actual cash counted (₱)<input type="number" min="0" value={actual} onChange={e => setActual(Number(e.target.value))}/></label>
      <button className="primary" onClick={async () => { try { const result = await closeCashSession(session.id, toCentavos(actual)); done(`Cash session closed. Expected ${peso(result.expected)}; variance ${peso(result.variance)}.`); setSession(undefined); setExpected(undefined); setActual(0) } catch(e) { done(e instanceof Error ? e.message : 'Could not close cash session') } }}>Close and reconcile</button>
    </>}
  </section>
}
