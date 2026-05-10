import { Category } from './types';
import { ParsedTransaction } from './parser';

interface AiParseResponse {
  tipo?: string | null;
  valor?: number | string | null;
  descricao?: string | null;
  data?: string | null;
  categoria?: string | null;
  confianca?: number | null;
}

const nvidiaApiKey = process.env.NVIDIA_API_KEY;
const nvidiaModel = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';

export async function parseTransactionWithAi(message: string): Promise<ParsedTransaction | null> {
  if (!nvidiaApiKey) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${nvidiaApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: nvidiaModel,
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: [
            'Voce extrai lancamentos financeiros de mensagens em portugues do Brasil.',
            'Responda somente JSON valido, sem markdown.',
            'Campos obrigatorios: tipo, valor, descricao, data, categoria, confianca.',
            'tipo deve ser "expense", "income" ou null.',
            'valor deve ser numero decimal.',
            `data deve ser ISO YYYY-MM-DD. Hoje e ${today}.`,
            `categoria deve ser uma destas: ${Object.values(Category).join(', ')}.`,
            'Use income para dinheiro recebido, salario, pix recebido, pagamento recebido, caiu, entrou.',
            'Use expense para dinheiro gasto, pago, compra, pix enviado, cartao, debito.',
            'descricao deve remover valor, data e conectivos, mantendo a origem ou motivo.',
            'Se nao for lancamento financeiro, retorne tipo null e confianca 0.'
          ].join(' ')
        },
        {
          role: 'user',
          content: message
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`NVIDIA API error ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json() as any;
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== 'string') {
    return null;
  }

  const parsed = parseJson(content);
  if (!parsed) {
    return null;
  }

  return normalizeAiResponse(parsed);
}

function parseJson(content: string): AiParseResponse | null {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed) as AiParseResponse;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]) as AiParseResponse;
    } catch {
      return null;
    }
  }
}

function normalizeAiResponse(response: AiParseResponse): ParsedTransaction | null {
  const type = response.tipo === 'income' || response.tipo === 'recebimento'
    ? 'income'
    : response.tipo === 'expense' || response.tipo === 'gasto'
      ? 'expense'
      : null;

  if (!type) {
    return null;
  }

  const amount = typeof response.valor === 'number'
    ? response.valor
    : Number.parseFloat(String(response.valor ?? '').replace(',', '.'));

  if (Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  const date = response.data ? new Date(`${response.data}T12:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const confidence = typeof response.confianca === 'number' ? response.confianca : 1;
  if (confidence < 0.55) {
    return null;
  }

  return {
    amount,
    description: cleanText(response.descricao) || (type === 'income' ? 'Recebimento' : 'Gasto'),
    category: type === 'income' ? Category.OUTROS : normalizeCategory(response.categoria),
    type,
    date
  };
}

function normalizeCategory(category?: string | null): Category {
  const normalized = cleanText(category).toLowerCase();

  for (const value of Object.values(Category)) {
    if (value.toLowerCase() === normalized) {
      return value;
    }
  }

  return Category.OUTROS;
}

function cleanText(value?: string | null): string {
  return String(value || '').trim();
}
