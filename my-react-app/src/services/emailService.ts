/**
 * ZenTravel Email Service
 *
 * Sends recovery plan emails via EmailJS (real delivery, no backend needed).
 * Falls back to opening a mailto: link if EmailJS keys are not configured.
 *
 * Setup (5 minutes):
 *  1. Go to https://www.emailjs.com and sign up (free – 200 emails/month)
 *  2. Dashboard → Email Services → Add New Service → connect your Gmail / Outlook
 *     Copy the Service ID  →  VITE_EMAILJS_SERVICE_ID
 *  3. Dashboard → Email Templates → Create New Template
 *     Use the variables: {{to_email}}, {{to_name}}, {{subject}}, {{disruption_type}},
 *     {{flight_number}}, {{route}}, {{recovery_actions}}, {{timestamp}}
 *     Copy the Template ID  →  VITE_EMAILJS_TEMPLATE_ID
 *  4. Dashboard → Account → Public Key  →  VITE_EMAILJS_PUBLIC_KEY
 *  5. Add all three to zentravel/.env and restart the dev server.
 */

import emailjs from '@emailjs/browser';
import type { StructuredWorkflowOutput, WorkflowAction } from '../agents/types';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

const isConfigured = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

// ─── Email content builder ─────────────────────────────────────────────────

export interface RecoveryEmailPayload {
  toEmail:   string;
  toName:    string;
  subject:   string;
  disruptionType: string;
  flightNumber:   string;
  route:          string;
  recoveryActions: string;
  timestamp:      string;
}

export function buildEmailPayload(
  output:          StructuredWorkflowOutput,
  approvedActions: WorkflowAction[],
  userEmail:       string,
  userName:        string,
): RecoveryEmailPayload {
  const { incident } = output;

  const route =
    incident.origin && incident.destination
      ? `${incident.origin} → ${incident.destination}`
      : incident.destination ?? 'Unknown route';

  const typeLabel =
    incident.disruptionType === 'cancellation' ? 'Flight Cancellation'
    : incident.disruptionType === 'delay'        ? 'Flight Delay'
    : incident.disruptionType === 'lost_luggage' ? 'Lost Luggage'
    : 'Travel Disruption';

  const subject = `ZenTravel Recovery Plan — ${incident.flightNumber ?? typeLabel} — ${route}`;

  const actionLines = approvedActions.map((a) => {
    const label =
      a.agent === 'flight'         ? '✈ Flight Rebooking Options'
      : a.agent === 'hotel'        ? '🏨 Emergency Accommodation'
      : a.agent === 'compensation' ? '📋 Compensation Claim'
      : '📨 Recovery Summary';
    const divider = '─'.repeat(50);
    return `${label}\n${divider}\n${a.output ?? a.description}`;
  }).join('\n\n');

  return {
    toEmail:         userEmail,
    toName:          userName || 'Traveller',
    subject,
    disruptionType:  typeLabel,
    flightNumber:    incident.flightNumber ?? 'N/A',
    route,
    recoveryActions: actionLines || 'No actions approved.',
    timestamp:       new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
  };
}

// ─── Send via EmailJS ─────────────────────────────────────────────────────

export type SendResult =
  | { method: 'emailjs'; ok: true }
  | { method: 'emailjs'; ok: false; error: string }
  | { method: 'mailto';  ok: true };

export async function sendRecoveryEmail(
  payload: RecoveryEmailPayload,
): Promise<SendResult> {
  if (isConfigured) {
    try {
      await emailjs.send(
        SERVICE_ID!,
        TEMPLATE_ID!,
        {
          to_email:         payload.toEmail,
          to_name:          payload.toName,
          subject:          payload.subject,
          disruption_type:  payload.disruptionType,
          flight_number:    payload.flightNumber,
          route:            payload.route,
          recovery_actions: payload.recoveryActions,
          timestamp:        payload.timestamp,
        },
        PUBLIC_KEY!,
      );
      return { method: 'emailjs', ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fall through to mailto on failure
      console.warn('[EmailService] EmailJS failed, opening mailto fallback:', msg);
      openMailto(payload);
      return { method: 'emailjs', ok: false, error: msg };
    }
  }

  // EmailJS not configured — open mailto: so judges still see a composed email
  openMailto(payload);
  return { method: 'mailto', ok: true };
}

function openMailto(payload: RecoveryEmailPayload): void {
  const body =
    `Dear ${payload.toName},\n\n` +
    `Your ZenTravel AI has completed the recovery workflow for your recent travel disruption.\n\n` +
    `INCIDENT DETAILS\n${'─'.repeat(50)}\n` +
    `Type:      ${payload.disruptionType}\n` +
    `Flight:    ${payload.flightNumber}\n` +
    `Route:     ${payload.route}\n` +
    `Processed: ${payload.timestamp}\n\n` +
    `APPROVED RECOVERY ACTIONS\n${'─'.repeat(50)}\n` +
    payload.recoveryActions +
    `\n\n─────────────────────────────────────────────────\n` +
    `This is a hackathon demo. No real bookings or claims were made.\n` +
    `In production, ZenTravel AI would execute these actions automatically.\n\n` +
    `Safe travels,\nZenTravel AI Team`;

  const mailto =
    `mailto:${encodeURIComponent(payload.toEmail)}` +
    `?subject=${encodeURIComponent(payload.subject)}` +
    `&body=${encodeURIComponent(body)}`;

  window.open(mailto, '_blank');
}
