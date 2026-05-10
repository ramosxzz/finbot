import { Category } from './types';

interface ParsedExpense {
  amount: number;
  description: string;
  category: Category;
}

const categoryKeywords: Record<Category, string[]> = {
  [Category.ALIMENTACAO]: ['almoco', 'almoço', 'jantar', 'cafe', 'café', 'lanche', 'comida', 'restaurante', 'pizza', 'hamburguer', 'sorvete', 'acai', 'açai', 'açaí', 'padaria', 'bar', 'bebida', 'cerveja', 'refrigerante', 'suco'],
  [Category.TRANSPORTE]: ['uber', '99', 'gasolina', 'combustivel', 'combustível', 'onibus', 'ônibus', 'metro', 'metrô', 'trem', 'taxi', 'táxi', 'carro', 'estacionamento', 'pedagio', 'pedágio'],
  [Category.LAZER]: ['cinema', 'jogo', 'game', 'netflix', 'spotify', 'youtube', 'serie', 'série', 'filme', 'show', 'teatro', 'futebol', 'balada', 'festa', 'pub', 'barbearia', 'barbeiro'],
  [Category.SAUDE]: ['medico', 'médico', 'farmacia', 'farmácia', 'remedio', 'remédio', 'consulta', 'exame', 'dentista', 'terapeuta', 'psicologo', 'psicólogo', 'academia', 'ginastica', 'ginástica', 'yoga'],
  [Category.EDUCACAO]: ['curso', 'livro', 'faculdade', 'universidade', 'escola', 'material', 'apostila', 'livraria', 'desk', 'monitor', 'headset', 'curso online', 'udemy', 'coursera'],
  [Category.MORADIA]: ['aluguel', 'luz', 'agua', 'água', 'gas', 'gás', 'internet', 'condominio', 'condomínio', 'iptu', 'seguro', 'manutencao', 'manutenção', 'reforma', 'moveis', 'móveis', 'eletro', 'eletronico', 'eletrônico'],
  [Category.COMPRAS]: ['mercado', 'supermercado', 'roupa', 'sapato', 'celular', 'phone', 'notebook', 'computador', 'perfume', 'cosmetico', 'cosmético', 'presente', 'decoracao', 'decoração'],
  [Category.SERVICOS]: ['assinatura', 'app', 'aplicativo', 'servico', 'serviço', 'hosting', 'nuvem', 'cloud', 'software', 'licenca', 'licença'],
  [Category.OUTROS]: []
};

export function parseExpenseMessage(message: string): ParsedExpense | null {
  const lowerMessage = message.toLowerCase().trim();

  const gastoMatch = lowerMessage.match(/gastei\s+(?:r?\$?\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais?)?\s*(?:no|na|de|em)?\s*(.*)/i);

  if (!gastoMatch) {
    return null;
  }

  const amount = Number.parseFloat(gastoMatch[1].replace(',', '.'));

  if (Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  const description = (gastoMatch[2] || '').trim() || 'Gasto';
  const category = detectCategory(description);

  return { amount, description, category };
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
