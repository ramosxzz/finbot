import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { Expense, Category } from './types';
import { v4 as uuidv4 } from 'uuid';

let db: Database;
const dbPath = path.join(__dirname, '..', 'data', 'finbot.db');

export async function initDatabase(): Promise<void> {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)
  `);

  saveDatabase();
}

function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function addExpense(amount: number, description: string, category: Category, date: Date = new Date()): Expense {
  const id = uuidv4();
  const now = new Date();

  db.run(
    'INSERT INTO expenses (id, amount, description, category, date, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, amount, description, category, date.toISOString(), now.toISOString()]
  );

  saveDatabase();

  return { id, amount, description, category, date, createdAt: now };
}

export function getExpensesByMonth(year: number, month: number): Expense[] {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const stmt = db.prepare('SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC');
  stmt.bind([startDate.toISOString(), endDate.toISOString()]);

  const expenses: Expense[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    expenses.push({
      id: row.id,
      amount: row.amount,
      description: row.description,
      category: row.category as Category,
      date: new Date(row.date),
      createdAt: new Date(row.createdAt)
    });
  }
  stmt.free();

  return expenses;
}

export function getLastExpenses(limit: number = 10): Expense[] {
  const stmt = db.prepare('SELECT * FROM expenses ORDER BY date DESC LIMIT ?');
  stmt.bind([limit]);

  const expenses: Expense[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    expenses.push({
      id: row.id,
      amount: row.amount,
      description: row.description,
      category: row.category as Category,
      date: new Date(row.date),
      createdAt: new Date(row.createdAt)
    });
  }
  stmt.free();

  return expenses;
}

export function deleteExpense(id: string): boolean {
  db.run('DELETE FROM expenses WHERE id = ?', [id]);
  const changes = db.getRowsModified();
  saveDatabase();
  return changes > 0;
}

export function getExpensesByCategory(category: Category, year: number, month: number): Expense[] {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const stmt = db.prepare('SELECT * FROM expenses WHERE category = ? AND date >= ? AND date <= ? ORDER BY date DESC');
  stmt.bind([category, startDate.toISOString(), endDate.toISOString()]);

  const expenses: Expense[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    expenses.push({
      id: row.id,
      amount: row.amount,
      description: row.description,
      category: row.category as Category,
      date: new Date(row.date),
      createdAt: new Date(row.createdAt)
    });
  }
  stmt.free();

  return expenses;
}

export function getPreviousMonthData(year: number, month: number): { total: number; categories: Record<string, number> } | null {
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear--;
  }

  const expenses = getExpensesByMonth(prevYear, prevMonth);

  if (expenses.length === 0) {
    return null;
  }

  const categories: Record<string, number> = {};
  let total = 0;

  for (const expense of expenses) {
    total += expense.amount;
    const cat = expense.category;
    categories[cat] = (categories[cat] || 0) + expense.amount;
  }

  return { total, categories };
}