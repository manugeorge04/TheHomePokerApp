export interface Profile {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  preferred_buyin: number;
  created_at: string;
}

export interface Session {
  id: string;
  join_code: string;
  host_id: string;
  title: string;
  status: 'active' | 'closed';
  notes: string | null;
  tags: string[];
  accounting_difference: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface SessionPlayer {
  id: string;
  session_id: string;
  user_id: string | null;
  display_name: string;
  total_buyin: number;
  cashout: number | null;
  result: number | null;
  position: number | null;
  joined_at: string;
}

export interface BuyIn {
  id: string;
  session_id: string;
  session_player_id: string;
  amount: number;
  is_rebuy: boolean;
  created_at: string;
}

export interface CashOut {
  id: string;
  session_id: string;
  session_player_id: string;
  amount: number;
  created_at: string;
}

export interface Approval {
  id: string;
  session_id: string;
  approved_by: string;
  difference: number;
  reason: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  session_id: string | null;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface PlayerStats {
  totalSessions: number;
  totalBuyins: number;
  totalCashouts: number;
  netProfit: number;
  avgProfitPerSession: number;
  largestWin: number;
  largestLoss: number;
  winningSessionsPct: number;
  losingSessionsPct: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLoseStreak: number;
  timesFirst: number;
  timesTopThree: number;
  roi: number;
}
