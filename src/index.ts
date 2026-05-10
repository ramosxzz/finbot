import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import http from 'http';
import cron from 'node-cron';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer';
import { initDatabase, addExpense, getExpensesByMonth, getLastExpenses, deleteExpense } from './database';
import { parseExpenseMessage, getAllCategories } from './parser';
import { generateMonthlyReport, formatReportAsText, formatExpenseConfirmation, formatLastExpenses, formatSummary } from './reports';
import { Category } from './types';

let latestQR: string = '';
const authDir = process.env.WWEBJS_AUTH_DIR || '.wwebjs_auth';

const server = http.createServer(async (req, res) => {
  if (req.url === '/qr' && latestQR) {
    const qrImage = await QRCode.toDataURL(latestQR, { width: 400 });
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>FinBot - QR Code</title>
          <style>
            body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#111; font-family:Arial; }
            .container { text-align:center; background:#fff; padding:30px; border-radius:16px; }
            h1 { color:#075E54; margin-bottom:8px; }
            p { color:#666; font-size:14px; }
            img { margin:16px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>FinBot</h1>
            <p>Escaneie com WhatsApp &rarr; Aparelhos conectados</p>
            <img src="${qrImage}" />
          </div>
        </body>
      </html>
    `);
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>FinBot is running</h1><p>Go to <a href="/qr">/qr</a> to scan the QR code</p>');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Servidor web rodando na porta ${PORT}`);
  console.log(`📱 Acesse http://localhost:${PORT}/qr pra escanear o QR Code`);
});

async function main() {
  console.log('🤖 FinBot - Assistente Financeiro starting...');

  await initDatabase();
  console.log('✅ Banco de dados inicializado!');

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: authDir
    }),
    puppeteer: await getPuppeteerConfig()
  });

  client.on('qr', (qr: string) => {
    latestQR = qr;
    console.log('\n📱 QR Code atualizado! Acesse /qr no navegador pra escanear.');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    latestQR = '';
    console.log('✅ FinBot conectado e pronto!');
    console.log('📱 Envie uma mensagem para começar.\n');

    cron.schedule('0 9 1 * *', () => {
      console.log('📊 Enviando relatório mensal...');
      sendMonthlyReport(client);
    });
  });

  client.on('message', async (message: Message) => {
    try {
      await handleMessage(message);
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

async function handleMessage(message: Message): Promise<void> {
  const body = message.body.trim();
  const lowerBody = body.toLowerCase();

  console.log(`📩 Mensagem de ${message.from}: ${body}`);

  if (lowerBody === 'ajuda' || lowerBody === 'help' || lowerBody === 'comandos') {
    await sendHelp(message);
    return;
  }

  if (lowerBody === 'categorias') {
    await message.reply(`🏷️ *Categorias disponíveis:*\n\n${getAllCategories()}`);
    return;
  }

  if (lowerBody === 'resumo') {
    await sendSummary(message);
    return;
  }

  if (lowerBody === 'relatorio' || lowerBody === 'relatório') {
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

async function getPuppeteerConfig() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    };
  }

  if (process.platform === 'win32') {
    return {
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    };
  }

  return {
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: true
  };
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
