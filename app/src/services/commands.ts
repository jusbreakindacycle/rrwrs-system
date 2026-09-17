import { db } from '../db/database'
import { assertId } from '../domain/money'
import { localContext, localWrite, queueEvent, type LocalContext } from './local-context'

export interface CommandInput { businessId: string; locationId?: string; commandId?: string }

// Canonical JSON permits key-order-independent retry comparisons. Never hash
// floating NaN/Infinity into JSON null, which could alias a different request.
export function fingerprint(value: unknown): string {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Enter finite numeric values.')
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => `${JSON.stringify(key)}:${fingerprint(v)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

export function executeCommand<T>(kind: string, input: CommandInput, work: (context: LocalContext, id: string, now: string) => Promise<{ result: T; payload: unknown; entityId?: string; operation?: string }>) {
  return localWrite(async () => {
    const context = await localContext(input.businessId, input.locationId)
    const id = input.commandId ?? crypto.randomUUID()
    assertId(id)
    const signature = fingerprint({ ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'commandId')), locationId: context.locationId })
    const previous = await db.commands.get(id)
    if (previous) {
      if (previous.kind !== kind || previous.fingerprint !== signature || previous.workspaceId !== context.workspaceId) throw new Error('This command ID already belongs to a different transaction.')
      return previous.result as T
    }
    const now = new Date().toISOString()
    const output = await work(context, id, now)
    await queueEvent({ businessId: context.businessId, locationId: context.locationId, entityType: kind, entityId: output.entityId ?? id, operation: output.operation ?? 'create', occurredAt: now, payload: output.payload })
    await db.commands.add({ ...context, id, kind, fingerprint: signature, result: output.result, committedAt: now })
    return output.result
  })
}
