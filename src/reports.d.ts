import { Expense, MonthlyReport } from './types';
export declare function generateMonthlyReport(year: number, month: number): MonthlyReport;
export declare function formatReportAsText(report: MonthlyReport): string;
export declare function formatExpenseConfirmation(expense: Expense): string;
export declare function formatLastExpenses(expenses: Expense[]): string;
export declare function formatSummary(month: number, year: number, expenses: Expense[]): string;
//# sourceMappingURL=reports.d.ts.map