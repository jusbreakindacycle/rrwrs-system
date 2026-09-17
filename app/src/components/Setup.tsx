import { setupLocalWorkspace } from '../services/setup'
import { useCommandForm } from '../hooks/local'
import { FormFeedback } from './FormFeedback'
import type { BusinessType } from '../domain/types'

export function Setup() {
  const form = useCommandForm('local-setup', { workspaceName: '', ownerName: '', businessName: '', businessType: 'water' as BusinessType, locationName: '' })
  return <main className="setup"><h1>Business Manager</h1><section className="panel sale-panel"><h2>No production workspace is configured</h2>
    <p>Set up a local workspace on this trusted device. Records stay in this browser. Sign-in, secure access and cloud synchronization arrive in Milestone 2.</p>
    <p>This is an internal operations system. Keep independent business records until backup and recovery are validated.</p>
    <FormFeedback error={form.error} message={form.message} />
    <form onSubmit={e => { e.preventDefault(); void form.submit((d, commandId) => setupLocalWorkspace({ ...d, commandId }), 'Local workspace created.') }}><fieldset disabled={form.disabled}>
      <label>Workspace name<input required maxLength={200} value={form.data.workspaceName} onChange={e => form.change({ workspaceName: e.target.value })} /></label>
      <label>Owner name<input required maxLength={200} value={form.data.ownerName} onChange={e => form.change({ ownerName: e.target.value })} /></label>
      <label>Business name<input required maxLength={200} value={form.data.businessName} onChange={e => form.change({ businessName: e.target.value })} /></label>
      <label>Business type<select value={form.data.businessType} onChange={e => form.change({ businessType: e.target.value as BusinessType })}><option value="water">Water refilling station</option><option value="rice">Rice retail / bigasan</option></select></label>
      <label>Location name<input required maxLength={200} value={form.data.locationName} onChange={e => form.change({ locationName: e.target.value })} /></label>
      <button className="primary">Create local workspace</button>
    </fieldset></form>
  </section></main>
}
