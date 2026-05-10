import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';
import chromium from '@sparticuz/chromium';
import { initDatabase, addExpense, getExpensesByMonth, getLastExpenses, deleteExpense } from './database';
import { parseExpenseMessage, getAllCategories } from './parser';
import { generateMonthlyReport, formatReportAsText, formatExpenseConfirmation, formatLastExpenses, formatSummary } from './reports';
import { Category } from './types';

async function main() {
  console.log('🤖 FinBot - Assistente Financeiro starting...');

  await initDatabase();
  console.log('✅ Banco de dados inicializado!');

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: '.wwebjs_auth'
    }),
    puppeteer: {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true
    }
  });

  client.on('qr', (qr: string) => {
    console.log('\n📱 Escaneie o QR Code abaixo para conectar ao WhatsApp:\n');
    qrcode.generate(qr, { small: true });
    console.log('\n');
  });

  client.on('ready', () => {
    console.log('✅ FinBot conectado e pronto!');
    console.log('📱 Envie uma mensagem para começar.\n');

    cron.schedule('0 9 1 * *', () => {
      console.log('📊 Enviando relatório mensal...');
      sendMonthlyReport(client);
    });
  });

  client.on('message', async (message: Message) => {
    try {
      await handleMessage(message, client);
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      await message.reply('❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.');
    }
  });

  client.on('disconnected', () => {
    console.log('❌ FinBot desconectado. Reconectando...');
  });

  client.initialize();
}

async function handleMessage(message: Message, client: Client): Promise<void> {
  const body = message.body.trim();
  const lowerBody = body.toLowerCase();
  const contact = message.from;

  console.log(`📩 Mensagem de ${contact}: ${body}`);

  if (lowerBody === 'ajuda' || lowerBody === 'help' || lowerBody === 'comandos') {
    await sendHelp(message);
    return;
  }

  if (lowerBody === 'categorias' || lowerBody === 'listar categorias') {
    await message.reply(`🏷️ *Categorias disponíveis:*\n\n${getAllCategories()}`);
    return;
  }

  if (lowerBody.startsWith('resumo') || lowerBody === 'resumo') {
    await sendSummary(message);
    return;
  }

  if (lowerBody.startsWith('relatorio') || lowerBody === 'relatório') {
    await sendFullReport(message);
    return;
  }

  if (lowerBody.startsWith('ultimos')) {
    const limit = parseInt(lowerBody.replace('ultimos', '').trim()) || 10;
    await sendLastExpenses(message, limit);
    return;
  }

  if (lowerBody.startsWith('excluir') || lowerBody.startsWith('deletar')) {
    const idOrIndex = body.replace(/excluir|deletar/gi, '').trim();
    await deleteExpenseById(message, idOrIndex);
    return;
  }

  const parsed = parseExpenseMessage(body);
  if (parsed) {
    const expense = addExpense(parsed.amount, parsed.description, parsed.category);
    const confirmation = formatExpenseConfirmation(expense);
    await message.reply(confirmation);
    return;
  }

  await message.reply(
    `🤔 Não entendi sua mensagem.\n\n` +
    `Envie *ajuda* para ver os comandos disponíveis ou tente algo como:\n` +
    `*gastei 50 reais de almoço*`
  );
}

async function sendHelp(message: Message): Promise<void> {
  const helpText = `
🤖 *FinBot - Comandos Disponíveis*

💰 *Registrar gastos:*
• "gastei 50 de almoço"
• "gastei 25 no Uber"
• "gastei 100 reais no mercado"

📊 *Consultar:*
• *resumo* - Resumo do mês atual
• *ultimos 5* - Últimos 5 gastos
• *relatorio* - Relatório mensal completo

🏷️ *Categorias:*
• *categorias* - Ver todas as categorias

🗑️ *Gerenciar:*
• *excluir [ID]* - Excluir um gasto pelo ID

❓ *Ajuda:*
• *ajuda* - Mostrar este menu
`.trim();

  await message.reply(helpText);
}

async function sendSummary(message: Message): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const expenses = getExpensesByMonth(year, month);
  const summary = formatSummary(month, year, expenses);

  await message.reply(summary);
}

async function sendLastExpenses(message: Message, limit: number): Promise<void> {
  const expenses = getLastExpenses(limit);
  const formatted = formatLastExpenses(expenses);

  await message.reply(formatted);
}

async function sendFullReport(message: Message): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const report = generateMonthlyReport(year, month);
  const reportText = formatReportAsText(report);

  await message.reply(reportText);
}

async function deleteExpenseById(message: Message, idOrIndex: string): Promise<void> {
  const trimmed = idOrIndex.trim();

  if (!trimmed) {
    await message.reply('⚠️ Forneça o ID do gasto a excluir. Use *ultimos* para ver os gastos e seus IDs.');
    return;
  }

  const deleted = deleteExpense(trimmed);

  if (deleted) {
    await message.reply(`🗑️ Gasto excluído com sucesso!`);
  } else {
    await message.reply(`❌ ID não encontrado. Use *ultimos* para ver os gastos e seus IDs.`);
  }
}

async function sendMonthlyReport(client: Client): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const report = generateMonthlyReport(year, month);
  const reportText = formatReportAsText(report);

  const chats = await client.getChats();
  const personalChat = chats.find(chat => !chat.isGroup && chat.id._serialized !== 'status@broadcast');

  if (personalChat) {
    await client.sendMessage(personalChat.id._serialized, reportText);
    console.log('📊 Relatório mensal enviado!');
  } else {
    console.log('⚠️ Nenhum chat pessoal encontrado para enviar o relatório.');
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});