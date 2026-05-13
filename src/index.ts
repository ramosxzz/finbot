import TelegramBot from 'node-telegram-bot-api';
import http from 'http';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { initDatabase, addExpense, addIncome, getExpensesByMonth, getIncomeByMonth, getKnownChats, getLastExpenses, getSetting, deleteExpense, setSetting, upsertChat, getTransactionsFiltered, getAvailableMonths } from './database';
import { parseTransactionMessage, getAllCategories } from './parser';
import { parseTransactionWithAi } from './aiParser';
import { parseCommand } from './commandParser';
import { generateMonthlyReport, formatReportAsText, formatExpenseConfirmation, formatIncomeConfirmation, formatLastExpenses, formatSummary } from './reports';

const token = process.env.TELEGRAM_BOT_TOKEN;

function parseCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function parseQueryParams(url: string): Record<string, string> {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return {};
  const qs = url.slice(qIdx + 1);
  const result: Record<string, string> = {};
  for (const part of qs.split('&')) {
    const [k, v] = part.split('=');
    if (k) result[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
  }
  return result;
}

function sendJson(res: http.ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...parseCorsHeaders() });
  res.end(body);
}

function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): boolean {
  const params = parseQueryParams(req.url || '');

  if (pathname === '/api/health') {
    sendJson(res, { status: 'ok' });
    return true;
  }

  if (pathname === '/api/months') {
    try {
      const months = getAvailableMonths();
      sendJson(res, months);
    } catch {
      sendJson(res, { error: 'DB not ready' }, 503);
    }
    return true;
  }

  if (pathname === '/api/transactions') {
    try {
      const year = params.year ? Number(params.year) : undefined;
      const month = params.month ? Number(params.month) : undefined;
      const type = (params.type as 'expense' | 'income' | undefined) || undefined;
      const category = params.category || undefined;
      const transactions = getTransactionsFiltered({ year, month, type, category });
      const serialized = transactions.map(t => ({
        ...t,
        date: t.date.toISOString(),
        createdAt: t.createdAt.toISOString(),
      }));
      sendJson(res, serialized);
    } catch {
      sendJson(res, { error: 'DB not ready' }, 503);
    }
    return true;
  }

  if (pathname === '/api/summary') {
    try {
      const now = new Date();
      const year = params.year ? Number(params.year) : now.getFullYear();
      const month = params.month ? Number(params.month) : now.getMonth() + 1;

      const expenses = getExpensesByMonth(year, month);
      const income = getIncomeByMonth(year, month);

      const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
      const totalIncome = income.reduce((s, e) => s + e.amount, 0);

      const byCategory: Record<string, { total: number; count: number }> = {};
      for (const e of expenses) {
        if (!byCategory[e.category]) byCategory[e.category] = { total: 0, count: 0 };
        byCategory[e.category].total += e.amount;
        byCategory[e.category].count += 1;
      }

      const daysInMonth = new Date(year, month, 0).getDate();
      const dailyExpenses: { day: number; total: number }[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayTotal = expenses
          .filter(e => e.date.toISOString().startsWith(dayStr))
          .reduce((s, e) => s + e.amount, 0);
        dailyExpenses.push({ day: d, total: dayTotal });
      }

      sendJson(res, {
        year,
        month,
        totalExpenses,
        totalIncome,
        balance: totalIncome - totalExpenses,
        transactionCount: expenses.length + income.length,
        byCategory: Object.entries(byCategory)
          .map(([category, data]) => ({ category, ...data }))
          .sort((a, b) => b.total - a.total),
        dailyExpenses,
      });
    } catch {
      sendJson(res, { error: 'DB not ready' }, 503);
    }
    return true;
  }

  return false;
}

const publicDir = path.join(__dirname, '..', 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(res: http.ServerResponse, filePath: string): boolean {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const pathname = url.split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, parseCorsHeaders());
    res.end();
    return;
  }

  if (pathname === '/health') {
    sendJson(res, { status: 'ok' });
    return;
  }

  if (pathname.startsWith('/api/')) {
    const handled = handleApiRequest(req, res, pathname);
    if (!handled) sendJson(res, { error: 'Not found' }, 404);
    return;
  }

  const target = (pathname === '/' || pathname === '/dashboard')
    ? path.join(publicDir, 'index.html')
    : path.join(publicDir, pathname);

  if (!serveStatic(res, target)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, () => {
  console.log(`Servidor web rodando na porta ${PORT}`);
});

async function main() {
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN nao configurado. Crie um bot no BotFather e informe o token no Portainer.');
  }

  console.log('FinBot Telegram iniciando...');
  await initDatabase();
  console.log('Banco de dados inicializado.');

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/^\/start$/, async (message) => {
    upsertChat(String(message.chat.id));
    await bot.sendMessage(message.chat.id, getHelpText());
  });

  bot.on('message', async (message) => {
    if (!message.text) {
      return;
    }

    if (message.text.trim() === '/start') {
      return;
    }

    try {
      upsertChat(String(message.chat.id));
      await handleMessage(bot, message);
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      await bot.sendMessage(message.chat.id, 'Ocorreu um erro ao processar sua mensagem. Tente novamente.');
    }
  });

  bot.on('polling_error', (error) => {
    console.error('Erro no polling do Telegram:', error.message);
  });

  scheduleMonthlyReport(bot);

  console.log('FinBot Telegram conectado e pronto.');
}

