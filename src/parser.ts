import { Category } from './types';

interface ParsedExpense {
  amount: number;
  description: string;
  category: Category;
}

const categoryKeywords: Record<Category, string[]> = {
  [Category.ALIMENTACAO]: ['almoço', 'jantar', 'cafe', 'café', 'lanche', 'comida', 'restaurante', 'pizza', 'lanche', 'hamburguer', 'sorvete', 'açai', 'açaí', 'padaria', 'bar', 'bebida', 'cerveja', 'refrigerante', 'suco'],
  [Category.TRANSPORTE]: ['uber', '99', 'gasolina', 'combustivel', 'ônibus', 'metro', 'trem', 'taxi', 'carro', 'estacionamento', 'pedagio', 'pedágio', 'combustível'],
  [Category.LAZER]: ['cinema', 'jogo', 'game', 'netflix', 'spotify', 'youtube', 'serie', 'série', 'filme', 'show', 'teatro', 'futebol', 'bar', 'balada', 'festa', 'pub', 'barbearia', 'barbeiro'],
  [Category.SAUDE]: ['medico', 'médico', 'farmacia', 'farmácia', 'remedio', 'remédio', 'consulta', 'exame', 'dentista', 'terapeuta', 'psicologo', 'psicólogo', 'academia', 'ginastica', 'ginástica', 'yoga'],
  [Category.EDUCACAO]: ['curso', 'livro', 'faculdade', 'universidade', 'escola', 'material', ' apostila', 'livraria', 'desk', 'monitor', 'headset', 'curso online', 'udemy', 'coursera'],
  [Category.MORADIA]: ['aluguel', 'luz', 'agua', 'água', 'gas', 'internet', 'condominio', 'condomínio', 'iptu', 'seguro', 'manutenção', 'reforma', 'moveis', 'móveis', 'eletro', 'eletrônico'],
  [Category.COMPRAS]: ['mercado', 'supermercado', 'roupa', 'sapato', 'celular', 'phone', 'notebook', 'computador', 'perfume', 'cosmético', 'presente', 'decoração', 'decoration'],
  [Category.SERVICOS]: ['assinatura', 'app', 'aplicativo', 'serviço', 'hosting', 'nuvem', 'cloud', 'software', 'licença'],
  [Category.OUTROS]: []
};

export function parseExpenseMessage(message: string): ParsedExpense | null {
  const lowerMessage = message.toLowerCase().trim();

  const gastoMatch = lowerMessage.match(/gastei\s+(?:r?\$?\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais?)?\s*(?:no|na|de|em|especial|especialmente)?\s*(.*)/i);

  if (!gastoMatch) {
    return null;
  }

  let amountStr = gastoMatch[1].replace(',', '.');
  let amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    return null;
  }

  let remainingText = gastoMatch[2] || '';

  const explicitCategoryMatch = remainingText.match(/no\s+(.+?)\s+(.+)/i);
  let category: Category;
  let description: string;

  if (explicitCategoryMatch) {
    const categoryName = explicitCategoryMatch[1].toLowerCase();
    description = explicitCategoryMatch[2].trim();

    category = findCategoryByName(categoryName);
  } else {
    description = remainingText.trim();
    category = detectCategory(description);
  }

  if (!description) {
    description = category.replace(/[^\w\s]/g, '').trim();
  }

  return { amount, description, category };
}

function findCategoryByName(name: string): Category {
  const categoryMap: Record<string, Category> = {
    'restaurante': Category.ALIMENTACAO,
    'lanche': Category.ALIMENTACAO,
    'comida': Category.ALIMENTACAO,
    'cafe': Category.ALIMENTACAO,
    'café': Category.ALIMENTACAO,
    'bar': Category.ALIMENTACAO,
    'almoço': Category.ALIMENTACAO,
    'jantar': Category.ALIMENTACAO,
    'uber': Category.TRANSPORTE,
    'carro': Category.TRANSPORTE,
    'gasolina': Category.TRANSPORTE,
    'onibus': Category.TRANSPORTE,
    'metro': Category.TRANSPORTE,
    'cinema': Category.LAZER,
    'jogo': Category.LAZER,
    'netflix': Category.LAZER,
    'spotify': Category.LAZER,
    'medico': Category.SAUDE,
    'médico': Category.SAUDE,
    'farmacia': Category.SAUDE,
    'farmácia': Category.SAUDE,
    'academia': Category.SAUDE,
    'curso': Category.EDUCACAO,
    'livro': Category.EDUCACAO,
    'faculdade': Category.EDUCACAO,
    'aluguel': Category.MORADIA,
    'luz': Category.MORADIA,
    'agua': Category.MORADIA,
    'água': Category.MORADIA,
    'internet': Category.MORADIA,
    'mercado': Category.COMPRAS,
    'supermercado': Category.COMPRAS,
    'roupa': Category.COMPRAS,
    'celular': Category.COMPRAS,
    'assinatura': Category.SERVICOS,
    'app': Category.SERVICOS,
  };

  for (const [key, cat] of Object.entries(categoryMap)) {
    if (name.includes(key)) {
      return cat;
    }
  }

  return Category.OUTROS;
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