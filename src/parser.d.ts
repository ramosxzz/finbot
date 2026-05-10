import { Category } from './types';
interface ParsedExpense {
    amount: number;
    description: string;
    category: Category;
}
export declare function parseExpenseMessage(message: string): ParsedExpense | null;
export declare function getAllCategories(): string;
export {};
//# sourceMappingURL=parser.d.ts.map