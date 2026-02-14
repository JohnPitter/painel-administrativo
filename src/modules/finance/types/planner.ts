export type PlannerAllocations = Record<string, number>;

export interface PlannerGoal {
  id: string;
  label: string;
  amount: number;
  monthlyReserve: number;
}

export interface PlannerDocument {
  allocations: PlannerAllocations;
  goals: PlannerGoal[];
  updatedAt?: string;
}

export interface PlannerSavePayload extends PlannerDocument {
  year: number;
  month: number;
}
