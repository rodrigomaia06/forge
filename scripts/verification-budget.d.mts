export interface VerificationBudget {
  baseline: number[];
  commonPool: number[];
  selected: number[];
  workers: number;
}
export function parseCpuList(value: string): number[];
export function selectVerificationPool(
  available: number[],
  baseline?: number[],
): VerificationBudget;
export function assertWorkerBudget(argv: string[], limit: number, hostCpuCount?: number): void;
export function enforceVerificationBudget(argv?: string[]): VerificationBudget;
