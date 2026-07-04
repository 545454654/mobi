export interface Transaction {
  id: string;
  amount: number;
  accountId: string;
  platformId: string;
  platformName: string;
  playerName: string;
  date: string;
  type: 'deposit' | 'withdrawal' | 'wallet_charge';
  status: 'success' | 'pending' | 'failed';
  previousBalance?: number;
  remainingBalance?: number;
}

export interface Platform {
  id: string;
  name: string;
  logoText: string;
  gradient: string;
  accentColor: string;
  borderColor: string;
  hoverColor: string;
  minDeposit: number;
  maxDeposit: number;
}
