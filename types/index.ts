// ── Domain types ────────────────────────────────────────────

export interface Profile {
  id: string
  name: string
  email: string
  created_at: string
}

export interface Group {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  joined_at: string
  profiles?: Profile
}

export interface Expense {
  id: string
  group_id: string
  paid_by: string
  description: string
  amount: number
  is_recurring: boolean
  recur_day: number | null
  created_at: string
  profiles?: Profile
  expense_splits?: ExpenseSplit[]
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  user_id: string
  amount: number
  profiles?: Profile
}

export interface Settlement {
  id: string
  group_id: string
  paid_by: string
  paid_to: string
  amount: number
  note: string | null
  created_at: string
  payer?: Profile
  payee?: Profile
}

// ── Computed balance types ───────────────────────────────────

/** Net balance per user: positive = others owe them, negative = they owe others */
export type BalanceMap = Map<string, number>

/** A single minimised settlement suggestion */
export interface SettlementSuggestion {
  from: string      // user_id of the debtor
  to: string        // user_id of the creditor
  fromName: string
  toName: string
  amount: number
}
