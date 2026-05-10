# FinBot - Assistente de Controle Financeiro via WhatsApp

## Concept & Vision

Um bot de WhatsApp que funciona como seu assistente financeiro pessoal. Envie mensagens simples como "gastei 50 reais de almoço" e ele categoriza, registra e analisa seus gastos. No final do mês, recebe um relatório completo com gráficos, dicas personalizadas e insights sobre seus hábitos financeiros. A experiência é conversacional e casual — sem planilhas, sem complicação.

## Design Language

- **Estética**: Interface de chat limpa e minimalista. O bot responde com mensagens formatadas, emojis contextuais e organização visual.
- **Paleta de cores**:
  - Primary: `#075E54` (verde WhatsApp)
  - Secondary: `#128C7E`
  - Accent: `#25D366` (verde sucesso)
  - Warning: `#FFA500`
  - Danger: `#DC3545`
  - Background: `#ECE5DD`
  - Text: `#111B21`
- **Tipografia**: Sistema native do WhatsApp Web — não há customização visual além das mensagens do bot.
- **Motion**: Mensagens aparecem instantaneamente, relatórios são formatados com separadores visuais (═, ─, █).

## Architecture

### Stack
- **Runtime**: Node.js com TypeScript
- **WhatsApp Integration**: whatsapp-web.js (bot que escaneia QR code)
- **Database**: SQLite com better-sqlite3 (leve, sem servidor)
- **Reports**: Geração de relatórios em texto formatado + imagens via canvas
- **Scheduler**: node-cron para envio de relatórios mensais

### Data Model

```typescript
interface Expense {
  id: string;
  amount: number;
  description: string;
  category: Category;
  date: Date;
  createdAt: Date;
}

enum Category {
  ALIMENTACAO = '🍔 Alimentação',
  TRANSPORTE = '🚗 Transporte',
  LAZER = '🎮 Lazer',
  SAUDE = '🏥 Saúde',
  EDUCACAO = '📚 Educação',
  MORADIA = '🏠 Moradia',
  COMPRAS = '🛒 Compras',
  OUTROS = '📦 Outros'
}

interface MonthlyReport {
  month: string;
  totalSpent: number;
  categoryBreakdown: Record<Category, number>;
  topExpenses: Expense[];
  tips: string[];
  averageDaily: number;
}
```

### API / Commands

O bot reconhece mensagens em português brasileiro:

| Mensagem | Ação |
|----------|------|
| `gastei [valor] de [descrição]` | Registra gasto (ex: "gastei 45 de almoço") |
| `gastei [valor] no [categoria] [descrição]` | Registra com categoria explícita |
| `resumo` | Retorna resumo do mês atual |
| `categorias` | Lista todas as categorias disponíveis |
| `ultimos [n]` | Mostra últimos N gastos |
| `excluir [id]` | Remove um gasto pelo ID |
| `ajuda` | Mostra comandos disponíveis |
| `relatorio` | Gera e envia relatório mensal completo |

### Monthly Report Format

```
╔══════════════════════════════════════╗
║   📊 RELATÓRIO FINANCEIRO - MAI/2026 ║
╠══════════════════════════════════════╣
║
║   💰 TOTAL GASTO: R$ 2.450,00
║   📅 MÉDIA DIÁRIA: R$ 81,67
║
║   📈 POR CATEGORIA:
║   🍔 Alimentação    ████████░░ R$ 850,00
║   🚗 Transporte     ██████░░░░ R$ 600,00
║   🎮 Lazer          ████░░░░░░ R$ 400,00
║   🏥 Saúde          ███░░░░░░░ R$ 300,00
║   📦 Outros         ███░░░░░░░ R$ 300,00
║
║   🔥 TOP GASTOS:
║   1. Almoço no restaurante - R$ 85,00
║   2. Uber para trabalho - R$ 45,00
║   3. Cinema - R$ 80,00
║
║   💡 DICAS DO MÊS:
║   • Você gastou 23% a mais em lazer que no mês anterior
║   • Seu maior gasto foi com alimentação (35% do total)
║   • Considere cozinhar mais em casa para economizar
║
╚══════════════════════════════════════╝
```

## Features

1. **Registro de Gastos por Voz/Texto**
   - Parsing inteligente de mensagens naturais
   - Categorização automática por palavras-chave
   - Confirmação visual do registro

2. **Consulta e Histórico**
   - Visualização dos últimos gastos
   - Busca por período ou categoria
   - Resumo mensal em tempo real

3. **Relatório Mensal Automático**
   - Enviado todo dia 1 às 9h
   - Análise comparativa com mês anterior
   - Dicas personalizadas baseadas em padrões

4. **Gestão de Dados**
   - Edição e exclusão de registros
   - Exportação em CSV
   - Backup automático

## Technical Approach

- **Single-file structure** para simplicidade de deployment
- **SQLite database** criado automaticamente na primeira execução
- **QR code** gerado no terminal para autenticação
- **Session persistence** para não precisar escanear QR toda vez
- **Message queue** para evitar rate limits do WhatsApp