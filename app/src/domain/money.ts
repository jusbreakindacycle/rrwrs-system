export const peso = (centavos: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2
  }).format(centavos / 100)

export function assertCentavos(value: number, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error('Enter a valid amount in whole centavos.')
  }
}

export function toCentavos(pesos: number) {
  if (!Number.isFinite(pesos)) throw new Error('Enter a finite amount.')
  const amount = Math.round((pesos + Number.EPSILON) * 100)
  assertCentavos(amount, true)
  return amount
}

export function assertQuantity(quantity: number, wholeUnits = false) {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 ||
      (wholeUnits && !Number.isInteger(quantity))) throw new Error('Enter a valid positive quantity.')
}
