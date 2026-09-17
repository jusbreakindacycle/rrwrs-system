import { db } from '../db/database'
import { assertCentavos } from '../domain/money'
import type { LocationScope, PaymentEntry } from '../domain/types'
import { validateAccount } from './local-context'

export async function postPayment(scope: LocationScope, accountId: string, amountCentavos: number, direction: PaymentEntry['direction'], kind: 'sale' | 'expense' | 'purchase', referenceId: string, now: string) {
  assertCentavos(amountCentavos)
  const account = await validateAccount(scope, accountId)
  let cashSessionId: string | undefined
  if (account.kind === 'cash') {
    const sessions = await db.cashSessions.where('accountId').equals(accountId).filter(s => s.status === 'open').toArray()
    const session = sessions[0]
    if (sessions.length !== 1 || !session || session.locationId !== scope.locationId || session.businessId !== scope.businessId || session.workspaceId !== scope.workspaceId || session.cashModelVersion !== 3) throw new Error('Open a cash session for this drawer and location before recording cash payments.')
    cashSessionId = session.id
  }
  const payment: PaymentEntry = { ...scope, id: crypto.randomUUID(), accountId, accountName: account.name, amountCentavos, direction, kind, referenceId, saleId: kind === 'sale' ? referenceId : undefined, cashSessionId, createdAt: now }
  await db.paymentEntries.add(payment)
  return payment
}
