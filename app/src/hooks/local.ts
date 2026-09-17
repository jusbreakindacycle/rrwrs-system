import { liveQuery } from 'dexie'
import { useEffect, useRef, useState, type DependencyList } from 'react'
import { db } from '../db/database'

export function useLocalQuery<T>(query: () => Promise<T>, dependencies: DependencyList = []) {
  const [value, setValue] = useState<T>()
  const [error, setError] = useState('')
  useEffect(() => {
    setValue(undefined); setError('')
    const subscription = liveQuery(query).subscribe({ next: setValue, error: e => setError(e instanceof Error ? e.message : 'Could not read local records.') })
    return () => subscription.unsubscribe()
  }, dependencies)
  return { value, error }
}

// A successful draft remains locked until an explicit new operation. The command
// and its result are durable, including if the browser closes before confirmation.
export function useCommandForm<T extends object>(key: string, initial: T) {
  const [data, setData] = useState(initial)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<unknown>()
  const id = useRef('')
  const locked = useRef(false)
  const current = useRef(initial)
  const pending = useRef<Promise<unknown>>(Promise.resolve())
  const persist = (value: T, commandId: string) => {
    pending.current = pending.current.catch(() => undefined).then(() => db.drafts.put({ key, commandId, data: value, updatedAt: new Date().toISOString() }))
    void pending.current.catch(e => setError(e instanceof Error ? e.message : 'Could not save draft.'))
  }
  useEffect(() => {
    let mounted = true
    void (async () => {
      const draft = await db.drafts.get(key)
      const commandId = draft?.commandId ?? crypto.randomUUID()
      const value = (draft?.data as T | undefined) ?? initial
      const receipt = await db.commands.get(commandId)
      if (!mounted) return
      id.current = commandId; current.current = value; setData(value)
      locked.current = !!receipt; setSaved(!!receipt)
      setResult(receipt?.result)
      if (receipt) setMessage('Saved locally. This completed form is locked; start a new operation to enter another.')
      persist(value, commandId); setReady(true)
    })().catch(e => { if (mounted) setError(e instanceof Error ? e.message : 'Could not load draft.') })
    return () => { mounted = false }
  }, [key])
  const change = (patch: Partial<T>) => {
    if (!ready || locked.current) return
    const value = { ...current.current, ...patch }
    current.current = value; setData(value); setError(''); persist(value, id.current)
  }
  const submit = async (work: (value: T, commandId: string) => Promise<unknown>, success: string) => {
    if (!ready || locked.current) return
    locked.current = true; setBusy(true); setError(''); setMessage('')
    try {
      await pending.current
      const committedResult = await work(current.current, id.current)
      setResult(committedResult)
      setSaved(true); setMessage(success)
    } catch (e) {
      // A committed receipt is authoritative even if the caller lost confirmation.
      const committed = await db.commands.get(id.current).catch(() => undefined)
      if (committed) { setSaved(true); setResult(committed.result); setMessage('The original operation is saved locally. Review it in History; any later changes to this form were not applied.') }
      else { locked.current = false; setError(e instanceof Error ? e.message : 'Could not save. The operation was not committed.') }
    } finally { setBusy(false) }
  }
  const reset = (value: T = initial) => {
    if (busy) return
    id.current = crypto.randomUUID(); current.current = value; locked.current = false
    setData(value); setSaved(false); setResult(undefined); setMessage(''); setError(''); persist(value, id.current)
  }
  return { data, change, submit, reset, ready, busy, saved, result, message, error, disabled: !ready || busy || saved }
}
