/**
 * ZenTravel Brain Master — 5-Stage Workflow Engine
 *
 * Stage 1 · Input Agent      GLM extracts structured incident JSON; regex fallback if GLM fails
 * Stage 2 · Validation       Missing critical fields → clarifying questions
 * Stage 3 · ReAct: REASON    GLM plans which mock APIs to call; rule fallback if GLM fails
 * Stage 4 · ReAct: ACT       Executes mock travel APIs (flights, hotels, compensation)
 * Stage 5 · ReAct: OBSERVE   Structured fields from tool results + GLM narrative (2 sentences)
 * Stage 6 · Plan strategy    GLM writes recovery plan.strategy from incident + tool outcomes (fallback string if GLM fails)
 */

import { createGLMClientFromEnv } from '../services/glmClient';
import {
  runReActOrchestration,
  mapActionFailures,
  hotelAgent,
  flightAgent,
  type ReActResult,
} from './tools';
import type {
  ExtractedIncident,
  IncidentInput,
  RecoveryPlan,
  StructuredWorkflowOutput,
  WorkflowFailure,
} from './types';

// ─── Stage 1 Helpers ──────────────────────────────────────────────────────────

function inferDisruptionType(text: string): ExtractedIncident['disruptionType'] {
  const t = text.toLowerCase();
  // Lost luggage — check before "delay" so "delayed baggage" → lost_luggage
  if (/\b(luggage|baggage|bag|suitcase|pir|lost bag|missing bag|not located|delayed bag)\b/.test(t))
    return 'lost_luggage';
  if (/\b(cancel|cancelled|canceled|scrapped|no longer operating)\b/.test(t))
    return 'cancellation';
  if (/\b(delay|delayed|late|postpone|pushed back|depart.*later|new.*departure|estimated.*departure)\b/.test(t))
    return 'delay';
  return 'unknown';
}

function extractFlightNumber(text: string): string | undefined {
  // Match "MH792", "MH 792", "flight 2097", "flt 2097" etc.
  const standard = text.match(/\b([A-Z]{1,2}\s?-?\s?\d{2,4})\b/i)?.[1];
  if (standard) return standard.replace(/\s+/g, '').toUpperCase();

  // Bare numeric flight numbers ("Flight 2097", "Flt. 2097")
  const bare = text.match(/\b(?:flight|flt\.?)\s+(\d{3,4})\b/i)?.[1];
  if (bare) return bare;

  return undefined;
}

// Optional IATA code suffix: " (KUL)", "(FRA)", etc.
const IATA_OPT = /(?:\s*\([A-Z]{2,3}\))?/;
// A city/airport name: 2+ alpha words, up to 4 words
const CITY = /([A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){0,3})/;

function extractRoute(text: string): { origin?: string; destination?: string } {
  // "from Kuala Lumpur (KUL) to Frankfurt (FRA)" — handles optional IATA codes
  const full = new RegExp(
    `from\\s+${CITY.source}${IATA_OPT.source}\\s+to\\s+${CITY.source}${IATA_OPT.source}`,
    'i',
  ).exec(text);
  if (full) {
    const origin = full[1].trim();
    const dest = full[2].trim();
    const junk = /^(allow|a |for |the |due |lato|late)/i;
    if (!junk.test(dest)) return { origin, destination: dest };
  }

  // "to Frankfurt (FRA)" with optional IATA code
  const toCity = new RegExp(
    `\\bto\\s+${CITY.source}${IATA_OPT.source}`,
    'i',
  ).exec(text);
  if (toCity) {
    const dest = toCity[1].trim();
    const junk = /^(allow|a |for |the |due |lato|late|allow)/i;
    if (!junk.test(dest)) return { destination: dest };
  }

  // "fly to X" / "flying to X" / "flight to X" / "travel to X" / "going to X"
  const verbTo = /(?:fly(?:ing)?|flight|travel(?:ling)?|going|headed)\s+to\s+([A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){0,3})/i.exec(text);
  if (verbTo) return { destination: verbTo[1].trim() };

  return {};
}

// Extract bare city / airport names from clarification replies.
// Handles: "Frankfurt", "Frankfurt (FRA)", "FRA", "Kuala Lumpur"
function extractBareCityName(text: string): string | undefined {
  // Strip "User clarification:" prefix if present
  const clean = text.replace(/user clarification:\s*/gi, '').trim();

  // If the whole reply is just a city name ± IATA code (≤ 5 words, all alpha/parens/space)
  if (/^[A-Za-z\s()]{2,40}$/.test(clean) && clean.split(/\s+/).length <= 5) {
    // Extract just the alphabetic city name, dropping any IATA code in parens
    const city = clean.replace(/\([A-Z]{2,3}\)/g, '').trim();
    if (city.length >= 2) return city;
  }

  // IATA code alone: "FRA", "KUL"
  const iata = /^\s*([A-Z]{3})\s*$/.exec(clean);
  if (iata) return iata[1];

  return undefined;
}

