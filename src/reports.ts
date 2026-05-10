import { Expense, Category, MonthlyReport } from './types';
import { getExpensesByMonth, getIncomeByMonth, getPreviousMonthData } from './database';

export function generateMonthlyReport(year: number, month: number): MonthlyReport {
  const expenses = getExpensesByMonth(year, month);
  const income = getIncomeByMonth(year, month);

  const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = income.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalSpent;

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
    totalIncome,
    balance,
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
    tips.push('Nenhum gasto registrado este mes. Comece a registrar suas despesas.');
    return tips;
  }

  const sortedCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a);

  const topCategory = sortedCategories[0];
  if (topCategory) {
    const percentage = ((topCategory[1] / totalSpent) * 100).toFixed(0);
    tips.push(`Seu maior gasto foi com ${topCategory[0]} (${percentage}% do total).`);
  }

  if (comparisonWithPreviousMonth !== null) {
    if (comparisonWithPreviousMonth > 10) {
      tips.push(`Voce gastou ${comparisonWithPreviousMonth.toFixed(0)}% a mais que no mes passado.`);
    } else if (comparisonWithPreviousMonth < -10) {
      tips.push(`Parabens! Voce gastou ${Math.abs(comparisonWithPreviousMonth).toFixed(0)}% menos que no mes passado.`);
    }
  }

  const foodExpenses = categoryBreakdown[Category.ALIMENTACAO] || 0;
  if (foodExpenses > totalSpent * 0.3) {
    tips.push('Considere cozinhar mais em casa para reduzir gastos com alimentacao.');
  }

  const leisureExpenses = categoryBreakdown[Category.LAZER] || 0;
  if (leisureExpenses > totalSpent * 0.2) {
    tips.push('Seus gastos com lazer estao altos. Que tal buscar opcoes gratuitas?');
  }

  const transportExpenses = categoryBreakdown[Category.TRANSPORTE] || 0;
  if (transportExpenses > totalSpent * 0.25) {
    tips.push('Considere usar transporte publico ou carona para reduzir gastos com transporte.');
  }

  if (expenses.length < 10) {
    tips.push('Continue registrando seus gastos para obter analises mais precisas.');
  }

  return tips;
}

export function formatReportAsText(report: MonthlyReport): string {
  const lines: string[] = [];

  lines.push(`RELATORIO FINANCEIRO - ${report.month.toUpperCase()}/${report.year}`);
  lines.push('');
  lines.push(`TOTAL GASTO: R$ ${formatMoney(report.totalSpent)}`);
  lines.push(`TOTAL RECEBIDO: R$ ${formatMoney(report.totalIncome)}`);
  lines.push(`SALDO: R$ ${formatMoney(report.balance)}`);
  lines.push(`MEDIA DIARIA: R$ ${formatMoney(report.averageDaily)}`);

  if (report.comparisonWithPreviousMonth !== null) {
    lines.push(`VS MES PASSADO: ${report.comparisonWithPreviousMonth > 0 ? '+' : ''}${report.comparisonWithPreviousMonth.toFixed(0)}%`);
  }

  lines.push('');
  lines.push('POR CATEGORIA:');

  const sortedCategories = Object.entries(report.categoryBreakdown)
    .sort(([, a], [, b]) => b - a);

  if (sortedCategories.length === 0) {
    lines.push('- Nenhum gasto registrado.');
  }

  for (const [category, amount] of sortedCategories) {
    lines.push(`- ${category}: R$ ${formatMoney(amount)}`);
  }

  if (report.topExpenses.length > 0) {
    lines.push('');
    lines.push('TOP GASTOS:');
    report.topExpenses.slice(0, 5).forEach((expense, index) => {
      lines.push(`${index + 1}. ${expense.description} - R$ ${formatMoney(expense.amount)}`);
    });
  }

  if (report.tips.length > 0) {
    lines.push('');
    lines.push('DICAS DO MES:');
    report.tips.forEach(tip => lines.push(`- ${tip}`));
  }

  return lines.join('\n');
}

export function formatExpenseConfirmation(expense: Expense): string {
  const dateStr = expense.date.toLocaleDateString('pt-BR');
  return `Gasto registrado!\n\nDescricao: ${expense.description}\nValor: R$ ${formatMoney(expense.amount)}\nCategoria: ${expense.category}\nData: ${dateStr}\nID: ${expense.id}`;
}

export function formatIncomeConfirmation(income: Expense): string {
  const dateStr = income.date.toLocaleDateString('pt-BR');
  return `Recebimento registrado!\n\nDescricao: ${income.description}\nValor: R$ ${formatMoney(income.amount)}\nData: ${dateStr}\nID: ${income.id}`;
}

export function formatLastExpenses(transactions: Expense[]): string {
  if (transactions.length === 0) {
    return 'Nenhum lancamento registrado ainda.';
  }

  const lines: string[] = [];
  lines.push('Ultimos lancamentos:\n');

  transactions.forEach((transaction, index) => {
    const dateStr = transaction.date.toLocaleDateString('pt-BR');
    const label = transaction.type === 'income' ? 'Recebido' : transaction.category;
    const sign = transaction.type === 'income' ? '+' : '-';
    lines.push(`${index + 1}. ${label} - ${sign}R$ ${formatMoney(transaction.amount)} (${dateStr})`);
    lines.push(`   ${transaction.description}`);
    lines.push(`   ID: ${transaction.id}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function formatSummary(month: number, year: number, expenses: Expense[], income: Expense[] = []): string {
  const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = income.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - total;

  const categoryTotals: Record<string, number> = {};
  for (const expense of expenses) {
    const cat = expense.category;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amount;
  }

  let response = `Resumo de ${monthNames[month - 1]}/${year}\n\n`;
  response += `Recebido: R$ ${formatMoney(totalIncome)}\n`;
  response += `Gasto: R$ ${formatMoney(total)}\n`;
  response += `Saldo: R$ ${formatMoney(balance)}\n`;
  response += `Total de gastos: ${expenses.length}\n\n`;

  response += 'Por categoria:\n';
  const entries = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) {
    response += '- Nenhum gasto registrado.\n';
  }

  for (const [category, amount] of entries) {
    response += `- ${category}: R$ ${formatMoney(amount)}\n`;
  }

  return response;
}

function formatMoney(value: number): string {
  return value.toFixed(2).replace('.', ',');
}
