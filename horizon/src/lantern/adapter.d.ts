import type { Floor, LanternModel, SourceKey, WindowState } from './model';

export const WINDOWS: number;
export const FULL: number;
export const MEDIAN_WINDOW: number;
export function essentialOf(plan: any): number;
export function windowState(paid: number, spend: number, essential: number): WindowState;
export function sourcesOf(row: any, delivered: number): { key: SourceKey; amount: number }[];
export function lanternModel(input: { plan: any; rows: any[]; mc: any; stress: any | null; essential?: number | null }): LanternModel;
export function countWindows(w: WindowState[]): { full: number; floor: number; short: number };
export function modelOk(m: LanternModel): boolean;
export type { Floor };
