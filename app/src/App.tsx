import { useEffect, useState } from 'react'
import { db } from './db/database'
import { seedDemo } from './db/seed'
import { demoMode } from './config'
import { Dashboard } from './components/Dashboard'
import { Inventory } from './components/Inventory'
import { QuickSale } from './components/QuickSale'
import { StatusBar } from './components/StatusBar'
import { Operations } from './components/Operations'
import { Management } from './components/Management'
import { History } from './components/History'
import { Setup } from './components/Setup'
import { readableLocations } from './services/local-context'
import { requestPersistentStorage } from './services/sync'
import { useLocalQuery } from './hooks/local'
import './styles.css'

type View = 'Overview' | 'Sale' | 'Ops' | 'Stock' | 'History' | 'Manage'
export default function App() {
  const [ready, setReady] = useState(false), [bootError, setBootError] = useState('')
  const [persistent, setPersistent] = useState<boolean>()
  const [businessId, setBusinessId] = useState('all'), [locationId, setLocationId] = useState('all')
  const [view, setView] = useState<View>('Overview')
  useEffect(() => { void (async () => { await db.open(); await seedDemo(); setReady(true) })().catch(e => setBootError(e instanceof Error ? e.message : 'Local database could not be opened.')) }, [])
  const query = useLocalQuery(async () => {
    if (!ready) return undefined
    const locations = await readableLocations()
    return { locations, businesses: await db.businesses.filter(b => locations.some(l => l.businessId === b.id)).toArray(), workspaceCount: await db.workspaces.count() }
  }, [ready])
  if (bootError || query.error) return <main className="setup"><h1>Local database needs attention</h1><p role="alert">{bootError || query.error}</p><p>Existing records have been preserved. Close other tabs, check browser storage permissions and retry. Do not clear site data.</p><button className="primary" onClick={() => window.location.reload()}>Retry opening database</button></main>
  if (!ready || !query.value) return <div className="boot" role="status">Opening local business database…</div>
  const { locations, businesses, workspaceCount } = query.value
  if (!workspaceCount) return <><StatusBar /><Setup /></>
  if (!locations.length) return <main className="setup"><h1>No local location access</h1><p>This local profile has no configured location access. Existing data is preserved. Secure membership management arrives in Milestone 2.</p></main>
  const selectedBusiness = businesses.find(b => b.id === businessId)
  const selectedLocation = locations.find(l => l.id === locationId && l.businessId === businessId)
  const operational = !!selectedBusiness?.active && !!selectedLocation?.active
  const scope = { businessId, locationId }, key = `${businessId}:${locationId}`
  return <div className="app-shell"><StatusBar /><aside className="demo-banner">{demoMode ? 'Practice workspace · sample data · cloud sync disabled' : 'Trusted local workspace · no sign-in · cloud sync disabled'}</aside>
    <header className="topbar"><div className="brand"><div className="brand-mark">R</div><div><strong>Business Manager</strong><span>Local-first store operations</span></div></div><div className="scope-controls">
      <label>Business<select aria-label="Business" className="business-switcher" value={businessId} onChange={e => { const id = e.target.value; setBusinessId(id); setLocationId(locations.find(l => l.businessId === id && l.active)?.id ?? 'all'); setView('Overview') }}><option value="all">All businesses</option>{businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      {selectedBusiness && <label>Location<select aria-label="Location" className="business-switcher" value={locationId} onChange={e => setLocationId(e.target.value)}><option value="all">All locations</option>{locations.filter(l => l.businessId === businessId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
    </div></header>
    <main><div className="page-title"><div><span className="eyebrow">{selectedBusiness?.type.toUpperCase() ?? 'OWNER OVERVIEW'}</span><h2>{selectedBusiness?.name ?? 'All businesses'}</h2></div><span className="location">{selectedLocation?.name ?? 'Combined local view'}</span></div>
      {view === 'Overview' && <Dashboard {...scope} />}
      {view === 'Stock' && <Inventory key={key} {...scope} />}
      {view === 'History' && <History {...scope} />}
      {['Sale', 'Ops', 'Manage'].includes(view) && !operational && <section className="panel empty">Choose a specific active business and location in the header to continue.</section>}
      {operational && view === 'Sale' && <QuickSale key={key} {...scope} />}
      {operational && view === 'Ops' && <Operations key={key} {...scope} />}
      {operational && view === 'Manage' && <Management key={key} {...scope} />}
    </main>
    <aside className="storage-note"><p>Local browser data needs a separate backup. Backup and restore are planned for Milestone 7.</p><button className="text-button" onClick={() => void requestPersistentStorage().then(setPersistent)}>Request persistent storage</button>{persistent !== undefined && <p role="status">{persistent ? 'Persistent storage granted. This is not a backup.' : 'Persistence was not granted. Local operations still work; browser data may be evicted.'}</p>}</aside>
    <nav aria-label="Main navigation" className="bottom-nav">{(['Overview', 'Sale', 'Ops', 'Stock', 'History', 'Manage'] as View[]).map(v => <button key={v} aria-label={v} aria-current={view === v ? 'page' : undefined} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v}</button>)}</nav>
  </div>
}
