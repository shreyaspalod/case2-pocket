import type { Expense, Settlement, Profile } from '@/types'

function escape(val: string | number | null | undefined): string {
  const str = String(val ?? '')
  // Wrap in quotes if the value contains a comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(escape).join(',')
}

export function exportGroupCSV(
  groupName: string,
  expenses: Expense[],
  settlements: Settlement[],
  profiles: Map<string, Profile>
): string {
  const lines: string[] = []

  // Header
  lines.push(`Pocket — Group Export: ${groupName}`)
  lines.push(`Exported: ${new Date().toISOString()}`)
  lines.push('')

  // ── Expenses ──────────────────────────────────────────────
  lines.push('EXPENSES')
  lines.push(row(['Date', 'Description', 'Paid By', 'Total Amount', 'Split Details']))

  for (const e of expenses) {
    const paidByName = profiles.get(e.paid_by)?.name ?? e.paid_by
    const splitDetail = (e.expense_splits ?? [])
      .map(s => `${profiles.get(s.user_id)?.name ?? s.user_id}: ₹${s.amount.toFixed(2)}`)
      .join(' | ')
    const recurLabel = e.is_recurring ? ` [Recurring day ${e.recur_day}]` : ''
    lines.push(row([
      new Date(e.created_at).toLocaleDateString(),
      e.description + recurLabel,
      paidByName,
      e.amount.toFixed(2),
      splitDetail,
    ]))
  }

  lines.push('')

  // ── Settlements ───────────────────────────────────────────
  lines.push('SETTLEMENTS')
  lines.push(row(['Date', 'From', 'To', 'Amount', 'Note']))

  for (const s of settlements) {
    lines.push(row([
      new Date(s.created_at).toLocaleDateString(),
      profiles.get(s.paid_by)?.name ?? s.paid_by,
      profiles.get(s.paid_to)?.name ?? s.paid_to,
      s.amount.toFixed(2),
      s.note ?? '',
    ]))
  }

  return lines.join('\n')
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
