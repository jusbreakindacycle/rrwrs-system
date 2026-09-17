import { useLocalQuery } from '../hooks/local'
import { getHistory } from '../services/analytics'
import { peso } from '../domain/money'
import { FormFeedback } from './FormFeedback'

export function History({ businessId, locationId }: { businessId: string; locationId: string }) {
  const query = useLocalQuery(() => getHistory(businessId, locationId), [businessId, locationId])
  return <section className="panel"><h2>Local transaction history</h2><p className="microcopy">Finalized records are read-only. Owner-reviewed corrections arrive in Milestone 3. No silent edits or deletes.</p><FormFeedback error={query.error} message="" />
    {!query.value && !query.error && <p role="status">Reading history…</p>}
    {query.value?.rows.length === 0 && <p className="empty">No finalized transactions in this scope.</p>}
    {query.value?.rows.map(r => <article key={r.id} className="history-entry"><div className="row"><b>{r.kind}</b><strong>{peso(r.amount)}</strong></div><small>{new Date(r.time).toLocaleString('en-PH')} · {r.locationName}</small><p>{r.detail}</p><small className="record-id">Record {r.id}</small></article>)}
    <details><summary>Audit history ({query.value?.audits.length ?? 0})</summary>{query.value?.audits.map(a => <div className="history-entry" key={a.id}><b>{a.entityType} · {a.operation}</b><small>{new Date(a.occurredAt).toLocaleString('en-PH')}</small><small className="record-id">Record {a.entityId} · actor {a.actorId} · event {a.eventId}</small></div>)}</details>
  </section>
}
