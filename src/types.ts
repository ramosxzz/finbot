export enum Category {
  ALIMENTACAO = '🍔 Alimentação',
  TRANSPORTE = '🚗 Transporte',
  LAZER = '🎮 Lazer',
  SAUDE = '🏥 Saúde',
  EDUCACAO = '📚 Educação',
  MORADIA = '🏠 Moradia',
  COMPRAS = '🛒 Compras',
  SERVICOS = '📱 Serviços',
  OUTROS = '📦 Outros'
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: Category;
  date: Date;
  createdAt: Date;
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalSpent: number;
  categoryBreakdown: Record<string, number>;
  topExpenses: Expense[];
  tips: string[];
  averageDaily: number;
  comparisonWithPreviousMonth: number | null;
}

export interface BotMessage {
  type: 'success' | 'error' | 'info' | 'report';
  text: string;
}