async function handleMessage(bot: TelegramBot, message: TelegramBot.Message): Promise<void> {
  const body = message.text?.trim() || '';
  const lowerBody = body.toLowerCase();
  const chatId = message.chat.id;

  console.log(`Mensagem de ${chatId}: ${body}`);

  const command = parseCommand(body);
  if (command) {
    await handleCommand(bot, message, command);
    return;
  }

  const parsed = await parseTransaction(body);
  if (parsed) {
    const transaction = parsed.type === 'income'
      ? addIncome(parsed.amount, parsed.description, parsed.date)
      : addExpense(parsed.amount, parsed.description, parsed.category, parsed.date);
    const confirmation = parsed.type === 'income'
      ? formatIncomeConfirmation(transaction)
      : formatExpenseConfirmation(transaction);
    await bot.sendMessage(chatId, confirmation);
    return;
  }

  await bot.sendMessage(
    chatId,
    `Nao entendi sua mensagem.\n\n` +
    `Envie ajuda para ver os comandos disponiveis ou tente algo como:\n` +
    `gastei 50 reais de almoco\n` +
    `recebi 150 da raquel`
  );
}

async function handleCommand(bot: TelegramBot, message: TelegramBot.Message, command: NonNullable<ReturnType<typeof parseCommand>>): Promise<void> {
  if (command.type === 'help') {
    await bot.sendMessage(message.chat.id, getHelpText());
    return;
  }

  if (command.type === 'categories') {
    await bot.sendMessage(message.chat.id, `Categorias disponiveis:\n\n${getAllCategories()}`);
    return;
  }

  if (command.type === 'summary') {
    await sendSummary(bot, message);
    return;
  }

  if (command.type === 'report') {
    await sendFullReport(bot, message);
    return;
  }

  if (command.type === 'last') {
    await sendLastExpenses(bot, message, command.limit);
    return;
  }

  if (command.type === 'delete') {
    await deleteExpenseById(bot, message, command.id);
  }
}

async function parseTransaction(body: string) {
  try {
    const aiParsed = await parseTransactionWithAi(body);
    if (aiParsed) {
      return aiParsed;
    }
  } catch (error) {
    console.error('Erro ao interpretar com IA:', error);
  }

  return parseTransactionMessage(body);
}

function getHelpText(): string {
  return `
FinBot - Comandos Disponiveis

Registrar gastos:
- "gastei 50 de almoco"
- "gastei 25 no Uber"
- "gastei 100 reais no mercado"
- "paguei 80 de mercado"
- "comprei 35 de remedio"

Registrar recebimentos:
- "recebi 150 da raquel"
- "recebi 2000 no dia 06/05 da solaire"
- "ganhei 200 de comissao"
- "entrou 1200 salario"

Atalho:
- "10 uber paola" tambem registra gasto

Consultar:
- resumo - Resumo do mes atual
- ultimos 5 - Ultimos 5 gastos
- relatorio - Relatorio mensal completo
- O relatorio tambem e enviado automaticamente no 5o dia util do mes

Categorias:
- categorias - Ver todas as categorias

Gerenciar:
- excluir [ID] - Excluir um gasto pelo ID
`.trim();
}

function scheduleMonthlyReport(bot: TelegramBot): void {
  cron.schedule('0 9 * * *', async () => {
    await sendScheduledMonthlyReport(bot);
  }, {
    timezone: 'America/Sao_Paulo'
  });
}

async function sendScheduledMonthlyReport(bot: TelegramBot): Promise<void> {
  const now = new Date();

  if (!isFifthBusinessDay(now)) {
    return;
  }

  const key = `monthly_report_sent_${now.getFullYear()}_${now.getMonth() + 1}`;
  if (getSetting(key) === 'true') {
    return;
  }

  const report = generateMonthlyReport(now.getFullYear(), now.getMonth() + 1);
  const text = `Relatorio automatico do 5o dia util\n\n${formatReportAsText(report)}`;
  const chats = getKnownChats();

  for (const chat of chats) {
    await bot.sendMessage(chat.chatId, text);
  }

  setSetting(key, 'true');
}

function isFifthBusinessDay(date: Date): boolean {
  if (date.getDay() === 0 || date.getDay() === 6) {
    return false;
  }

  let businessDays = 0;
  for (let day = 1; day <= date.getDate(); day++) {
    const current = new Date(date.getFullYear(), date.getMonth(), day);
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      businessDays++;
    }
  }

  return businessDays === 5;
}

async function sendSummary(bot: TelegramBot, message: TelegramBot.Message): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const expenses = getExpensesByMonth(year, month);
  const income = getIncomeByMonth(year, month);
  const summary = formatSummary(month, year, expenses, income);

  await bot.sendMessage(message.chat.id, summary);
}

async function sendLastExpenses(bot: TelegramBot, message: TelegramBot.Message, limit: number): Promise<void> {
  const expenses = getLastExpenses(limit);
  const formatted = formatLastExpenses(expenses);

  await bot.sendMessage(message.chat.id, formatted);
}

async function sendFullReport(bot: TelegramBot, message: TelegramBot.Message): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const report = generateMonthlyReport(year, month);
  const reportText = formatReportAsText(report);

  await bot.sendMessage(message.chat.id, reportText);
}

async function deleteExpenseById(bot: TelegramBot, message: TelegramBot.Message, idOrIndex: string): Promise<void> {
  const trimmed = idOrIndex.trim();

  if (!trimmed) {
    await bot.sendMessage(message.chat.id, 'Forneca o ID do gasto a excluir. Use ultimos para ver os gastos e seus IDs.');
    return;
  }

  const deleted = deleteExpense(trimmed);

  if (deleted) {
    await bot.sendMessage(message.chat.id, 'Gasto excluido com sucesso!');
  } else {
    await bot.sendMessage(message.chat.id, 'ID nao encontrado. Use ultimos para ver os gastos e seus IDs.');
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
