import { FormEvent, useState } from 'react';

import { useAuth } from '@modules/auth/services/AuthContext';
import { useLocalMode } from '@modules/auth/hooks/useLocalMode';
import { sendAssistantMessage } from '@modules/assistant/services/advisorService';

import styles from './FinanceAssistantWidget.module.css';

type ChatMessage = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  summary?: {
    totalExpenses: number;
    totalIncomes: number;
    netBalance: number;
    topExpenseCategory: string | null;
    topIncomeCategory: string | null;
  };
};

const FinanceAssistantWidget = () => {
  const { user, isGuest } = useAuth();
  const isLocalMode = useLocalMode();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Olá! Sou o PAI Assistente. Pergunte sobre saldo, categorias ou investimentos e eu resumo para você.',
    },
  ]);

  const canUse = !isGuest && !isLocalMode;

  const toggleWidget = () => {
    if (!canUse) {
      setIsOpen(true);
      return;
    }
    setIsOpen(prev => !prev);
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || !user) {
      return;
    }

    const message = input.trim();
    setInput('');
    setError(null);

    const messageId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-user`;
    setMessages(prev => [
      ...prev,
      { id: messageId, sender: 'user', text: message },
    ]);

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await sendAssistantMessage(token, message);
      const assistantId =
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-assistant`;
      setMessages(prev => [
        ...prev,
        {
          id: assistantId,
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

  return (
    <>
      <button type="button" className={styles.fab} onClick={toggleWidget}>
        💬 PAI
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <strong>Assistente Financeiro</strong>
              <span>Resumo automático dos seus números</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Fechar">
              ×
            </button>
          </header>

          {!canUse ? (
            <div className={styles.blockedState}>
              <p>Este recurso é exclusivo para assinantes cloud.</p>
              <button type="button" onClick={() => (window.location.href = '/assinatura')}>
                Conhecer plano cloud
              </button>
            </div>
          ) : (
            <>
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
                          <span>Gasto líder: {message.summary.topExpenseCategory}</span>
                        )}
                        {message.summary.topIncomeCategory && (
                          <span>Receita líder: {message.summary.topIncomeCategory}</span>
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
            </>
          )}
        </div>
      )}
    </>
  );
};

export { FinanceAssistantWidget };
