interface BaseRecord {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  recurrenceId?: string | null;
  recurrenceIndex?: number | null;
  recurrenceTotal?: number | null;
  excludeFromTotals?: boolean;
}

export interface Expense extends BaseRecord {
  paymentMethod: 'dinheiro' | 'debito' | 'credito' | 'pix' | 'boleto' | 'outro';
}

export interface Income extends BaseRecord {
  source: string;
}

export interface Investment extends BaseRecord {
  type: 'renda_fixa' | 'renda_variavel' | 'fundo' | 'poupanca' | 'outro';
  institution: string;
  expectedReturn?: number;
}

export type CategoryGroup = 'expenses' | 'incomes' | 'investments';

export type CategoriesState = Record<CategoryGroup, string[]>;

export interface FinanceState {
  expenses: Expense[];
  incomes: Income[];
  investments: Investment[];
  categories: CategoriesState;
}

export interface FinanceActionOptions {
  silent?: boolean;
}

export interface FinanceContextValue extends FinanceState {
  loading: boolean;
  addExpense: (expense: Omit<Expense, 'id'>, options?: FinanceActionOptions) => Promise<void>;
  addIncome: (income: Omit<Income, 'id'>, options?: FinanceActionOptions) => Promise<void>;
  addInvestment: (investment: Omit<Investment, 'id'>, options?: FinanceActionOptions) => Promise<void>;
  updateExpense: (id: string, expense: Omit<Expense, 'id'>) => Promise<void>;
  updateIncome: (id: string, income: Omit<Income, 'id'>) => Promise<void>;
  updateInvestment: (id: string, investment: Omit<Investment, 'id'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  deleteInvestment: (id: string) => Promise<void>;
  addCategory: (group: CategoryGroup, category: string) => Promise<void>;
  removeCategory: (group: CategoryGroup, category: string) => Promise<void>;
  getBalanceSnapshot: () => {
    totalExpenses: number;
    totalIncomes: number;
    totalInvestments: number;
    netBalance: number;
  };
}
