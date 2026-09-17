import { db } from '../db/database'
import { localContext } from './local-context'

export async function operationChoices(businessId: string, locationId: string) {
  const context = await localContext(businessId, locationId)
  const products = await db.products.where('businessId').equals(businessId).filter(p => p.workspaceId === context.workspaceId && p.active && (!p.locationIds || p.locationIds.includes(locationId))).toArray()
  const accounts = await db.paymentAccounts.filter(a => a.workspaceId === context.workspaceId && a.active && (a.businessId === businessId || a.businessId === 'shared') && (!a.locationIds || a.locationIds.includes(locationId))).toArray()
  const suppliers = await db.suppliers.where('businessId').equals(businessId).filter(s => s.workspaceId === context.workspaceId && s.active).toArray()
  const owners = await db.members.where('workspaceId').equals(context.workspaceId).filter(m => m.active && m.role === 'owner').toArray()
  return { products, accounts, suppliers, owners, context }
}
