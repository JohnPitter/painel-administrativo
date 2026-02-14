import { useState } from 'react';

import { useFinance } from '../context/FinanceContext';
import styles from './FinanceSettings.module.css';

const CATEGORY_GROUPS = [
  { id: 'expenses', label: 'Categorias de gastos', description: 'Usadas em despesas gerais.' },
  { id: 'incomes', label: 'Categorias de receitas', description: 'Identifique fontes de entrada.' },
  {
    id: 'investments',
    label: 'Categorias de investimentos',
    description: 'Organize seus aportes por objetivo.',
  },
] as const;

type GroupId = (typeof CATEGORY_GROUPS)[number]['id'];

const FinanceSettings = () => {
  const { categories, addCategory, removeCategory } = useFinance();
  const [inputs, setInputs] = useState<Record<GroupId, string>>({
    expenses: '',
    incomes: '',
    investments: '',
  });

  const handleAdd = async (group: GroupId) => {
    const value = inputs[group].trim();
    if (!value) {
      return;
    }
    await addCategory(group, value);
    setInputs(prev => ({ ...prev, [group]: '' }));
  };

  const handleRemove = async (group: GroupId, category: string) => {
    await removeCategory(group, category);
  };

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <h2>Configurações das categorias</h2>
        <p>
          Personalize as categorias utilizadas em gastos, receitas e investimentos. Essas listas ficam
          disponíveis em todos os formulários do módulo de finanças pessoais.
        </p>
      </header>

      <div className={styles.grid}>
        {CATEGORY_GROUPS.map(group => (
          <article key={group.id} className={styles.card}>
            <header>
              <h3>{group.label}</h3>
              <p>{group.description}</p>
            </header>

            <div className={styles.formRow}>
              <input
                type="text"
                value={inputs[group.id]}
                placeholder="Nova categoria"
                onChange={event =>
                  setInputs(prev => ({
                    ...prev,
                    [group.id]: event.target.value,
                  }))
                }
              />
              <button type="button" onClick={() => handleAdd(group.id)}>
                Adicionar
              </button>
            </div>

            {categories[group.id].length === 0 ? (
              <div className={styles.emptyState}>Nenhuma categoria cadastrada.</div>
            ) : (
              <ul className={styles.list}>
                {categories[group.id].map(category => (
                  <li key={category}>
                    <span>{category}</span>
                    <button type="button" onClick={() => handleRemove(group.id, category)}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

export { FinanceSettings };
