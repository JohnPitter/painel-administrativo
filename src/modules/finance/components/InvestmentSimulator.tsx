import { useMemo, useState } from 'react';

import styles from './InvestmentSimulator.module.css';

interface ScenarioConfig {
  id: string;
  label: string;
  defaultRate: number;
  description: string;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'poupanca',
    label: 'Poupança',
    defaultRate: 0.065,
    description: 'Rentabilidade aproximada de 6,5% ao ano, baixo risco.',
  },
  {
    id: 'renda_fixa',
    label: 'Renda fixa indexada ao CDI',
    defaultRate: 0.11,
    description: 'Títulos prefixados ou indexados ao CDI, risco moderado.',
  },
  {
    id: 'fundo_imobiliario',
    label: 'Fundos imobiliários',
    defaultRate: 0.12,
    description: 'Exposição a FIIs, renda recorrente com volatilidade moderada.',
  },
  {
    id: 'etf_exterior',
    label: 'ETF internacional (S&P 500)',
    defaultRate: 0.09,
    description: 'Replica indices globais; considerar risco cambial.',
  },
  {
    id: 'bitcoin',
    label: 'Bitcoin',
    defaultRate: 0.25,
    description: 'Ativo volátil com alto potencial de retorno e risco elevado.',
  },
  {
    id: 'renda_variavel',
    label: 'Carteira diversificada de ações',
    defaultRate: 0.15,
    description: 'Estratégia agressiva com potencial de maior retorno e risco elevado.',
  },
];

interface SimulationResultCore {
  futureValue: number;
  totalInvested: number;
  totalProfit: number;
}

const calculateFutureValueCore = (
  initialAmount: number,
  monthlyContribution: number,
  years: number,
  annualRate: number
): SimulationResultCore => {
  const months = years * 12;
  const monthlyRate = annualRate / 12;

  let accumulated = initialAmount * Math.pow(1 + monthlyRate, months);

  if (monthlyRate > 0) {
    accumulated += monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  } else {
    accumulated += monthlyContribution * months;
  }

  const totalInvested = initialAmount + monthlyContribution * months;
  const totalProfit = accumulated - totalInvested;

  return { futureValue: accumulated, totalInvested, totalProfit };
};

interface SimulationResult extends SimulationResultCore {
  scenario: ScenarioConfig;
}

const InvestmentSimulator = () => {
  const [initialAmount, setInitialAmount] = useState(5000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [years, setYears] = useState(5);
  const [customRates, setCustomRates] = useState<Record<string, number>>(() =>
    Object.fromEntries(SCENARIOS.map(scenario => [scenario.id, scenario.defaultRate]))
  );

  const updateRate = (id: string, value: number) => {
    setCustomRates(prev => ({ ...prev, [id]: value }));
  };

  const results = useMemo(() => {
    return SCENARIOS.map(config => {
      const annualRate = customRates[config.id] ?? config.defaultRate;
      const result = calculateFutureValueCore(initialAmount, monthlyContribution, years, annualRate);
      return {
        ...result,
        scenario: { ...config, defaultRate: annualRate },
      };
    }).sort((a, b) => b.futureValue - a.futureValue);
  }, [initialAmount, monthlyContribution, years, customRates]);

  const bestScenario = results[0];

  return (
    <section className={styles.wrapper}>
      <header>
        <span className={styles.badge}>Simulador</span>
        <h2>Compare investimentos</h2>
        <p>Descubra o potencial de crescimento com diferentes perfis de risco.</p>
      </header>

      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="sim-initial">Valor inicial (R$)</label>
          <input
            id="sim-initial"
            type="number"
            min="0"
            step="100"
            value={initialAmount}
            onChange={event => setInitialAmount(Number(event.target.value))}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="sim-monthly">Aporte mensal (R$)</label>
          <input
            id="sim-monthly"
            type="number"
            min="0"
            step="50"
            value={monthlyContribution}
            onChange={event => setMonthlyContribution(Number(event.target.value))}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="sim-years">Horizonte (anos)</label>
          <input
            id="sim-years"
            type="number"
            min="1"
            step="1"
            value={years}
            onChange={event => setYears(Number(event.target.value))}
          />
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cenário</th>
              <th>Rentabilidade a.a.</th>
              <th>Total investido</th>
              <th>Valor projetado</th>
              <th>Lucro estimado</th>
            </tr>
          </thead>
          <tbody>
            {results.map(result => {
              const isBest = bestScenario?.scenario.id === result.scenario.id;
              const rate = customRates[result.scenario.id] ?? result.scenario.defaultRate;
              return (
                <tr key={result.scenario.id} className={isBest ? styles.highlight : undefined}>
                  <td>
                    <strong>{result.scenario.label}</strong>
                    <small>{result.scenario.description}</small>
                  </td>
                  <td>
                    <div className={styles.rateInput}>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={(rate * 100).toFixed(2)}
                        onChange={event =>
                          updateRate(result.scenario.id, Number(event.target.value) / 100)
                        }
                      />
                      <span>%</span>
                    </div>
                  </td>
                  <td>
                    R${' '}
                    {result.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    R$ {result.futureValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    R$ {result.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {bestScenario && (
        <footer className={styles.footer}>
          <strong>Melhor retorno estimado:</strong> {bestScenario.scenario.label} com saldo projetado de{' '}
          R$ {bestScenario.futureValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
          <div className={styles.tips}>
            <p>
              Dica: consulte taxas atualizadas em fontes como Banco Central (Selic/CDI), plataformas de
              corretoras e sites de indicadores (ex.: Trading Economics para índices internacionais e
              CoinMarketCap para cripto). Utilize o campo de rentabilidade para refletir o cenário mais
              realista.
            </p>
          </div>
        </footer>
      )}
    </section>
  );
};

export { InvestmentSimulator };
