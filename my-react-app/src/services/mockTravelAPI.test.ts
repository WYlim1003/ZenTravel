import { describe, it, expect } from 'vitest';
import { toIATA, searchFlights, checkCompensation, executeTool, type ToolCallPlan } from './mockTravelAPI';

/**
 * Unit test suite — Mock travel API (ReAct “Act” layer)
 *
 * **Scope:** Deterministic `mockTravelAPI` — IATA normalisation, `searchFlights` pricing
 * for known routes, `checkCompensation` shape, and `executeTool` dispatch (no GLM, no network).
 *
 * **Execution:** Vitest (`npm test` / `npm run test:watch`). Run locally while developing; add the
 * same command to CI (e.g. GitHub Actions) on push/PR.
 *
 * **Isolation:** Exercises only in-process TypeScript. No Firebase, no `fetch` to ILMU, no
 * database — the mock is fully offline.
 *
 * **Pass conditions:** Happy paths return expected structures; negative/edge cases return
 * predictable types (e.g. unknown city → 3-letter fallback; unknown tool → compensation fallback);
 * KUL–SIN prices match the formula in `searchFlights`.
 */

describe('toIATA', () => {
  it('maps known city names to IATA (happy case)', () => {
    expect(toIATA('Kuala Lumpur')).toBe('KUL');
    expect(toIATA('singapore')).toBe('SIN');
  });

  it('uses first three letters of unknown input (edge case)', () => {
    expect(toIATA('FooBarBaz')).toBe('FOO');
  });
});

describe('searchFlights', () => {
  it('returns deterministic MYR prices for KUL–SIN route', async () => {
    const offers = await searchFlights('KUL', 'SIN', 3);
    expect(offers).toHaveLength(3);
    // basePriceMYR 180 for KUL-SIN, priceMYR = round(180 * (1 + i * 0.15))
    expect(offers[0]!.priceMYR).toBe(180);
    expect(offers[1]!.priceMYR).toBe(207);
    expect(offers[2]!.priceMYR).toBe(234);
    expect(offers[0]!.recommended).toBe(true);
    expect(offers[0]!.from).toBe('KUL');
    expect(offers[0]!.to).toBe('SIN');
  });

  it('respects count cap (edge case)', async () => {
    const one = await searchFlights('KUL', 'PEN', 1);
    expect(one).toHaveLength(1);
  });
});

describe('checkCompensation', () => {
  it('returns a CompensationResult with numeric amounts (happy case)', async () => {
    const r = await checkCompensation('delay');
    expect(r.eligible).toBe(true);
    expect(r.amountMYR).toBe(1300);
    expect(r.amountEUR).toBe(250);
    expect(r.regulation).toBe('Consumer Protection Code');
    expect(r.claimDeadline).toBe('6 years');
  });
});

describe('executeTool', () => {
  it('dispatches search_flights with param aliases (happy case)', async () => {
    const plan: ToolCallPlan = {
      tool: 'search_flights',
      params: { origin: 'KUL', destination: 'SIN', count: 2 },
    };
    const tr = await executeTool(plan);
    expect(tr.tool).toBe('search_flights');
    if (tr.tool !== 'search_flights') return;
    expect(tr.result).toHaveLength(2);
    expect(tr.result[0]!.priceMYR).toBe(180);
  });

  it('dispatches check_compensation (negative: unknown type still returns result)', async () => {
    const tr = await executeTool({
      tool: 'check_compensation',
      params: { type: 'not_a_real_type' },
    });
    expect(tr.tool).toBe('check_compensation');
    if (tr.tool !== 'check_compensation') return;
    expect(tr.result.amountMYR).toBe(1300);
  });

  it('unknown tool name falls back to check_compensation (edge case)', async () => {
    const tr = await executeTool({ tool: 'nonexistent_tool', params: {} });
    expect(tr.tool).toBe('check_compensation');
    if (tr.tool !== 'check_compensation') return;
    expect(tr.result).toMatchObject({ eligible: true, amountMYR: 1300 });
  });
});
