import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaStatus() {
  const [error, setError] = useState(false)
  const [alreadyControlled] = useState(() => 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null)
  const { offlineReady: [offlineReady], needRefresh: [needRefresh] } = useRegisterSW({
    immediate: true,
    onRegisterError: () => setError(true)
  })
  return <p className="pwa-note" role="status">{error
    ? 'Offline app installation failed. Keep this tab open and retry when connected.'
    : needRefresh
      ? 'App update available. Finish your work, then close all app tabs and reopen to update.'
      : offlineReady || alreadyControlled ? 'App shell ready for offline use on this device.' : 'Preparing app shell for offline use…'}</p>
}
