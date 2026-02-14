import { FormEvent, useMemo, useState } from 'react';

import { DashboardLayout } from '@core/layout/DashboardLayout';
import { useAuth } from '@modules/auth/services/AuthContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import { sendAssistantMessage } from '../services/advisorService';

import styles from './AssistantPage.module.css';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  summary?: {
    totalExpenses: number;
    totalIncomes: number;
    netBalance: number;
    topExpenseCategory?: string | null;
    topIncomeCategory?: string | null;
  };
}

const AssistantPage = () => {
  const { user, isGuest } = useAuth();
  const isLocalMode = useLocalMode();
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome',
    sender: 'assistant',
    text: 'Olá! Eu sou o PAI Assistente. Pergunte sobre seu saldo, categorias ou investimentos que eu resumo para você.',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cannotUseAssistant = isGuest || isLocalMode;

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || !user) {
      return;
    }

    const messageText = input.trim();
    setInput('');
    setError(null);

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), sender: 'user', text: messageText },
    ]);

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await sendAssistantMessage(token, messageText);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: response.reply,
          summary: {
            totalExpenses: response.summary.totalExpenses,
            totalIncomes: response.summary.totalIncomes,
            netBalance: response.summary.netBalance,
            topExpenseCategory: response.summary.topExpenseCategory?.label ?? null,
            topIncomeCategory: response.summary.topIncomeCategory?.label ?? null,
          },
        },
      ]);
    } catch (assistantError) {
      console.error(assistantError);
      setError('Não consegui analisar seus dados agora. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  const subscriptionWarning = useMemo(() => {
    if (!cannotUseAssistant) {
      return null;
    }
    return (
      <div className={styles.blockedState}>
        <h2>Recurso exclusivo para assinantes</h2>
        <p>
          Ative o PAI cloud para conversar com o assistente e receber análises sobre suas finanças em tempo real.
        </p>
        <button type="button" onClick={() => window.location.assign('/assinatura')}>
          Conhecer plano cloud
        </button>
      </div>
    );
  }, [cannotUseAssistant]);

  return (
    <DashboardLayout
      title="Assistente Financeiro"
      subtitle="Converse com o PAI sobre seus números e receba insights instantâneos."
    >
      {subscriptionWarning ?? (
        <div className={styles.container}>
          <div className={styles.chatWindow}>
            {messages.map(message => (
              <div
                key={message.id}
                className={message.sender === 'user' ? styles.userBubble : styles.assistantBubble}
              >
                <p>{message.text}</p>
                {message.summary && (
                  <div className={styles.summaryBox}>
                    <span>
                      Receita: <strong>R$ {message.summary.totalIncomes.toFixed(2)}</strong>
                    </span>
                    <span>
                      Gastos: <strong>R$ {message.summary.totalExpenses.toFixed(2)}</strong>
                    </span>
                    <span>
                      Saldo: <strong>R$ {message.summary.netBalance.toFixed(2)}</strong>
                    </span>
                    {message.summary.topExpenseCategory && (
                      <span>Maior gasto: {message.summary.topExpenseCategory}</span>
                    )}
                    {message.summary.topIncomeCategory && (
                      <span>Maior receita: {message.summary.topIncomeCategory}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form className={styles.inputBar} onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Pergunte sobre saldo, categorias, investimentos..."
              value={input}
              onChange={event => setInput(event.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? 'Analisando...' : 'Enviar'}
            </button>
          </form>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </DashboardLayout>
  );
};

export { AssistantPage };
