import { Expense, Category, MonthlyReport } from './types';
import { getExpensesByMonth, getPreviousMonthData } from './database';

export function generateMonthlyReport(year: number, month: number): MonthlyReport {
  const expenses = getExpensesByMonth(year, month);

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryBreakdown: Record<string, number> = {};
  for (const expense of expenses) {
    const cat = expense.category;
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + expense.amount;
  }

  const topExpenses = [...expenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const daysInMonth = new Date(year, month, 0).getDate();
  const currentDay = new Date().getMonth() === month - 1 ? new Date().getDate() : daysInMonth;
  const averageDaily = currentDay > 0 ? totalSpent / currentDay : 0;

  const previousMonth = getPreviousMonthData(year, month);
  let comparisonWithPreviousMonth: number | null = null;

  if (previousMonth && previousMonth.total > 0) {
    comparisonWithPreviousMonth = ((totalSpent - previousMonth.total) / previousMonth.total) * 100;
  }

  const tips = generateTips(expenses, categoryBreakdown, totalSpent, comparisonWithPreviousMonth);

  return {
    month: monthNames[month - 1],
    year,
    totalSpent,
    categoryBreakdown,
    topExpenses,
    tips,
    averageDaily,
    comparisonWithPreviousMonth
  };
}

function generateTips(
  expenses: Expense[],
  categoryBreakdown: Record<string, number>,
  totalSpent: number,
  comparisonWithPreviousMonth: number | null
): string[] {
  const tips: string[] = [];

  if (expenses.length === 0) {
    tips.push('Nenhum gasto registrado este mês. Comece a registrar suas despesas!');
    return tips;
  }

  const sortedCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a);

  const topCategory = sortedCategories[0];
  if (topCategory) {
    const percentage = ((topCategory[1] / totalSpent) * 100).toFixed(0);
    tips.push(`Seu maior gasto foi com ${topCategory[0]} (${percentage}% do total)`);
  }

  if (comparisonWithPreviousMonth !== null) {
    if (comparisonWithPreviousMonth > 10) {
      tips.push(`⚠️ Você gastou ${comparisonWithPreviousMonth.toFixed(0)}% a mais que no mês passado`);
    } else if (comparisonWithPreviousMonth < -10) {
      tips.push(`🎉 Parabéns! Você gastou ${Math.abs(comparisonWithPreviousMonth).toFixed(0)}% menos que no mês passado`);
    }
  }

  const foodExpenses = categoryBreakdown[Category.ALIMENTACAO] || 0;
  if (foodExpenses > totalSpent * 0.3) {
    tips.push('💡 Considere cozinhar mais em casa para reduzir gastos com alimentação');
  }

  const leisureExpenses = categoryBreakdown[Category.LAZER] || 0;
  if (leisureExpenses > totalSpent * 0.2) {
    tips.push('💡 Seus gastos com lazer estão altos. Que tal buscar opções gratuitas?');
  }

  const transportExpenses = categoryBreakdown[Category.TRANSPORTE] || 0;
  if (transportExpenses > totalSpent * 0.25) {
    tips.push('💡 Considere usar transporte público ou carona para reduzir gastos com transporte');
  }

  if (expenses.length < 10) {
    tips.push('📝 Continue registrando seus gastos para obter análises mais precisas');
  }

  return tips;
}

export function formatReportAsText(report: MonthlyReport): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════╗');
  lines.push(`║   📊 RELATÓRIO FINANCEIRO - ${report.month.toUpperCase()}/${report.year} ║`);
  lines.push('╠══════════════════════════════════════╣');
  lines.push('║');
  lines.push(`║   💰 TOTAL GASTO: R$ ${report.totalSpent.toFixed(2).replace('.', ',')}`);
  lines.push(`║   📅 MÉDIA DIÁRIA: R$ ${report.averageDaily.toFixed(2).replace('.', ',')}`);

  if (report.comparisonWithPreviousMonth !== null) {
    const emoji = report.comparisonWithPreviousMonth > 0 ? '📈' : '📉';
    lines.push(`║   ${emoji} VS MÊS PASSADO: ${report.comparisonWithPreviousMonth > 0 ? '+' : ''}${report.comparisonWithPreviousMonth.toFixed(0)}%`);
  }

  lines.push('║');
  lines.push('║   📈 POR CATEGORIA:');

  const sortedCategories = Object.entries(report.categoryBreakdown)
    .sort(([, a], [, b]) => b - a);

  const maxAmount = Math.max(...Object.values(report.categoryBreakdown));
  const barLength = 10;

  for (const [category, amount] of sortedCategories) {
    const barFilled = Math.round((amount / maxAmount) * barLength);
    const bar = '█'.repeat(barFilled) + '░'.repeat(barLength - barFilled);
    const amountStr = `R$ ${amount.toFixed(2).replace('.', ',')}`;
    lines.push(`║   ${category} ${bar} ${amountStr.padStart(15)}`);
  }

  lines.push('║');

  if (report.topExpenses.length > 0) {
    lines.push('║   🔥 TOP GASTOS:');
    report.topExpenses.slice(0, 5).forEach((expense, index) => {
      const desc = expense.description.length > 30
        ? expense.description.substring(0, 27) + '...'
        : expense.description;
      lines.push(`║   ${index + 1}. ${desc} - R$ ${expense.amount.toFixed(2).replace('.', ',')}`);
    });
    lines.push('║');
  }

  if (report.tips.length > 0) {
    lines.push('║   💡 DICAS DO MÊS:');
    report.tips.forEach(tip => {
      const tipLine = tip.length > 40 ? tip.substring(0, 37) + '...' : tip;
      lines.push(`║   • ${tipLine}`);
    });
  }

  lines.push('║');
  lines.push('╚══════════════════════════════════════╝');

  return lines.join('\n');
}

export function formatExpenseConfirmation(expense: Expense): string {
  const dateStr = expense.date.toLocaleDateString('pt-BR');
  return `✅ *Gasto registrado!*\n\n📝 *Descrição:* ${expense.description}\n💰 *Valor:* R$ ${expense.amount.toFixed(2).replace('.', ',')}\n🏷️ *Categoria:* ${expense.category}\n📅 *Data:* ${dateStr}\n🆔 *ID:* \`${expense.id}\``;
}

export function formatLastExpenses(expenses: Expense[]): string {
  if (expenses.length === 0) {
    return '📭 Nenhum gasto registrado ainda.';
  }

  const lines: string[] = [];
  lines.push('📋 *Últimos gastos:*\n');

  expenses.forEach((expense, index) => {
    const dateStr = expense.date.toLocaleDateString('pt-BR');
    lines.push(`${index + 1}. ${expense.category} - R$ ${expense.amount.toFixed(2).replace('.', ',')} (${dateStr})`);
    lines.push(`   └ ${expense.description}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function formatSummary(month: number, year: number, expenses: Expense[]): string {
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals: Record<string, number> = {};
  for (const expense of expenses) {
    const cat = expense.category;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amount;
  }

  let response = `📊 *Resumo de ${monthNames[month - 1]}/${year}*\n\n`;
  response += `💰 *Total:* R$ ${total.toFixed(2).replace('.', ',')}\n`;
  response += `📝 *Total de gastos:* ${expenses.length}\n\n`;

  response += '📈 *Por categoria:*\n';
  for (const [category, amount] of Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)) {
    response += `• ${category}: R$ ${amount.toFixed(2).replace('.', ',')}\n`;
  }

  return response;
}