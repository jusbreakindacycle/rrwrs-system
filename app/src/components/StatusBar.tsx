import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import { countPending } from '../services/sync'

export function StatusBar() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const handle = () => setOnline(navigator.onLine)
    window.addEventListener('online', handle)
    window.addEventListener('offline', handle)
    const subscription = liveQuery(async () => ({ pending: await countPending(), failed: await db.outbox.where('syncState').equals('failed').count() })).subscribe({
      next: counts => { setPending(counts.pending); setFailed(counts.failed) },
      error: () => setError('Could not read the local queue.')
    })
    return () => {
      window.removeEventListener('online', handle)
      window.removeEventListener('offline', handle)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="statusbar">
      <span className={`dot ${online ? 'online' : 'offline'}`} />
      <span>{online ? 'Online' : 'Offline — local operations available'}</span>
      <span className="status-spacer" />
      <span role="status">{error || `Local queue (${pending}) · sync disabled`}{failed > 0 && ` · ${failed} failed`}</span>
    </div>
  )
}
