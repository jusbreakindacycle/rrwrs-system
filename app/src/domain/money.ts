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
      (wholeUnits && !Number.isInteger(quantity)) || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001) throw new Error('Enter a valid positive quantity (up to three decimal places).')
}

// Round once, half up, without losing cents in an oversized multiplication.
// Inputs and stored results stay safe JS integers; the intermediate uses BigInt.
export function proportionalCentavos(value: number, numerator: number, denominator: number) {
  assertCentavos(value, true)
  if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator <= 0) throw new Error('Invalid quantity ratio.')
  const divisor = BigInt(denominator)
  const result = Number((BigInt(value) * BigInt(numerator) + divisor / 2n) / divisor)
  assertCentavos(result, true)
  return result
}

export function assertId(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid record identifier.')
}

export function requiredText(value: string, label: string, limit = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) throw new Error(`${label} is required (maximum ${limit} characters).`)
  return value.trim()
}
