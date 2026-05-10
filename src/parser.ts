import { Category, TransactionType } from './types';

export interface ParsedTransaction {
  amount: number;
  description: string;
  category: Category;
  type: TransactionType;
}

const categoryKeywords: Record<Category, string[]> = {
  [Category.ALIMENTACAO]: ['almoco', 'almoço', 'jantar', 'cafe', 'café', 'lanche', 'comida', 'restaurante', 'pizza', 'hamburguer', 'sorvete', 'acai', 'açai', 'açaí', 'padaria', 'ifood', 'mercado livre food', 'bebida', 'cerveja', 'refrigerante', 'suco'],
  [Category.TRANSPORTE]: ['uber', '99', 'gasolina', 'combustivel', 'combustível', 'onibus', 'ônibus', 'metro', 'metrô', 'trem', 'taxi', 'táxi', 'carro', 'estacionamento', 'pedagio', 'pedágio', 'moto'],
  [Category.LAZER]: ['cinema', 'jogo', 'game', 'netflix', 'spotify', 'youtube', 'serie', 'série', 'filme', 'show', 'teatro', 'futebol', 'balada', 'festa', 'pub', 'barbearia', 'barbeiro'],
  [Category.SAUDE]: ['medico', 'médico', 'farmacia', 'farmácia', 'remedio', 'remédio', 'consulta', 'exame', 'dentista', 'terapeuta', 'psicologo', 'psicólogo', 'academia', 'ginastica', 'ginástica', 'yoga'],
  [Category.EDUCACAO]: ['curso', 'livro', 'faculdade', 'universidade', 'escola', 'material', 'apostila', 'livraria', 'desk', 'monitor', 'headset', 'udemy', 'coursera'],
  [Category.MORADIA]: ['aluguel', 'luz', 'agua', 'água', 'gas', 'gás', 'internet', 'condominio', 'condomínio', 'iptu', 'seguro', 'manutencao', 'manutenção', 'reforma', 'moveis', 'móveis', 'eletro'],
  [Category.COMPRAS]: ['mercado', 'supermercado', 'roupa', 'sapato', 'celular', 'phone', 'notebook', 'computador', 'perfume', 'cosmetico', 'cosmético', 'presente', 'decoracao', 'decoração', 'shopping'],
  [Category.SERVICOS]: ['assinatura', 'app', 'aplicativo', 'servico', 'serviço', 'hosting', 'nuvem', 'cloud', 'software', 'licenca', 'licença'],
  [Category.OUTROS]: []
};

const expenseVerbs = ['gastei', 'paguei', 'comprei', 'pague', 'compre', 'debito', 'débito'];
const incomeVerbs = ['recebi', 'ganhei', 'entrou', 'caiu', 'depositaram', 'depositou'];

export function parseTransactionMessage(message: string): ParsedTransaction | null {
  const normalized = message.toLowerCase().trim();

  return parseWithVerb(normalized, incomeVerbs, 'income')
    || parseWithVerb(normalized, expenseVerbs, 'expense')
    || parseSimpleAmount(normalized);
}

export function parseExpenseMessage(message: string): ParsedTransaction | null {
  const parsed = parseTransactionMessage(message);
  return parsed?.type === 'expense' ? parsed : null;
}

function parseWithVerb(message: string, verbs: string[], type: TransactionType): ParsedTransaction | null {
  const verbPattern = verbs.join('|');
  const match = message.match(new RegExp(`^(?:${verbPattern})\\s+(?:r?\\$?\\s*)?(\\d+(?:[.,]\\d{1,2})?)\\s*(?:reais?)?\\s*(?:no|na|de|da|do|dos|das|em|com|para|pra)?\\s*(.*)$`, 'i'));

  if (!match) {
    return null;
  }

  return buildTransaction(match[1], match[2], type);
}

function parseSimpleAmount(message: string): ParsedTransaction | null {
  const match = message.match(/^(?:r?\$?\s*)?(\d+(?:[.,]\d{1,2})?)\s+(?:no|na|de|da|do|dos|das|em)?\s*(.+)$/i);

  if (!match) {
    return null;
  }

  return buildTransaction(match[1], match[2], 'expense');
}

function buildTransaction(amountText: string, descriptionText: string, type: TransactionType): ParsedTransaction | null {
  const amount = Number.parseFloat(amountText.replace(',', '.'));

  if (Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  const description = cleanDescription(descriptionText) || (type === 'income' ? 'Recebimento' : 'Gasto');
  const category = type === 'income' ? Category.OUTROS : detectCategory(description);

  return { amount, description, category, type };
}

function cleanDescription(text: string): string {
  return text
    .replace(/^(no|na|de|da|do|dos|das|em|com|para|pra)\s+/i, '')
    .trim();
}

function detectCategory(text: string): Category {
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return category as Category;
      }
    }
  }

  return Category.OUTROS;
}

export function getAllCategories(): string {
  return Object.values(Category).join('\n');
}
