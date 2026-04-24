/**
 * ZenTravel Brain Master — ReAct Orchestration Engine
 */

import { createGLMClientFromEnv } from '../services/glmClient';
import {
  executeTool,
  type ToolCallPlan,
  type ToolResult,
} from '../services/mockTravelAPI';
import type { ExtractedIncident, WorkflowAction, WorkflowFailure } from './types';

// --- Interfaces for Orchestration ---
export interface ToolPlan {
  reasoning: string;
  tools: ToolCallPlan[];
  /** Set when the planner chose tools via GLM vs rule fallback */
  plannerSource?: 'glm' | 'rules';
}

export interface SynthesisResult {
  observe: string;
  flight_options: string | null;
  hotel_options: string | null;
  compensation_summary: string | null;
  compensation_email: string | null;
  traveller_summary: string;
  usedGLM: boolean;
}

export interface ReActResult {
  toolPlan: ToolPlan;
  toolResults: ToolResult[];
  synthesis: SynthesisResult;
  actions: WorkflowAction[];
  reactSteps: string[];
}

// ─── ReAct Step 1: Planning ──────────────────────────────────────────────────

const VALID_TOOLS = new Set(['search_flights', 'search_hotels', 'check_compensation']);

const TOOL_PLANNER_SYSTEM = `You are ZenTravel's recovery planner. Given a structured travel disruption incident (JSON), decide which mock APIs to call to help the traveller.

Allowed tools and params:
- search_flights: { "from": city or IATA, "to": city or IATA, "count": 1-5 }
- search_hotels: { "airport": city or IATA near where they need a room }
- check_compensation: { "type": "delay"|"cancellation"|"lost_luggage"|"unknown" }

Guidelines:
- Include check_compensation whenever passenger rights may apply.
- Include search_flights when they need alternatives or rebooking context.
- Include search_hotels for cancellations, long delays likely to require overnight stay, or stranded situations; often skip for brief delays or pure lost-luggage unless they need a hotel.
- Prefer incident.origin/destination when provided; use sensible hubs (e.g. KUL) only if unknown.

Return ONLY valid JSON (no markdown):
{"reasoning":"2-5 sentences explaining the plan","tools":[{"tool":"search_flights","params":{"from":"...","to":"...","count":3}},...]}`;

function ruleBasedToolPlan(incident: ExtractedIncident): ToolPlan {
  const tools: ToolCallPlan[] = [
    {
      tool: 'search_flights',
      params: { from: incident.origin || 'KUL', to: incident.destination || 'SIN', count: 3 },
    },
    {
      tool: 'check_compensation',
      params: { type: incident.disruptionType },
    },
  ];

  if (incident.disruptionType === 'delay' || incident.disruptionType === 'cancellation') {
    tools.push({
      tool: 'search_hotels',
      params: { airport: incident.destination || incident.origin || 'KUL' },
    });
  }

  return {
    reasoning: `Rule-based plan for ${incident.disruptionType}: search flights from ${incident.origin || 'KUL'} to ${incident.destination || 'destination'}, check compensation, ${incident.disruptionType !== 'lost_luggage' ? 'find nearby hotels.' : '(no hotel search for luggage issues).'}`,
    tools,
    plannerSource: 'rules',
  };
}

function parseGLMToolPlan(raw: string): { reasoning: string; tools: ToolCallPlan[] } | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { reasoning?: string; tools?: unknown };
    if (!Array.isArray(parsed.tools)) return null;
    const tools: ToolCallPlan[] = [];
    for (const item of parsed.tools) {
      if (!item || typeof item !== 'object') continue;
      const t = item as { tool?: string; params?: Record<string, string | number | boolean> };
      if (!t.tool || !VALID_TOOLS.has(t.tool)) continue;
      tools.push({ tool: t.tool, params: t.params && typeof t.params === 'object' ? t.params : {} });
    }
    if (tools.length === 0) return null;
    return {
      reasoning: typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : 'GLM planner selected tools for this incident.',
      tools,
    };
  } catch {
    return null;
  }
}

function sanitizeToolPlan(incident: ExtractedIncident, plan: ToolPlan): ToolPlan {
  const fromDefault = incident.origin || 'KUL';
  const toDefault = incident.destination || 'SIN';
  const airportDefault = incident.destination || incident.origin || 'KUL';

  const tools = plan.tools.map((call) => {
    const p = call.params ?? {};
    switch (call.tool) {
      case 'search_flights':
        return {
          tool: 'search_flights' as const,
          params: {
            from: String(p.from ?? p.origin ?? fromDefault),
            to: String(p.to ?? p.destination ?? toDefault),
            count: Math.min(5, Math.max(1, Number(p.count ?? 3))),
          },
        };
      case 'search_hotels':
        return {
          tool: 'search_hotels' as const,
          params: {
            airport: String(p.airport ?? p.from ?? p.origin ?? airportDefault),
          },
        };
      case 'check_compensation':
        return {
          tool: 'check_compensation' as const,
          params: {
            type: String(p.type ?? p.disruption_type ?? incident.disruptionType ?? 'unknown'),
          },
        };
      default:
        return call;
    }
  });

  return { ...plan, tools };
}

