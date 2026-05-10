import TelegramBot from 'node-telegram-bot-api';
import http from 'http';
import cron from 'node-cron';
import { initDatabase, addExpense, addIncome, getExpensesByMonth, getIncomeByMonth, getKnownChats, getLastExpenses, getSetting, deleteExpense, setSetting, upsertChat } from './database';
import { parseTransactionMessage, getAllCategories } from './parser';
import { parseTransactionWithAi } from './aiParser';
import { generateMonthlyReport, formatReportAsText, formatExpenseConfirmation, formatIncomeConfirmation, formatLastExpenses, formatSummary } from './reports';

const token = process.env.TELEGRAM_BOT_TOKEN;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FinBot Telegram</title>
        <style>
          body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#111; color:#fff; font-family:Arial, sans-serif; }
          .container { max-width:520px; padding:32px; }
          h1 { margin:0 0 12px; }
          p { color:#ccc; line-height:1.5; }
          code { background:#222; padding:2px 6px; border-radius:4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>FinBot Telegram</h1>
          <p>O bot esta rodando. Abra seu bot no Telegram e envie <code>/start</code> ou <code>ajuda</code>.</p>
        </div>
      </body>
    </html>
  `);
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

  if (lowerBody === 'ajuda' || lowerBody === 'help' || lowerBody === 'comandos' || lowerBody === '/help') {
    await bot.sendMessage(chatId, getHelpText());
    return;
  }

  if (lowerBody === 'categorias' || lowerBody === '/categorias') {
    await bot.sendMessage(chatId, `Categorias disponiveis:\n\n${getAllCategories()}`);
    return;
  }

  if (lowerBody === 'resumo' || lowerBody === '/resumo') {
    await sendSummary(bot, message);
    return;
  }

  if (lowerBody === 'relatorio' || lowerBody === 'relatório' || lowerBody === '/relatorio') {
    await sendFullReport(bot, message);
    return;
  }

  if (lowerBody.startsWith('ultimos') || lowerBody.startsWith('/ultimos')) {
    const limit = Number.parseInt(lowerBody.replace('/ultimos', '').replace('ultimos', '').trim(), 10) || 10;
    await sendLastExpenses(bot, message, limit);
    return;
  }

  if (lowerBody.startsWith('excluir') || lowerBody.startsWith('deletar') || lowerBody.startsWith('/excluir')) {
    const idOrIndex = body.replace(/\/excluir|excluir|deletar/gi, '').trim();
    await deleteExpenseById(bot, message, idOrIndex);
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