function buildFallbackExtraction(input: IncidentInput): ExtractedIncident {
  const disruptionType = inferDisruptionType(input.rawInput);
  const flightNumber = extractFlightNumber(input.rawInput);
  const { origin, destination: routeDest } = extractRoute(input.rawInput);

  // Last-resort: if route extraction failed, try treating the last "User clarification:"
  // segment (or the whole input if short) as a bare city name answer
  const destination = routeDest ?? extractBareCityName(input.rawInput);

  const missing: string[] = [];
  if (!flightNumber) missing.push('flight number');
  if (!destination) missing.push('destination');

  return {
    summary: input.rawInput.slice(0, 200),
    disruptionType,
    flightNumber,
    origin,
    destination,
    confidence: disruptionType === 'unknown' ? 0.4 : 0.75,
    missingFields: missing,
    ambiguityNotes: disruptionType === 'unknown' ? ['Manual fallback used'] : [],
  };
}

// ─── Stage 1: GLM extraction ───────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are ZenTravel's incident extraction engine. Read the traveller message (may include OCR noise, emails, or "User clarification:" follow-ups) and output structured fields.

Return ONLY a JSON object with this exact shape (no markdown fences):
{
  "summary": "one-line factual summary",
  "disruptionType": "delay" | "cancellation" | "lost_luggage" | "unknown",
  "flightNumber": string or null,
  "origin": string or null,
  "destination": string or null,
  "originalDeparture": string or null,
  "confidence": number from 0 to 1,
  "missingFields": string[],
  "ambiguityNotes": string[]
}

Rules:
- Treat delayed baggage, PIR, missing bags as "lost_luggage".
- If the disruption type is unclear, use "unknown" and explain in ambiguityNotes.
- List critical gaps in missingFields using short phrases like "destination", "flight number".
- When the user only replies with a city name after a clarification prompt, treat it as destination (or origin) in context.`;

function normalizeDisruptionType(v: unknown): ExtractedIncident['disruptionType'] {
  const s = String(v ?? '').toLowerCase();
  if (s === 'delay' || s === 'cancellation' || s === 'lost_luggage' || s === 'unknown') return s;
  return 'unknown';
}

function ensureCriticalMissingFields(incident: ExtractedIncident): ExtractedIncident {
  const missing = new Set(incident.missingFields.map((s) => s.toLowerCase()));
  if (!incident.destination) missing.add('destination');
  if (!incident.flightNumber) missing.add('flight number');
  return {
    ...incident,
    missingFields: Array.from(missing),
    confidence:
      typeof incident.confidence === 'number' && !Number.isNaN(incident.confidence)
        ? Math.min(1, Math.max(0, incident.confidence))
        : 0.7,
    ambiguityNotes: Array.isArray(incident.ambiguityNotes) ? incident.ambiguityNotes : [],
  };
}

function parseExtractedIncidentFromGLM(raw: string): ExtractedIncident | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const p = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const flightRaw = p.flightNumber;
    const originRaw = p.origin;
    const destRaw = p.destination;
    const depRaw = p.originalDeparture;

    const flightNumber =
      flightRaw == null || flightRaw === '' ? undefined : String(flightRaw).replace(/\s+/g, '').toUpperCase() || undefined;
    const origin =
      originRaw == null || String(originRaw).trim() === '' ? undefined : String(originRaw).trim();
    const destination =
      destRaw == null || String(destRaw).trim() === '' ? undefined : String(destRaw).trim();
    const originalDeparture =
      depRaw == null || String(depRaw).trim() === '' ? undefined : String(depRaw).trim();

    let summary = String(p.summary ?? '').trim().slice(0, 500);
    const incident = ensureCriticalMissingFields({
      summary,
      disruptionType: normalizeDisruptionType(p.disruptionType),
      flightNumber,
      origin,
      destination,
      originalDeparture,
      confidence: typeof p.confidence === 'number' ? p.confidence : 0.75,
      missingFields: Array.isArray(p.missingFields) ? p.missingFields.map(String) : [],
      ambiguityNotes: Array.isArray(p.ambiguityNotes) ? p.ambiguityNotes.map(String) : [],
    });

    if (!incident.summary) {
      const parts = [
        incident.disruptionType !== 'unknown' ? incident.disruptionType : 'travel disruption',
        incident.flightNumber ? `flight ${incident.flightNumber}` : null,
        incident.origin && incident.destination
          ? `from ${incident.origin} to ${incident.destination}`
          : incident.destination
            ? `to ${incident.destination}`
            : incident.origin
              ? `from ${incident.origin}`
              : null,
      ].filter(Boolean);
      summary = parts.join(', ');
      incident.summary = summary || 'Incident';
    }

    return incident;
  } catch {
    return null;
  }
}

// ─── Stage 1: Input Agent ────────────────────────────────────────────────────

async function inputAgent(
  input: IncidentInput,
): Promise<{ incident: ExtractedIncident; usedGLM: boolean }> {
  const glm = createGLMClientFromEnv();
  if (glm) {
    try {
      const raw = await glm.complete(
        [
          { role: 'system', content: EXTRACTION_SYSTEM },
          { role: 'user', content: input.rawInput.slice(0, 8000) },
        ],
        1024,
      );
      const parsed = parseExtractedIncidentFromGLM(raw);
      if (parsed) return { incident: parsed, usedGLM: true };
    } catch (err) {
      console.warn('[workflowEngine] GLM extraction failed, using regex fallback:', (err as Error).message);
    }
  }

  const incident = buildFallbackExtraction(input);

  const parts = [
    incident.disruptionType !== 'unknown' ? incident.disruptionType : 'travel disruption',
    incident.flightNumber ? `flight ${incident.flightNumber}` : null,
    incident.origin && incident.destination
      ? `from ${incident.origin} to ${incident.destination}`
      : incident.destination
        ? `to ${incident.destination}`
        : incident.origin
          ? `from ${incident.origin}`
          : null,
  ].filter(Boolean);

  incident.summary = parts.join(', ') || input.rawInput.slice(0, 150);

  return { incident, usedGLM: false };
}

// ─── Recovery plan strategy (GLM) ───────────────────────────────────────────

const DEFAULT_RECOVERY_STRATEGY = 'Prioritise travel continuity, then financial recovery.';

const STRATEGY_SYSTEM = `You are ZenTravel's recovery strategist. The user will send JSON describing a travel disruption and what automated checks returned.

