import type { Floor, LanternModel, SourceKey, WindowState } from './model';

export const LEVELS: number;
export const WINDOWS: number;
export const FULL: number;
export function windowState(paid: number): WindowState;
export function sourcesOf(row: any, delivered: number): { key: SourceKey; amount: number }[];
export function lanternModel(input: { plan: any; rows: any[]; mc: any; stress: any | null }): LanternModel;
export function countWindows(w: WindowState[]): { full: number; short: number };
export function of100(w: WindowState[]): number;
export function modelOk(m: LanternModel): boolean;
export type { Floor };
