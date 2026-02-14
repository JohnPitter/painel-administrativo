const {
  express,
  firestore,
  authenticateRequest,
  getUserProfile,
  isSubscriptionActive,
  sanitizeString,
} = require('../shared/base');
const fetch = require('node-fetch');

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
const GEMINI_FALLBACK_KEY = 'AIzaSyDUqLoCXjoPUdqYYQqEVRvxfKp7UfKALDI';

const COLLECTIONS = ['expenses', 'incomes', 'investments'];

const MONTH_KEY_BY_NAME = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
  jan: '01',
  fev: '02',
  mar: '03',
  abr: '04',
  jun: '06',
  jul: '07',
  ago: '08',
  set: '09',
  out: '10',
  nov: '11',
  dez: '12',
};

const getCollectionRef = (uid, collection) =>
  firestore.collection('users').doc(uid).collection(collection);

const sumAmounts = items =>
  items.reduce((total, item) => total + (Number(item.amount) || 0), 0);

const countByField = (items, field) => {
  const counter = new Map();
  items.forEach(item => {
    const key = sanitizeString(item[field]) || 'Outros';
    counter.set(key, (counter.get(key) || 0) + (Number(item.amount) || 0));
  });
  return counter;
};

const pickTop = counter => {
  let topKey = null;
  let topValue = -Infinity;
  counter.forEach((value, key) => {
    if (value > topValue) {
      topValue = value;
      topKey = key;
    }
  });
  if (!topKey || topValue <= 0) {
    return null;
  }
  return { label: topKey, amount: topValue };
};

const fetchFinanceSnapshot = async uid => {
  const result = {};
  await Promise.all(
    COLLECTIONS.map(async collection => {
      const snapshot = await getCollectionRef(uid, collection)
        .orderBy('date', 'desc')
        .limit(80)
        .get();
      result[collection] = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() ?? {}) }));
    })
  );
  return result;
};

const buildMonthlyTotals = items => {
  const map = new Map();
  items.forEach(item => {
    const monthKey = sanitizeString(item.date)?.slice(0, 7) || 'desconhecido';
    const amount = Number(item.amount) || 0;
    map.set(monthKey, (map.get(monthKey) || 0) + amount);
  });
  const sorted = Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12);
  return sorted.map(([month, value]) => ({ month, value }));
};

const limitRecords = (records, max = 40) =>
  records.slice(0, max).map(record => ({
    date: record.date,
    category: record.category || record.source || record.asset || 'N/A',
    amount: Number(record.amount) || 0,
    description: record.description || record.notes || '',
    paymentMethod: record.paymentMethod || null,
    type: record.type || null,
  }));

const buildFinancialSummary = ({ expenses, incomes, investments }) => {
  const expenseTotal = sumAmounts(expenses);
  const incomeTotal = sumAmounts(incomes);
  const netBalance = incomeTotal - expenseTotal;
  const topExpense = pickTop(countByField(expenses, 'category'));
  const topIncome = pickTop(countByField(incomes, 'category'));
  const latestInvestment = investments[0] || null;

  return {
    totalExpenses: expenseTotal,
    totalIncomes: incomeTotal,
    netBalance,
    topExpenseCategory: topExpense,
    topIncomeCategory: topIncome,
    latestInvestment,
    expenseCount: expenses.length,
    incomeCount: incomes.length,
    investmentCount: investments.length,
    expenseMonthlyTotals: buildMonthlyTotals(expenses),
    incomeMonthlyTotals: buildMonthlyTotals(incomes),
    expenseRecords: limitRecords(expenses),
    incomeRecords: limitRecords(incomes),
    investmentRecords: limitRecords(investments, 20),
  };
};

