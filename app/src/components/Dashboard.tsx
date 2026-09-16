import { useEffect, useState } from 'react'
import { db } from '../db/database'
import { peso } from '../domain/money'
import { getDashboard, getInventory } from '../services/analytics'

type Props = { businessId: string | 'all'; refreshKey: number }

export function Dashboard({ businessId, refreshKey }: Props) {
  const [data, setData] = useState({ salesCentavos: 0, grossProfitCentavos: 0, paymentMix: [] as { name: string; kind: string; amountCentavos: number }[], saleCount: 0 })
  const [lowStock, setLowStock] = useState<{ name: string; onHand: number; unit: string }[]>([])
  const [actions, setActions] = useState<{ id: string; severity: string; title: string; detail: string }[]>([])

  useEffect(() => {
    void (async () => {
      setData(await getDashboard(businessId))
      const inv = await getInventory(businessId)
      setLowStock(inv.filter(x => x.onHand <= x.product.lowStockThreshold).map(x => ({ name: x.product.name, onHand: x.onHand, unit: x.product.unitLabel })))
      const rows = await db.actionItems.filter(x => !x.resolved && (businessId === 'all' || x.businessId === businessId)).toArray()
      setActions(rows)
    })()
  }, [businessId, refreshKey])

  return (
    <div className="stack-lg">
      <section className="hero-card">
        <div>
          <span className="eyebrow">TODAY</span>
          <h1>{peso(data.salesCentavos)}</h1>
          <p>Net sales · {data.saleCount} finalized {data.saleCount === 1 ? 'sale' : 'sales'}</p>
        </div>
        <div className="profit-chip">
          <span>Estimated gross profit</span>
          <strong>{peso(data.grossProfitCentavos)}</strong>
          <small>Before rent, utilities, wages and other operating expenses</small>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Payment mix</h2><span>Where today's sales were paid</span></div>
          {data.paymentMix.length === 0 ? <Empty text="No payments recorded today." /> : (
            <div className="rows">
              {data.paymentMix.map(item => (
                <div className="row" key={item.name}><span>{item.name}</span><strong>{peso(item.amountCentavos)}</strong></div>
              ))}
              <div className="row total"><span>Total</span><strong>{peso(data.paymentMix.reduce((s, x) => s + x.amountCentavos, 0))}</strong></div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Action center</h2><span>Exceptions before charts</span></div>
          <div className="action-list">
            {lowStock.map(item => <div className="action warning" key={item.name}><b>Low stock</b><span>{item.name}: {item.onHand} {item.unit}</span></div>)}
            {actions.map(item => <div className={`action ${item.severity}`} key={item.id}><b>{item.title}</b><span>{item.detail}</span></div>)}
            {lowStock.length === 0 && actions.length === 0 && <Empty text="Nothing needs attention." />}
          </div>
        </section>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) { return <div className="empty">{text}</div> }
