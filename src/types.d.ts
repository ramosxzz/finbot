export declare enum Category {
    ALIMENTACAO = "\uD83C\uDF54 Alimenta\u00E7\u00E3o",
    TRANSPORTE = "\uD83D\uDE97 Transporte",
    LAZER = "\uD83C\uDFAE Lazer",
    SAUDE = "\uD83C\uDFE5 Sa\u00FAde",
    EDUCACAO = "\uD83D\uDCDA Educa\u00E7\u00E3o",
    MORADIA = "\uD83C\uDFE0 Moradia",
    COMPRAS = "\uD83D\uDED2 Compras",
    SERVICOS = "\uD83D\uDCF1 Servi\u00E7os",
    OUTROS = "\uD83D\uDCE6 Outros"
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
//# sourceMappingURL=types.d.ts.map