Write ONE concise strategy statement for a recovery-plan UI (maximum 2 sentences, plain English).

Cover, in order of urgency, what the traveller should focus on: alternative transport or lodging if relevant, baggage or airline follow-up if relevant, then compensation or claims if relevant. Match tone to severity (calm, professional).

Output rules: no title line, no markdown, no bullet points, no JSON, no leading label like "Strategy:". Do not wrap the answer in quotation marks.`;

async function generateRecoveryStrategy(
  incident: ExtractedIncident,
  react: ReActResult,
  allFailed: boolean,
): Promise<{ strategy: string; usedGLM: boolean }> {
  const glm = createGLMClientFromEnv();
  if (!glm) {
    return { strategy: DEFAULT_RECOVERY_STRATEGY, usedGLM: false };
  }

  try {
    const payload = JSON.stringify({
      incident: {
        summary: incident.summary,
        disruptionType: incident.disruptionType,
        flightNumber: incident.flightNumber ?? null,
        origin: incident.origin ?? null,
        destination: incident.destination ?? null,
      },
      plannerReasoning: react.toolPlan.reasoning,
      toolsExecuted: react.toolResults.map((r) => r.tool),
      observation: react.synthesis.observe,
      travellerGuidance: react.synthesis.traveller_summary,
      compensationEligible: Boolean(react.synthesis.compensation_email),
      hadHotelOptions: Boolean(react.synthesis.hotel_options),
      hadFlightOptions: Boolean(react.synthesis.flight_options),
      allAutomatedStepsFailed: allFailed,
    });

    const raw = await glm.complete(
      [{ role: 'system', content: STRATEGY_SYSTEM }, { role: 'user', content: payload }],
      1536,
    );

    let strategy = raw.replace(/\s+/g, ' ').trim();
    strategy = strategy.replace(/^["“”']+|["“”']+$/g, '');
    // Strip accidental "Strategy:" prefix
    strategy = strategy.replace(/^strategy\s*:\s*/i, '').trim();

    if (strategy.length < 15 || strategy.length > 600) {
      throw new Error('strategy length out of range');
    }

    return { strategy, usedGLM: true };
  } catch (err) {
    console.warn('[workflowEngine] GLM strategy failed, using default:', (err as Error).message);
    return { strategy: DEFAULT_RECOVERY_STRATEGY, usedGLM: false };
  }
}

// ─── Stage 2: Clarification Check ─────────────────────────────────────────────

function getClarifyingQuestions(incident: ExtractedIncident): string[] {
  const q: string[] = [];
  if (incident.missingFields.includes('destination') && !incident.destination)
    q.push('Where were you flying to?');
  if (incident.disruptionType === 'unknown')
    q.push('Was your flight delayed, cancelled, or was this a baggage issue?');
  return q;
}

// ─── Standard Sourcing Workflows (Hotels/Flights) ───────────────────────────

export async function runHotelSearchWorkflow(destination: string): Promise<StructuredWorkflowOutput> {
  const startedAt = performance.now();
  const summary = `SEARCH: Hotels in ${destination}`;
  const incident: ExtractedIncident = { summary, disruptionType: 'unknown', destination, confidence: 1.0, missingFields: [], ambiguityNotes: [] };
  const hAction = await hotelAgent(incident);
  return {
    stage: 'completed',
    incident,
    reasoning: ['User initiated hotel search', 'Agent bypasses recovery logic for direct sourcing'],
    clarifyingQuestions: [],
    plan: { strategy: 'AI Sourcing', priority: 'medium', userApprovalRequired: false, actions: [hAction] },
    failures: [],
    finalMessage: 'Sourced stays.',
    metadata: { usedGLM: true, fallbackUsed: false, executionMs: Math.round(performance.now() - startedAt) }
  };
}

export async function runFlightSearchWorkflow(origin: string, destination: string): Promise<StructuredWorkflowOutput> {
  const startedAt = performance.now();
  const summary = `SEARCH: Flights from ${origin} to ${destination}`;
  const incident: ExtractedIncident = { summary, disruptionType: 'unknown', origin, destination, confidence: 1.0, missingFields: [], ambiguityNotes: [] };
  const fAction = await flightAgent(incident);
  return {
    stage: 'completed',
    incident,
    reasoning: ['User initiated flight search', 'Querying global flight schedules'],
    clarifyingQuestions: [],
    plan: { strategy: 'Sourcing', priority: 'medium', userApprovalRequired: false, actions: [fAction] },
    failures: [],
    finalMessage: 'Sourced flights.',
    metadata: { usedGLM: true, fallbackUsed: false, executionMs: Math.round(performance.now() - startedAt) }
  };
}

// ─── Main Orchestration Workflow (The 5-Stage Engine) ─────────────────────────

export async function runZenTravelWorkflow(rawInput: string): Promise<StructuredWorkflowOutput> {
  const startedAt = performance.now();
  const failures: WorkflowFailure[] = [];
  const input: IncidentInput = { rawInput, source: 'chat', timestamp: new Date().toISOString() };

  // --- Stage 1: Extraction ---
  const { incident, usedGLM: glm1 } = await inputAgent(input);

  const extractLabel = glm1 ? 'GLM' : 'regex fallback';
  const reasoning: string[] = [
    `[Stage 1 — Input Agent] (${extractLabel}) type="${incident.disruptionType}", route=${incident.origin ?? '?'} → ${incident.destination ?? '?'}.`,
  ];

  // --- Stage 2: Validation ---
  const clarifyingQuestions = getClarifyingQuestions(incident);

  if (clarifyingQuestions.length > 0) {
    reasoning.push(`[Stage 2 — Validation] Missing critical data. Pausing for user input.`);
    return {
      stage: 'paused',
      incident,
      reasoning,
      clarifyingQuestions,
      plan: null,
      failures,
      finalMessage: 'I need a few more details to build your recovery plan.',
      metadata: { usedGLM: glm1, fallbackUsed: !glm1, executionMs: Math.round(performance.now() - startedAt) },
    };
  }

  reasoning.push(`[Stage 2 — Validation] All clear. Escalating to ReAct engine.`);

  // --- Stages 3–5: ReAct (Reason → Act → Observe) ---
  const react = await runReActOrchestration(incident);

  reasoning.push(
    `[Stage 3 — REASON] ${react.reactSteps[0].replace(/^\[REASON[^\]]*\]\s*/, '')}`,
    `[Stage 4 — ACT] Executed: ${react.toolResults.map(r => r.tool).join(', ')}`,
    `[Stage 5 — OBSERVE] ${react.synthesis.observe}`
  );

  failures.push(...mapActionFailures('execution', react.actions));
  const allFailed = react.actions.every((a) => a.status !== 'completed');

  const { strategy: strategyText, usedGLM: strategyFromGLM } = await generateRecoveryStrategy(
    incident,
    react,
    allFailed,
  );

  reasoning.push(`[Stage 6 — Plan strategy] ${strategyFromGLM ? 'GLM-authored' : 'fallback template'}.`);

  const finalUsedGLM =
    glm1 ||
    react.toolPlan.plannerSource === 'glm' ||
    react.synthesis.usedGLM ||
    strategyFromGLM;

  const plan: RecoveryPlan = {
    strategy: strategyText,
    priority: incident.disruptionType === 'cancellation' ? 'high' : 'medium',
    userApprovalRequired: true,
    actions: react.actions,
  };

  return {
    stage: allFailed ? 'failed' : 'completed',
    incident,
    reasoning,
    clarifyingQuestions: [],
    plan,
    failures,
    finalMessage: allFailed
      ? 'Automatic recovery failed. Please use specialist agents.'
      : 'Recovery plan complete. Review your options below.',
    metadata: { usedGLM: finalUsedGLM, fallbackUsed: !finalUsedGLM, executionMs: Math.round(performance.now() - startedAt) },
  };
}
