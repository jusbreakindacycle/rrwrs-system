import { useEffect, useState } from 'react'
import { getInventory } from '../services/analytics'

type Props = { businessId: string | 'all'; refreshKey: number }

export function Inventory({ businessId, refreshKey }: Props) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getInventory>>>([])
  useEffect(() => { void getInventory(businessId).then(setRows) }, [businessId, refreshKey])
  return (
    <section className="panel">
      <div className="panel-head"><h2>Inventory position</h2><span>Derived from stock movements</span></div>
      <div className="inventory-grid">
        {rows.map(({ product, onHand }) => (
          <article className="stock-card" key={product.id}>
            <span className="eyebrow">{product.category}</span>
            <h3>{product.name}</h3>
            <strong>{onHand} <small>{product.unitLabel}</small></strong>
            <div className={onHand <= product.lowStockThreshold ? 'stock-low' : 'stock-ok'}>{onHand <= product.lowStockThreshold ? 'Low stock' : 'In range'}</div>
          </article>
        ))}
      </div>
    </section>
  )
}
