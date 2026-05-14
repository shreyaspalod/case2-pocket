/**
 * Balance Netting Algorithm
 * ─────────────────────────
 * Given a list of expenses (with splits) and settlements, we:
 *   1. Compute each user's net balance:
 *        net = Σ(amounts they paid) − Σ(splits they owe)
 *      Positive net → others owe them.
 *      Negative net → they owe others.
 *   2. Separate into creditors (+) and debtors (−).
 *   3. Greedily match the largest debtor with the largest creditor.
 *      This minimises the number of transactions needed to settle.
 *
 * Example (3-person):
 *   Alice pays ₹1200 → split 40/30/30 between Alice, Bob, Carol
 *   Alice net: +1200 − 480 = +720  (creditor)
 *   Bob   net:    0  − 360 = −360  (debtor)
 *   Carol net:    0  − 360 = −360  (debtor)
 *
 *   Naive: Bob→Alice ₹360 + Carol→Alice ₹360 = 2 transactions  ✓
 *   (already minimal; netting shines with chains like A→B + B→C → A→C)
 */

import type { Expense, Settlement, Profile, SettlementSuggestion } from '@/types'

export function computeNetBalances(
  expenses: Expense[],
  settlements: Settlement[]
): Map<string, number> {
  const balances = new Map<string, number>()

  const add = (userId: string, delta: number) =>
    balances.set(userId, (balances.get(userId) ?? 0) + delta)

  // Each expense: payer gets credit, each split participant owes their share
  for (const expense of expenses) {
    add(expense.paid_by, expense.amount)
    for (const split of expense.expense_splits ?? []) {
      add(split.user_id, -split.amount)
    }
  }

  // Each settlement: payer reduces their debt, receiver reduces their credit
  for (const s of settlements) {
    add(s.paid_by, s.amount)
    add(s.paid_to, -s.amount)
  }

  return balances
}

export function minimiseSettlements(
  balances: Map<string, number>,
  profiles: Map<string, Profile>
): SettlementSuggestion[] {
  const EPS = 0.01

  // Split into creditors and debtors, rounding to 2dp
  const creditors: [string, number][] = []
  const debtors: [string, number][] = []

  for (const [userId, balance] of balances) {
    const rounded = Math.round(balance * 100) / 100
    if (rounded > EPS) creditors.push([userId, rounded])
    else if (rounded < -EPS) debtors.push([userId, -rounded]) // store as positive
  }

  // Sort descending by amount so we match large amounts first
  creditors.sort((a, b) => b[1] - a[1])
  debtors.sort((a, b) => b[1] - a[1])

  const suggestions: SettlementSuggestion[] = []
  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const [creditorId, creditAmt] = creditors[ci]
    const [debtorId, debtAmt] = debtors[di]

    const transfer = Math.min(creditAmt, debtAmt)

    if (transfer > EPS) {
      suggestions.push({
        from: debtorId,
        to: creditorId,
        fromName: profiles.get(debtorId)?.name ?? debtorId,
        toName: profiles.get(creditorId)?.name ?? creditorId,
        amount: Math.round(transfer * 100) / 100,
      })
    }

    creditors[ci][1] -= transfer
    debtors[di][1] -= transfer

    if (creditors[ci][1] < EPS) ci++
    if (debtors[di][1] < EPS) di++
  }

  return suggestions
}
