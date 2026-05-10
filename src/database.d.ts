import { Expense, Category } from './types';
export declare function initDatabase(): Promise<void>;
export declare function addExpense(amount: number, description: string, category: Category, date?: Date): Expense;
export declare function getExpensesByMonth(year: number, month: number): Expense[];
export declare function getLastExpenses(limit?: number): Expense[];
export declare function deleteExpense(id: string): boolean;
export declare function getExpensesByCategory(category: Category, year: number, month: number): Expense[];
export declare function getPreviousMonthData(year: number, month: number): {
    total: number;
    categories: Record<string, number>;
} | null;
//# sourceMappingURL=database.d.ts.map