/** GLM reasons about which tools to run; falls back to deterministic rules if GLM is unavailable or invalid. */
export async function planToolCalls(incident: ExtractedIncident): Promise<ToolPlan> {
  const glm = createGLMClientFromEnv();
  if (glm) {
    try {
      const incidentJson = JSON.stringify({
        summary: incident.summary,
        disruptionType: incident.disruptionType,
        flightNumber: incident.flightNumber ?? null,
        origin: incident.origin ?? null,
        destination: incident.destination ?? null,
        missingFields: incident.missingFields,
      });
      const raw = await glm.complete(
        [
          { role: 'system', content: TOOL_PLANNER_SYSTEM },
          { role: 'user', content: incidentJson },
        ],
        900,
      );
      const parsed = parseGLMToolPlan(raw);
      if (parsed) {
        return sanitizeToolPlan(incident, {
          reasoning: parsed.reasoning,
          tools: parsed.tools,
          plannerSource: 'glm',
        });
      }
    } catch (err) {
      console.warn('[tools] GLM tool planning failed, using rules:', (err as Error).message);
    }
  }

  return ruleBasedToolPlan(incident);
}


// ─── ReAct Step 2: Execution ──────────────────────────────────────────────────

export async function executeTools(plan: ToolPlan): Promise<ToolResult[]> {
  // Guard: if GLM returned a plan without a tools array, use empty list
  if (!Array.isArray(plan.tools) || plan.tools.length === 0) return [];
  return Promise.all(plan.tools.map((call) => executeTool(call)));
}

// ─── ReAct Step 3: Synthesis ──────────────────────────────────────────────────
//
// Strategy: structured data (flights, hotels, compensation amounts) is built
// directly from tool results in code — no GLM needed for that part.
// GLM is only asked to write 2–3 SHORT narrative sentences so the token budget
// stays small (~300 tokens) and the call completes well within the timeout.

interface CompData { eligible?: boolean; amountMYR?: number; amountEUR?: number; regulation?: string; claimDeadline?: string }
interface FlightData { airline: string; flightNumber: string; departIn: string; priceMYR: number; recommended?: boolean }
interface HotelData  { name: string; stars: number; priceMYR: number; amenity?: string; recommended?: boolean }

/** Build all structured fields from raw tool results — no GLM required */
function buildStructuredFields(toolResults: ToolResult[]) {
  const flightResult = toolResults.find((r) => r.tool === 'search_flights');
  const hotelResult  = toolResults.find((r) => r.tool === 'search_hotels');
  const compResult   = toolResults.find((r) => r.tool === 'check_compensation');

  const flightList = Array.isArray(flightResult?.result)
    ? (flightResult!.result as FlightData[])
        .map((f) => `${f.recommended ? '★ ' : ''}${f.airline} ${f.flightNumber} (departs ${f.departIn}, MYR ${f.priceMYR})`)
        .join(' | ')
    : null;

  const hotelList = Array.isArray(hotelResult?.result)
    ? (hotelResult!.result as HotelData[])
        .map((h) => `${h.recommended ? '★ ' : ''}${h.name} (${h.stars}★, MYR ${h.priceMYR}/night${h.amenity ? ' · ' + h.amenity : ''})`)
        .join(' | ')
    : null;

  const comp = compResult?.result as CompData | undefined;
  const compSummary = comp?.eligible
    ? `Eligible for MYR ${comp.amountMYR} (EUR ${comp.amountEUR}) under ${comp.regulation}. Claim deadline: ${comp.claimDeadline}.`
    : 'Standard compensation does not apply for this disruption type.';

  const compEmail = comp?.eligible
    ? `Dear Airline Customer Relations,\n\nI am writing to claim compensation for my disrupted flight under ${comp.regulation}.\n\nDue to the flight disruption I experienced, I am entitled to compensation of EUR ${comp.amountEUR} per the applicable regulations. Please process my claim at your earliest convenience and confirm receipt of this request.\n\nI look forward to your response.\n\nYours sincerely,\n[Your Name]`
    : null;

  return { flightList, hotelList, compSummary, compEmail, comp };
}

