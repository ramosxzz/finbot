import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { Expense, Category, KnownChat, TransactionType } from './types';
import { v4 as uuidv4 } from 'uuid';

let db: Database;

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'finbot.db');

export async function initDatabase(): Promise<void> {
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
      type TEXT NOT NULL DEFAULT 'expense',
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  ensureTypeColumn();

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chats (
      chatId TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  saveDatabase();
}

function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function addExpense(amount: number, description: string, category: Category, date: Date = new Date()): Expense {
  return addTransaction(amount, description, category, 'expense', date);
}

export function addIncome(amount: number, description: string, date: Date = new Date()): Expense {
  return addTransaction(amount, description, Category.OUTROS, 'income', date);
}

function addTransaction(amount: number, description: string, category: Category, type: TransactionType, date: Date = new Date()): Expense {
  const id = uuidv4();
  const now = new Date();

  db.run(
    'INSERT INTO expenses (id, amount, description, category, type, date, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, amount, description, category, type, date.toISOString(), now.toISOString()]
  );

  saveDatabase();

  return { id, amount, description, category, type, date, createdAt: now };
}

export function getExpensesByMonth(year: number, month: number): Expense[] {
  return getTransactionsByMonth(year, month, 'expense');
}

export function getIncomeByMonth(year: number, month: number): Expense[] {
  return getTransactionsByMonth(year, month, 'income');
}

export function getTransactionsByMonth(year: number, month: number, type?: TransactionType): Expense[] {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const whereType = type ? ' AND type = ?' : '';
  const stmt = db.prepare(`SELECT * FROM expenses WHERE date >= ? AND date <= ?${whereType} ORDER BY date DESC`);
  const params = type
    ? [startDate.toISOString(), endDate.toISOString(), type]
    : [startDate.toISOString(), endDate.toISOString()];
  stmt.bind(params);

  const expenses: Expense[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    expenses.push({
      id: row.id,
      amount: row.amount,
      description: row.description,
      category: row.category as Category,
      type: (row.type || 'expense') as TransactionType,
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
      type: (row.type || 'expense') as TransactionType,
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

  const stmt = db.prepare('SELECT * FROM expenses WHERE type = ? AND category = ? AND date >= ? AND date <= ? ORDER BY date DESC');
  stmt.bind(['expense', category, startDate.toISOString(), endDate.toISOString()]);

  const expenses: Expense[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    expenses.push({
      id: row.id,
      amount: row.amount,
      description: row.description,
      category: row.category as Category,
      type: (row.type || 'expense') as TransactionType,
      date: new Date(row.date),
      createdAt: new Date(row.createdAt)
    });
  }
  stmt.free();

  return expenses;
}

export function getTransactionsFiltered(options: {
  year?: number;
  month?: number;
  type?: TransactionType;
  category?: string;
}): Expense[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.year !== undefined && options.month !== undefined) {
    const startDate = new Date(options.year, options.month - 1, 1);
    const endDate = new Date(options.year, options.month, 0, 23, 59, 59, 999);
    conditions.push('date >= ? AND date <= ?');
    params.push(startDate.toISOString(), endDate.toISOString());
  } else if (options.year !== undefined) {
    const startDate = new Date(options.year, 0, 1);
    const endDate = new Date(options.year, 11, 31, 23, 59, 59, 999);
    conditions.push('date >= ? AND date <= ?');
    params.push(startDate.toISOString(), endDate.toISOString());
  }

  if (options.type) {
    conditions.push('type = ?');
    params.push(options.type);
  }

  if (options.category) {
    conditions.push('category = ?');
    params.push(options.category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = db.prepare(`SELECT * FROM expenses ${where} ORDER BY date DESC`);
  if (params.length > 0) stmt.bind(params);

  const expenses: Expense[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    expenses.push({
      id: row.id,
      amount: row.amount,
      description: row.description,
      category: row.category as Category,
      type: (row.type || 'expense') as TransactionType,
      date: new Date(row.date),
      createdAt: new Date(row.createdAt)
    });
  }
  stmt.free();

  return expenses;
}

export function getAvailableMonths(): { year: number; month: number }[] {
  const stmt = db.prepare(`
    SELECT DISTINCT
      CAST(strftime('%Y', date) AS INTEGER) as year,
      CAST(strftime('%m', date) AS INTEGER) as month
    FROM expenses
    ORDER BY year DESC, month DESC
  `);

  const months: { year: number; month: number }[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    months.push({ year: Number(row.year), month: Number(row.month) });
  }
  stmt.free();

  return months;
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

export function upsertChat(chatId: string): void {
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO chats (chatId, createdAt, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(chatId) DO UPDATE SET updatedAt = excluded.updatedAt`,
    [chatId, now, now]
  );

  saveDatabase();
}

export function getKnownChats(): KnownChat[] {
  const stmt = db.prepare('SELECT * FROM chats ORDER BY updatedAt DESC');
  const chats: KnownChat[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    chats.push({
      chatId: String(row.chatId),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    });
  }
  stmt.free();

  return chats;
}

export function getSetting(key: string): string | null {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  stmt.bind([key]);

  let value: string | null = null;
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    value = String(row.value);
  }
  stmt.free();

  return value;
}

export function setSetting(key: string, value: string): void {
  db.run(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );

  saveDatabase();
}

function ensureTypeColumn(): void {
  const stmt = db.prepare('PRAGMA table_info(expenses)');
  const columns: string[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject() as { name?: string };
    if (row.name) {
      columns.push(row.name);
    }
  }
  stmt.free();

  if (!columns.includes('type')) {
    db.run("ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'");
  }
}
