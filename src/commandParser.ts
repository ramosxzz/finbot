export type BotCommand =
  | { type: 'help' }
  | { type: 'categories' }
  | { type: 'summary' }
  | { type: 'report' }
  | { type: 'last'; limit: number }
  | { type: 'delete'; id: string };

export function parseCommand(message: string): BotCommand | null {
  const text = normalize(message);

  if (matchesAny(text, ['ajuda', 'help', 'comandos', '/help', '/start'])) {
    return { type: 'help' };
  }

  if (matchesAny(text, ['categorias', 'categoria', '/categorias'])) {
    return { type: 'categories' };
  }

  if (
    matchesAny(text, ['resumo', '/resumo', 'saldo', 'balanco', 'balanço']) ||
    containsAny(text, ['quero resumo', 'manda resumo', 'me mostra resumo', 'qual meu saldo'])
  ) {
    return { type: 'summary' };
  }

  if (
    matchesAny(text, ['relatorio', 'relatório', '/relatorio']) ||
    containsAll(text, ['manda', 'relatorio']) ||
    containsAll(text, ['mandar', 'relatorio']) ||
    containsAll(text, ['quero', 'relatorio']) ||
    containsAll(text, ['gerar', 'relatorio']) ||
    containsAll(text, ['me', 'relatorio'])
  ) {
    return { type: 'report' };
  }

  if (text.startsWith('ultimos') || text.startsWith('/ultimos') || containsAny(text, ['ultimos', 'ultimos gastos', 'ultimos lancamentos'])) {
    const limit = Number.parseInt(text.match(/\d+/)?.[0] || '', 10) || 10;
    return { type: 'last', limit };
  }

  if (text.startsWith('excluir') || text.startsWith('deletar') || text.startsWith('/excluir')) {
    const id = message.replace(/\/excluir|excluir|deletar/gi, '').trim();
    return { type: 'delete', id };
  }

  return null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAny(text: string, values: string[]): boolean {
  return values.some(value => text === normalize(value));
}

function containsAny(text: string, values: string[]): boolean {
  return values.some(value => text.includes(normalize(value)));
}

function containsAll(text: string, values: string[]): boolean {
  return values.every(value => text.includes(normalize(value)));
}