export async function synthesiseResults(incident: ExtractedIncident, toolResults: ToolResult[]): Promise<SynthesisResult> {
  // Build structured fields from tool data (always works, no GLM needed)
  const { flightList, hotelList, compSummary, compEmail } = buildStructuredFields(toolResults);

  // Ask GLM only for the short narrative (observe + traveller_summary)
  // ~150 token output — fast and reliable even on a thinking model
  const glm = createGLMClientFromEnv();
  let observe = `APIs returned ${toolResults.length} data set(s) for the disruption.`;
  let traveller_summary = 'Here are your recovery options. Please review and approve the plan below.';

  let narrativeUsedGLM = false;
  if (glm) {
    try {
      const toolSummary = toolResults.map((r) => r.tool).join(', ');
      const prompt = `Travel disruption: ${incident.summary}. Tools called: ${toolSummary}. Flights found: ${flightList ? 'yes' : 'no'}. Compensation eligible: ${compEmail ? 'yes' : 'no'}. Write exactly 2 sentences: (1) one-sentence observation of what the AI found, (2) one-sentence guidance for the traveller. No JSON, no bullet points.`;

      const narrative = await glm.complete(
        [{ role: 'user', content: prompt }],
        500, // small budget — just 2 sentences needed
      );

      const sentences = narrative.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length >= 2) {
        observe = sentences[0];
        traveller_summary = sentences.slice(1).join(' ');
        narrativeUsedGLM = true;
      } else if (sentences.length === 1) {
        observe = sentences[0];
        narrativeUsedGLM = true;
      }
    } catch (err) {
      console.warn('[tools] GLM narrative failed, using defaults:', (err as Error).message);
    }
  }

  return {
    observe,
    flight_options:       flightList,
    hotel_options:        hotelList,
    compensation_summary: compSummary,
    compensation_email:   compEmail,
    traveller_summary,
    usedGLM: narrativeUsedGLM,
  };
}

// ─── Helper: Convert Synthesis to Actions ─────────────────────────────────────

function synthesisToActions(result: SynthesisResult): WorkflowAction[] {
  const actions: WorkflowAction[] = [];

  if (result.flight_options) {
    actions.push({ id: 'flight-rebook', agent: 'flight', description: 'Flight options', status: 'completed', output: result.flight_options });
  }
  if (result.hotel_options) {
    actions.push({ id: 'hotel-backup', agent: 'hotel', description: 'Hotel options', status: 'completed', output: result.hotel_options });
  }
  if (result.compensation_email) {
    actions.push({ id: 'comp-claim', agent: 'compensation', description: 'Claim draft', status: 'completed', output: result.compensation_email });
  }
  
  actions.push({ id: 'user-update', agent: 'communication', description: 'Summary', status: 'completed', output: result.traveller_summary });

  return actions;
}

// ─── PUBLIC ORCHESTRATOR (The Missing Export) ────────────────────────────────

export async function runReActOrchestration(incident: ExtractedIncident): Promise<ReActResult> {
  // 1. REASON
  const toolPlan = await planToolCalls(incident);

  // 2. ACT
  const toolResults = await executeTools(toolPlan);

  // 3. OBSERVE & SYNTHESIZE
  const synthesis = await synthesiseResults(incident, toolResults);

  const actions = synthesisToActions(synthesis);

  const plannerLabel = toolPlan.plannerSource === 'glm' ? 'GLM' : 'rules';
  const reactSteps = [
    `[REASON — ${plannerLabel}] ${toolPlan.reasoning}`,
    `[ACT] Executed: ${toolResults.map((r) => r.tool).join(', ')}`,
    `[OBSERVE] ${synthesis.observe}`,
  ];

  return { toolPlan, toolResults, synthesis, actions, reactSteps };
}

// ─── Specialized Search Agents ───────────────────────────────────────────────

export async function hotelAgent(incident: ExtractedIncident): Promise<WorkflowAction> {
  const glm = createGLMClientFromEnv();
  const isSearch = incident.summary.toLowerCase().includes("search");

  if (isSearch && glm) {
    const response = await glm.complete([{ role: 'system', content: `Find 3 hotels in ${incident.destination}. Return JSON array only.` }]);
    return { id: `h-${Date.now()}`, agent: 'hotel', description: 'Sourced', status: 'completed', output: response.replace(/```json|```/g, "").trim() };
  }
  return { id: 'h-skip', agent: 'hotel', description: 'Skip', status: 'skipped' };
}

export async function flightAgent(incident: ExtractedIncident): Promise<WorkflowAction> {
  const glm = createGLMClientFromEnv();
  const isSearch = incident.summary.toLowerCase().includes("search");

  if (isSearch && glm) {
    const response = await glm.complete([{ role: 'system', content: `Find 3 flights to ${incident.destination}. Return JSON array only.` }]);
    return { id: `f-${Date.now()}`, agent: 'flight', description: 'Sourced', status: 'completed', output: response.replace(/```json|```/g, "").trim() };
  }
  return { id: 'f-skip', agent: 'flight', description: 'Skip', status: 'skipped' };
}

export async function compensationAgent(_incident: ExtractedIncident): Promise<WorkflowAction> {
  return { id: 'comp', agent: 'compensation', description: 'Check', status: 'skipped' };
}

export async function communicationAgent(_context: unknown, _actions: WorkflowAction[]): Promise<WorkflowAction> {
  return { id: 'comm', agent: 'communication', description: 'Notify', status: 'completed', output: 'Recovery ready.' };
}

export function mapActionFailures(stage: 'planning' | 'execution', actions: WorkflowAction[]): WorkflowFailure[] {
  return actions.filter(a => a.status === 'failed').map(a => ({ stage, reason: `${a.agent}: ${a.error || 'failed'}`, recoverable: true, nextBestStep: 'Retry' }));
}
