import { useState } from 'react'
import { peso } from '../domain/money'
import { getDashboard, getInventory, philippineDay } from '../services/analytics'
import { useLocalQuery } from '../hooks/local'
import { FormFeedback } from './FormFeedback'

export function Dashboard({ businessId, locationId }: { businessId: string; locationId: string }) {
  const [day, setDay] = useState(philippineDay())
  const query = useLocalQuery(async () => ({ report: await getDashboard(businessId, locationId, day), stock: await getInventory(businessId, locationId) }), [businessId, locationId, day])
  const data = query.value?.report, low = query.value?.stock.filter(r => r.product.active && r.onHand <= r.product.lowStockThreshold) ?? []
  return <div className="stack-lg"><label className="report-date">Report date · Philippine time<input aria-label="Report date" type="date" value={day} onChange={e => setDay(e.target.value)} /></label><FormFeedback error={query.error} message="" />
    {!data ? !query.error && <p>Reading local records…</p> : <>
      <section className="hero-card"><div><span className="eyebrow">RECORDED SALES</span><h1>{peso(data.salesCentavos)}</h1><p>{data.saleCount} finalized {data.saleCount === 1 ? 'sale' : 'sales'} · {day}</p></div><div className="profit-chip"><span>Estimated gross profit</span><strong>{data.grossProfitCentavos === null ? 'Cost data incomplete' : peso(data.grossProfitCentavos)}</strong><small>Recorded inventory costs and configured service estimates. Before operating expenses.</small></div></section>
      <div className="grid-2"><section className="panel"><div className="panel-head"><h2>Payment mix</h2><span>Within total sales</span></div>{!data.paymentMix.length && <p className="empty">No payments recorded on this date.</p>}{data.paymentMix.map(p => <div className="row" key={p.id}><span>{p.name}</span><strong>{peso(p.amountCentavos)}</strong></div>)}<div className="row total"><span>Total customer payments</span><strong>{peso(data.paymentMix.reduce((sum, p) => sum + p.amountCentavos, 0))}</strong></div></section>
      <section className="panel"><div className="panel-head"><h2>Money out</h2><span>Selected date</span></div><div className="row"><span>Inventory purchases</span><strong>{peso(data.purchaseCentavos)}</strong></div><div className="row"><span>Business-paid expenses</span><strong>{peso(data.expenseCentavos)}</strong></div><div className="row total"><span>Business money paid out</span><strong>{peso(data.purchaseCentavos + data.expenseCentavos)}</strong></div><div className="row"><span>Owner-funded expenses (abono)</span><strong>{peso(data.abonoCentavos)}</strong></div><p className="microcopy">Abono did not use a business account. Transfers, contributions, withdrawals and reimbursements arrive in Milestone 6.</p></section></div>
      <div className="grid-2"><section className="panel"><h2>Physical cash</h2><p className="hint">Open drawers now and sessions closed on the selected date.</p>{!data.cash.length && <p className="empty">No cash sessions in this view.</p>}{data.cash.map(s => <article className="history-entry" key={s.id}><b>{s.accountName} · {s.status}</b><small>{s.locationName}</small><p>Expected {peso(s.expected)}{s.status === 'closed' && ` · Counted ${peso(s.actualClosingCentavos ?? 0)}`}</p>{s.status === 'closed' && <p className={s.varianceCentavos ? 'stock-low' : 'stock-ok'}>Variance {peso(s.varianceCentavos ?? 0)} · {(s.varianceCentavos ?? 0) < 0 ? 'Shortage' : (s.varianceCentavos ?? 0) > 0 ? 'Overage' : 'Balanced'}</p>}<p>{s.note}</p></article>)}</section>
      <section className="panel"><h2>Owed to owners</h2><p className="hint">All recorded abono in this view; reimbursement is not available yet.</p>{!data.ownerPayables.length && <p className="empty">No owner payable recorded.</p>}{data.ownerPayables.map(p => <div className="row" key={p.id}><span>{p.name}</span><strong>{peso(p.amountCentavos)}</strong></div>)}</section></div>
      <section className="panel"><div className="panel-head"><h2>Action center</h2><span>Local exceptions</span></div><div className="action-list">
        {low.map(r => <div className="action warning" key={`${r.location.id}:${r.product.id}`}><b>Low stock</b><span>{r.product.name}: {r.onHand} {r.product.unitLabel} · {r.location.name}</span></div>)}
        {data.cash.filter(s => s.status === 'open').map(s => <div className="action" key={s.id}><b>Drawer open</b><span>{s.accountName} · opened {new Date(s.openedAt).toLocaleString('en-PH')}</span></div>)}
        {data.varianceCount > 0 && <div className="action warning"><b>{data.varianceCount} historical cash variance(s)</b><span>Shortages and overages remain in cash reconciliation history.</span></div>}
        {data.failed.map(e => <div className="action critical" key={e.id}><b>Outbox failure</b><span>{e.error || e.entityType} · {e.id}. Records remain local; cloud transport is disabled.</span></div>)}
        {data.unassignedAbono > 0 && <div className="action warning"><b>Legacy abono requires review</b><span>{data.unassignedAbono} expense(s) have no unambiguous owner payable. They were preserved.</span></div>}
        {data.unscopedHistory > 0 && <div className="action warning"><b>Legacy records excluded from totals</b><span>Unscoped history requires a reviewed import in a later milestone.</span></div>}
        {!low.length && !data.cash.some(s => s.status === 'open') && !data.varianceCount && !data.failed.length && !data.unassignedAbono && !data.unscopedHistory && <p className="empty">No recorded exceptions in this local view.</p>}
      </div><p className="microcopy">This device only. Remote stores, compliance, delivery and corrections are not synchronized or monitored yet.</p></section>
    </>}
  </div>
}