const normalizeText = text =>
  (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

const detectMonthKey = message => {
  const now = new Date();
  const normalized = normalizeText(message);
  if (normalized.includes('este mes')) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  if (normalized.includes('mes passado')) {
    const temp = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}`;
  }

  for (const [name, monthValue] of Object.entries(MONTH_KEY_BY_NAME)) {
    if (normalized.includes(name)) {
      const yearMatch = normalized.match(/20\d{2}/);
      const year = yearMatch ? yearMatch[0] : String(now.getFullYear());
      return `${year}-${monthValue}`;
    }
  }
  return null;
};

const detectCategory = (message, records) => {
  const normalized = normalizeText(message);
  const categories = Array.from(
    new Set(records.map(record => normalizeText(record.category || record.source || '')))
  ).filter(Boolean);

  return categories.find(category => normalized.includes(category)) || null;
};

const formatCurrency = value => `R$ ${value.toFixed(2)}`;

const buildDirectAnswer = (message, financeData, summary) => {
  const normalized = normalizeText(message);
  const isExpenseQuestion = /quanto.*(gastei|gastos|despesa)/.test(normalized);
  const isIncomeQuestion = /quanto.*(recebi|ganhei|entrou|receita)/.test(normalized);
  const wantsBalance = normalized.includes('saldo');

  let recordsKey;
  if (isExpenseQuestion) {
    recordsKey = 'expenses';
  } else if (isIncomeQuestion) {
    recordsKey = 'incomes';
  } else if (wantsBalance && summary) {
    return {
      text: `Seu saldo consolidado está em ${formatCurrency(summary.netBalance)} (receitas de ${formatCurrency(
        summary.totalIncomes
      )} e gastos de ${formatCurrency(summary.totalExpenses)}).`,
      hasData: true,
      intent: 'balance',
    };
  }

  const records = financeData[recordsKey] || [];
  if (records.length === 0) {
    return {
      text: 'Não encontrei lançamentos suficientes para responder. Registre novos valores para que eu possa ajudar.',
      hasData: false,
      intent: recordsKey ?? 'unknown',
    };
  }

  const monthKey = detectMonthKey(message);
  const categoryMatch = detectCategory(message, records);

  const filtered = records.filter(record => {
    const recordMonth = record.date ? record.date.slice(0, 7) : null;
    const matchesMonth = monthKey ? recordMonth === monthKey : true;
    const matchesCategory = categoryMatch
      ? normalizeText(record.category || record.source || '') === categoryMatch
      : true;
    return matchesMonth && matchesCategory;
  });

  if (!filtered.length) {
    if (monthKey && categoryMatch) {
      return {
        text: `Não encontrei registros de ${categoryMatch} no período solicitado.`,
        hasData: false,
        intent: recordsKey,
      };
    }
    if (monthKey) {
      return { text: 'Não encontrei lançamentos no período informado.', hasData: false, intent: recordsKey };
    }
    if (categoryMatch) {
      return {
        text: `Não encontrei lançamentos da categoria ${categoryMatch}.`,
        hasData: false,
        intent: recordsKey,
      };
    }
    return null;
  }

  const total = filtered.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const monthLabel = monthKey ? monthKey.split('-').reverse().join('/') : 'todo o período disponível';
  const categoryLabel = categoryMatch ? ` na categoria ${categoryMatch}` : '';
  const responseText =
    recordsKey === 'expenses'
      ? `Você gastou ${formatCurrency(total)} em ${monthLabel}${categoryLabel}.`
      : `Você recebeu ${formatCurrency(total)} em ${monthLabel}${categoryLabel}.`;

  return {
    text: responseText,
    hasData: true,
    intent: recordsKey,
  };
};

const resolveGeminiKey = () => process.env.GEMINI_API_KEY || GEMINI_FALLBACK_KEY;

const callGeminiAdvisor = async (message, summary) => {
  const apiKey = resolveGeminiKey();
  if (!apiKey) {
    return null;
  }

  const formatRecords = (label, records) => {
    return records
      .map(
        record =>
          `${label}: Data ${record.date || 'N/A'}, Categoria ${record.category}, Valor R$ ${record.amount.toFixed(
            2
          )}${record.paymentMethod ? `, Forma ${record.paymentMethod}` : ''}${
            record.description ? `, Nota: ${record.description}` : ''
          }`
      )
      .join('\\n');
  };

  const prompt = `Você é o PAI Assistente, parceiro de finanças pessoais. Responda em português com tom de conversa, no máximo três parágrafos, sem listas. Só fale sobre finanças; se o usuário perguntar algo fora disso, retorne gentilmente o assunto para dinheiro, gastos ou objetivos financeiros. Use os dados fornecidos abaixo para responder perguntas específicas sobre meses, categorias ou valores.

Resumo:
- Receitas totais: R$ ${summary.totalIncomes.toFixed(2)}
- Gastos totais: R$ ${summary.totalExpenses.toFixed(2)}
- Saldo projetado: R$ ${summary.netBalance.toFixed(2)}
- Categoria de gasto líder: ${summary.topExpenseCategory?.label ?? 'N/A'} (R$ ${summary.topExpenseCategory?.amount?.toFixed(2) ?? '0,00'})
- Categoria de receita líder: ${summary.topIncomeCategory?.label ?? 'N/A'} (R$ ${summary.topIncomeCategory?.amount?.toFixed(2) ?? '0,00'})
- Último investimento registrado: ${summary.latestInvestment ? summary.latestInvestment.asset || 'sem descrição' : 'N/A'}

Totais mensais de gastos (últimos 12 meses):
${summary.expenseMonthlyTotals.map(item => `${item.month}: R$ ${item.value.toFixed(2)}`).join('\\n')}

Totais mensais de receitas (últimos 12 meses):
${summary.incomeMonthlyTotals.map(item => `${item.month}: R$ ${item.value.toFixed(2)}`).join('\\n')}

Registros recentes de gastos:
${formatRecords('Gasto', summary.expenseRecords)}

Registros recentes de receitas:
${formatRecords('Receita', summary.incomeRecords)}

Registros recentes de investimentos:
${formatRecords('Investimento', summary.investmentRecords)}

Mensagem do usuário: "${message}"`;

  try {
    console.info('[functions][assistant] gemini:request', {
      expenseRecords: summary.expenseRecords.length,
      incomeRecords: summary.incomeRecords.length,
      investmentRecords: summary.investmentRecords.length,
      messageLength: message.length,
    });
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    const rawBody = await response.text();
    if (!response.ok) {
      console.error('[functions][assistant] gemini error', {
        status: response.status,
        body: rawBody.slice(0, 600),
      });
      return null;
    }
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[functions][assistant] gemini parse error', parseError);
      return null;
    }
    const parts = payload?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(part => typeof part.text === 'string' && part.text.trim());
    if (!textPart) {
      console.warn('[functions][assistant] gemini empty response', {
        candidates: payload?.candidates?.length ?? 0,
        finishReason: payload?.candidates?.[0]?.finishReason,
        promptFeedback: payload?.promptFeedback,
      });
      return null;
    }
    return textPart.text.trim();
  } catch (error) {
    console.error('[functions][assistant] gemini request failed', error);
    return null;
  }
};

const generateAdvisorReply = (message, summary) => {
  const lower = message.toLowerCase();
  const parts = [];

  if (summary.totalIncomes === 0 && summary.totalExpenses === 0) {
    return 'Ainda não encontrei lançamentos no seu painel. Comece registrando receitas e gastos para que eu possa te orientar melhor.';
  }

  if (summary.netBalance >= 0) {
    parts.push(
      `Vejo que o saldo projetado está positivo em R$ ${summary.netBalance.toFixed(2)}. Ótimo sinal para responder à pergunta sobre “${message}”. Podemos preservar essa folga mantendo os gastos sob controle.`
    );
  } else {
    parts.push(
      `Atualmente você está com saldo negativo em R$ ${Math.abs(summary.netBalance).toFixed(
        2
      )}. Em relação a “${message}”, vale priorizar cortes e ajustes nas categorias mais pesadas.`
    );
  }

  if (summary.topExpenseCategory) {
    parts.push(
      `A categoria que mais pesa é ${summary.topExpenseCategory.label}, com R$ ${summary.topExpenseCategory.amount.toFixed(
        2
      )} registrados.`
    );
  }

  if (summary.topIncomeCategory) {
    parts.push(
      `Nas receitas, ${summary.topIncomeCategory.label} lidera com R$ ${summary.topIncomeCategory.amount.toFixed(
        2
      )}.`
    );
  }

  if (summary.latestInvestment) {
    parts.push(
      `O último investimento registrado foi ${summary.latestInvestment.asset || 'sem descrição'} no valor de R$ ${Number(
        summary.latestInvestment.amount || 0
      ).toFixed(2)}.`
    );
  }

  if (lower.includes('reduz') || lower.includes('gasto') || lower.includes('econom')) {
    parts.push('Considere revisar os gastos recorrentes e definir um limite para a categoria mais pesada.');
  }
  if (lower.includes('invest') || lower.includes('aplicar')) {
    parts.push('Reserve parte do saldo positivo para investimentos automáticos e acompanhe o retorno mensal.');
  }
  if (lower.includes('receita') || lower.includes('ganhar')) {
    parts.push('Analise as fontes de receita e tente replicar o que trouxe melhores resultados neste mês.');
  }

  if (parts.length === 0) {
    parts.push('Estou acompanhando seus números. Posso comentar sobre saldo, categorias e investimentos; pergunte sobre eles.');
  }

  return parts.join(' ');
};

module.exports = () => {
  const router = express.Router();

  router.use(async (req, res, next) => {
    try {
      const uid = await authenticateRequest(req);
      const profile = await getUserProfile(uid);
      if (!isSubscriptionActive(profile)) {
        res.status(403).json({ message: 'Recurso exclusivo para assinantes ativos.' });
        return;
      }
      req.auth = { uid };
      next();
    } catch (error) {
      if (error.code === 'UNAUTHENTICATED') {
        res.status(401).json({ message: 'Autenticação necessária.' });
        return;
      }
      console.error('[functions][assistant] auth middleware', error);
      res.status(500).json({ message: 'Erro ao validar acesso ao chatbot.' });
    }
  });

  router.post('/chat', async (req, res) => {
    try {
      const message = sanitizeString(req.body?.message);
      if (!message) {
        res.status(400).json({ message: 'Envie uma pergunta ou mensagem.' });
        return;
      }

      const { uid } = req.auth;
      const financeData = await fetchFinanceSnapshot(uid);
      const summary = buildFinancialSummary(financeData);
      const directAnswer = buildDirectAnswer(message, financeData, summary);
      if (directAnswer) {
        console.info('[functions][assistant] direct-answer', {
          uid,
          intent: directAnswer.intent,
          hasData: directAnswer.hasData,
        });
        res.json({ reply: directAnswer.text, summary });
        return;
      }
      const aiReply = await callGeminiAdvisor(message, summary);
      const reply = aiReply || generateAdvisorReply(message, summary);

      res.json({ reply, summary });
    } catch (error) {
      console.error('[functions][assistant] chat', error);
      res.status(500).json({ message: 'Não foi possível consultar o assistente agora.' });
    }
  });

  return router;
};
