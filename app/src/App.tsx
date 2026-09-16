import { useEffect, useState } from 'react'
import { db } from './db/database'
import { seedDemo } from './db/seed'
import { demoMode } from './config'
import type { Business, Location } from './domain/types'
import { Dashboard } from './components/Dashboard'
import { Inventory } from './components/Inventory'
import { QuickSale } from './components/QuickSale'
import { StatusBar } from './components/StatusBar'
import { Operations } from './components/Operations'
import { requestPersistentStorage, syncPending } from './services/sync'
import './styles.css'

type View = 'dashboard' | 'sale' | 'operations' | 'inventory'

export default function App() {
  const [ready, setReady] = useState(false)
  const [bootError, setBootError] = useState('')
  const [locations, setLocations] = useState<Location[]>([])
  const [persistent, setPersistent] = useState<boolean | undefined>()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [businessId, setBusinessId] = useState<string | 'all'>('all')
  const [view, setView] = useState<View>('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    void (async () => {
      await db.open()
      await seedDemo()
      setBusinesses(await db.businesses.filter(x => x.active).toArray())
      setLocations(await db.locations.toArray())
      setReady(true)
    })().catch(error => setBootError(error instanceof Error ? error.message : 'Local storage could not be opened.'))
  }, [])

  useEffect(() => {
    const reconnect = () => { if (navigator.onLine) void syncPending().then(() => setRefreshKey(x => x + 1)) }
    window.addEventListener('online', reconnect)
    window.addEventListener('focus', reconnect)
    return () => { window.removeEventListener('online', reconnect); window.removeEventListener('focus', reconnect) }
  }, [])

  if (bootError) return <main className="setup"><h1>Local database needs attention</h1><p role="alert">{bootError}</p><p>Existing records have been preserved. Close other tabs, check browser storage permissions and retry. Do not clear site data.</p><button className="primary" onClick={() => window.location.reload()}>Retry opening database</button></main>
  if (!ready) return <div className="boot" role="status">Opening local business database…</div>
  if (!demoMode) return <main className="setup"><h1>Business Manager</h1><p>Milestone 0 · local foundation</p><section className="panel"><h2>No production workspace is configured</h2><p>This build does not create sample businesses or accept real transactions. Existing local records are preserved.</p><p>For the isolated practice workspace, follow the demo instructions in the repository README.</p><p>Secure workspace setup and synchronization arrive in Milestone 2.</p></section></main>
  const selectedBusiness = businessId === 'all' ? undefined : businesses.find(b => b.id === businessId)

  return (
    <div className="app-shell">
      <StatusBar />
      <aside className="demo-banner">Practice workspace · sample data · cloud sync disabled</aside>
      <header className="topbar">
        <div className="brand"><div className="brand-mark">B</div><div><strong>Business Manager</strong><span>Local-first operations</span></div></div>
        <select aria-label="Business" className="business-switcher" value={businessId} onChange={e => { setBusinessId(e.target.value); setView('dashboard') }}>
          <option value="all">All businesses</option>
          {businesses.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}
        </select>
      </header>

      <main>
        <div className="page-title"><div><span className="eyebrow">{selectedBusiness?.type.toUpperCase() ?? 'OWNER OVERVIEW'}</span><h2>{selectedBusiness?.name ?? 'All businesses'}</h2></div><span className="location">{selectedBusiness ? locations.filter(l => l.businessId === selectedBusiness.id).map(l => l.name).join(', ') : 'Combined view'}</span></div>
        {view === 'dashboard' && <Dashboard businessId={businessId} refreshKey={refreshKey} />}
        {view === 'sale' && selectedBusiness && <QuickSale businessId={selectedBusiness.id} onSaved={() => setRefreshKey(x => x + 1)} />}
        {view === 'sale' && !selectedBusiness && <section className="panel empty">Choose a specific business before recording a sale.</section>}
        {view === 'operations' && selectedBusiness && <Operations businessId={selectedBusiness.id} onSaved={() => setRefreshKey(x => x + 1)} />}
        {view === 'operations' && !selectedBusiness && <section className="panel empty">Choose a specific business before recording store operations.</section>}
        {view === 'inventory' && <Inventory businessId={businessId} refreshKey={refreshKey} />}
      </main>
      <aside className="storage-note"><p>Local browser data needs a separate backup. Backup and restore are planned for Milestone 7.</p><button className="text-button" onClick={() => void requestPersistentStorage().then(setPersistent)}>Request persistent storage</button>{persistent !== undefined && <p role="status">{persistent ? 'Persistent storage granted. This is not a backup.' : 'Persistence was not granted. Local operations still work; browser data may be evicted.'}</p>}</aside>

      <nav aria-label="Main navigation" className="bottom-nav">
        <button aria-label="Overview" aria-current={view === 'dashboard' ? 'page' : undefined} className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><span aria-hidden="true">⌂</span>Overview</button>
        <button aria-label="Sale" aria-current={view === 'sale' ? 'page' : undefined} className={view === 'sale' ? 'active primary-nav' : 'primary-nav'} onClick={() => setView('sale')}><span aria-hidden="true">＋</span>Sale</button>
        <button aria-label="Ops" aria-current={view === 'operations' ? 'page' : undefined} className={view === 'operations' ? 'active' : ''} onClick={() => setView('operations')}><span aria-hidden="true">↕</span>Ops</button>
        <button aria-label="Stock" aria-current={view === 'inventory' ? 'page' : undefined} className={view === 'inventory' ? 'active' : ''} onClick={() => setView('inventory')}><span aria-hidden="true">▦</span>Stock</button>
      </nav>
    </div>
  )
}
