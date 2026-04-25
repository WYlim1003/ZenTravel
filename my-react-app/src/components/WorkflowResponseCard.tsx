import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { buildEmailPayload, isEmailJsConfigured, sendRecoveryEmail } from '../services/emailService';
import type { StructuredWorkflowOutput, WorkflowAction } from '../agents/types';

const STAGES = [
  { id: 1, label: 'Input',    icon: '📥' },
  { id: 2, label: 'Validate', icon: '🔍' },
  { id: 3, label: 'Reason',   icon: '🧠' },
  { id: 4, label: 'Act',      icon: '⚙️' },
  { id: 5, label: 'Observe',  icon: '📊' },
];

function getCompletedStages(stage: StructuredWorkflowOutput['stage']): number {
  if (stage === 'paused')    return 2;
  if (stage === 'completed') return 5;
  if (stage === 'failed')    return 4; // failed at observe
  return 0;
}

const StageBar: React.FC<{ stage: StructuredWorkflowOutput['stage'] }> = ({ stage }) => {
  const completed = getCompletedStages(stage);
  return (
    <div className="wrc2-stage-bar">
      {STAGES.map((s, idx) => {
        const isDone   = completed >= s.id;
        const isFailed = stage === 'failed' && s.id > completed;
        const stateClass = isDone ? 'wrc2-sb-step--done'
                         : isFailed ? 'wrc2-sb-step--failed'
                         : 'wrc2-sb-step--pending';
        return (
          <React.Fragment key={s.id}>
            <div className={`wrc2-sb-step ${stateClass}`}>
              <div className="wrc2-sb-circle">
                {isDone ? '✓' : isFailed ? '✕' : s.id}
              </div>
              <span className="wrc2-sb-label">{s.label}</span>
            </div>
            {idx < STAGES.length - 1 && (
              <div className={`wrc2-sb-line ${isDone && completed > s.id ? 'wrc2-sb-line--done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface Props {
  output: StructuredWorkflowOutput;
}

const DISRUPTION_META: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  cancellation: { label: 'Flight Cancelled',  color: '#dc2626', bg: '#fef2f2', emoji: '✈️' },
  delay:        { label: 'Flight Delayed',     color: '#d97706', bg: '#fffbeb', emoji: '⏱️' },
  lost_luggage: { label: 'Lost Luggage',        color: '#7c3aed', bg: '#f5f3ff', emoji: '🧳' },
  unknown:      { label: 'Travel Disruption',   color: '#6b7280', bg: '#f9fafb', emoji: '⚠️' },
};

const ACTION_META: Record<string, {
  icon: string; label: string; tag: string; tagColor: string; tagBg: string; cardBg: string; borderColor: string;
}> = {
  flight: {
    icon: '✈️', label: 'Flight Alternatives', tag: 'REBOOKING',
    tagColor: '#d97706', tagBg: '#fffbeb', cardBg: '#fffcf5', borderColor: '#fde68a',
  },
  hotel: {
    icon: '🏨', label: 'Emergency Accommodation', tag: 'HOTEL',
    tagColor: '#2563eb', tagBg: '#eff6ff', cardBg: '#f5f9ff', borderColor: '#bfdbfe',
  },
  compensation: {
    icon: '📋', label: 'Compensation Claim', tag: 'CLAIM',
    tagColor: '#7c3aed', tagBg: '#f5f3ff', cardBg: '#faf7ff', borderColor: '#ddd6fe',
  },
  communication: {
    icon: '📨', label: 'Recovery Summary', tag: 'UPDATE',
    tagColor: '#059669', tagBg: '#f0fdf4', cardBg: '#f5fdf8', borderColor: '#a7f3d0',
  },
};

interface ActionCardProps {
  action: WorkflowAction;
  approved: boolean;
  rejected: boolean;
  onApprove: () => void;
  onReject: () => void;
}

const ActionApprovalCard: React.FC<ActionCardProps> = ({
  action, approved, rejected, onApprove, onReject,
}) => {
  const meta = ACTION_META[action.agent] ?? {
    icon: '🔧', label: action.agent, tag: 'ACTION',
    tagColor: '#6b7280', tagBg: '#f3f4f6', cardBg: '#f9fafb', borderColor: '#e5e7eb',
  };

  if (action.status === 'skipped' || action.status === 'failed') {
    return (
      <div className="wrc2-action-card wrc2-action-card--skipped">
        <span className="wrc2-action-icon">{meta.icon}</span>
        <div className="wrc2-action-body">
          <span className="wrc2-action-label">{meta.label}</span>
          <span className="wrc2-action-note">
            {action.status === 'skipped' ? 'Not required for this case' : (action.error ?? 'Could not complete')}
          </span>
        </div>
        <span className="wrc2-skip-badge">{action.status === 'skipped' ? 'N/A' : '⚠ Failed'}</span>
      </div>
    );
  }

  return (
    <div
      className={`wrc2-action-card ${approved ? 'wrc2-action-card--approved' : ''} ${rejected ? 'wrc2-action-card--rejected' : ''}`}
      style={{ background: meta.cardBg, borderColor: meta.borderColor }}
    >
      <div className="wrc2-action-top">
        <div className="wrc2-action-title-row">
          <span className="wrc2-action-icon">{meta.icon}</span>
          <div>
            <div className="wrc2-action-label">{meta.label}</div>
            <span className="wrc2-action-tag" style={{ color: meta.tagColor, background: meta.tagBg }}>
              {meta.tag}
            </span>
          </div>
        </div>
        {approved && <span className="wrc2-approved-stamp">✓ Approved</span>}
        {rejected && <span className="wrc2-rejected-stamp">✕ Skipped</span>}
      </div>

      <pre className="wrc2-action-output">{action.output ?? action.description}</pre>

      {!approved && !rejected && (
        <div className="wrc2-action-btns">
          <button className="wrc2-btn wrc2-btn--approve" onClick={onApprove}>✓ Approve</button>
          <button className="wrc2-btn wrc2-btn--reject"  onClick={onReject}>✕ Skip</button>
        </div>
      )}
    </div>
  );
};

export const WorkflowResponseCard: React.FC<Props> = ({ output }) => {
  const [showReasoning, setShowReasoning] = useState(false);
  const [approved,  setApproved]  = useState<Record<string, boolean>>({});
  const [rejected,  setRejected]  = useState<Record<string, boolean>>({});
  const [emailedTo,   setEmailedTo]   = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailMethod,  setEmailMethod]  = useState<'emailjs' | 'mailto' | null>(null);

  const disruption = DISRUPTION_META[output.incident.disruptionType] ?? DISRUPTION_META.unknown;
  const isPaused    = output.stage === 'paused';
  const isFailed    = output.stage === 'failed';
  const isCompleted = output.stage === 'completed';

  const executableActions = output.plan?.actions.filter(
    (a) => a.status !== 'skipped' && a.status !== 'failed',
  ) ?? [];
  const allDecided    = executableActions.length > 0 &&
    executableActions.every((a) => approved[a.id] || rejected[a.id]);
  const approvedActions = executableActions.filter((a) => approved[a.id]);
  const approvedCount   = approvedActions.length;

  const handleExecute = async () => {
    setEmailSending(true);
    const userEmail   = auth.currentUser?.email   ?? '';
    const userName    = auth.currentUser?.displayName ?? '';
    const approvedList = executableActions.filter((a) => approved[a.id]);
    const payload = buildEmailPayload(output, approvedList, userEmail, userName);
    const result = await sendRecoveryEmail(payload);
    setEmailMethod(result.method === 'emailjs' && result.ok ? 'emailjs' : 'mailto');
    setEmailedTo(userEmail || 'your registered email');
    setEmailSending(false);
  };

  return (
    <div className="wrc2-card">

      {/* ── Header ───────────────────────────────── */}
      <div className="wrc2-header" style={{ background: disruption.bg }}>
        <span className="wrc2-header-emoji">{disruption.emoji}</span>
        <div className="wrc2-header-text">
          <span className="wrc2-header-type" style={{ color: disruption.color }}>{disruption.label}</span>
          <span className="wrc2-header-sub">
            {output.incident.flightNumber && `Flight ${output.incident.flightNumber} · `}
            {output.incident.origin && output.incident.destination
              ? `${output.incident.origin} → ${output.incident.destination}`
              : output.incident.summary.slice(0, 70)}
          </span>
        </div>
        {output.metadata.usedGLM && <span className="wrc2-glm-badge">GLM</span>}
      </div>

      {/* ── Stage progress bar ────────────────────── */}
      <StageBar stage={output.stage} />

      {/* ── Paused: needs clarification ───────────── */}
      {isPaused && (
        <div className="wrc2-clarify-section">
          <p className="wrc2-clarify-intro">
            I can see a <strong>{output.incident.disruptionType}</strong> situation, but I need a
            couple more details to build your recovery plan safely:
          </p>
          <ul className="wrc2-clarify-list">
            {output.clarifyingQuestions.map((q, i) => (
              <li key={i} className="wrc2-clarify-item">
                <span className="wrc2-clarify-q">?</span>
                {q}
              </li>
            ))}
          </ul>
          <p className="wrc2-clarify-hint">
            Reply with these details and I'll immediately start the full recovery workflow.
          </p>
        </div>
      )}

      {/* ── Completed: strategy approval ──────────── */}
      {isCompleted && output.plan && (
        <div className="wrc2-strategies-section">
          {emailedTo === null ? (
            <>
              <div className="wrc2-strategies-header">
                <span className="wrc2-strategies-title">🛡️ Recovery Plan — Review & Approve</span>
                <span className="wrc2-strategies-sub">{output.plan.strategy}</span>
              </div>

              <div className="wrc2-actions-list">
                {output.plan.actions.map((action) => (
                  <ActionApprovalCard
                    key={action.id}
                    action={action}
                    approved={!!approved[action.id]}
                    rejected={!!rejected[action.id]}
                    onApprove={() => setApproved((p) => ({ ...p, [action.id]: true }))}
                    onReject={() =>  setRejected((p) => ({ ...p, [action.id]: true }))}
                  />
                ))}
              </div>

              {allDecided && (
                <div className="wrc2-email-execute">
                  {isEmailJsConfigured() ? (
                    <p className="wrc2-emailjs-hint wrc2-emailjs-hint--on">
                      Email delivery: in-app (EmailJS). Sends to your signed-in address.
                    </p>
                  ) : (
                    <p className="wrc2-emailjs-hint wrc2-emailjs-hint--off">
                      EmailJS not set in <code>my-react-app/.env</code> — the button will open your
                      email app (mailto) instead. Add <code>VITE_EMAILJS_SERVICE_ID</code>,{' '}
                      <code>VITE_EMAILJS_TEMPLATE_ID</code>, and <code>VITE_EMAILJS_PUBLIC_KEY</code>
                      , then restart Vite.
                    </p>
                  )}
                  <button
                    className="wrc2-execute-btn"
                    onClick={() => void handleExecute()}
                    disabled={emailSending}
                  >
                    {emailSending
                      ? '⏳ Sending recovery email…'
                      : `📧 Execute & Email Recovery Plan (${approvedCount} action${approvedCount !== 1 ? 's' : ''})`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="wrc2-executed-banner">
              <span className="wrc2-executed-icon">📧</span>
              <div>
                <p className="wrc2-executed-title">
                  {emailMethod === 'emailjs'
                    ? `Recovery plan delivered to ${emailedTo}`
                    : `Recovery email prepared for ${emailedTo}`}
                </p>
                <p className="wrc2-executed-sub">
                  {emailMethod === 'emailjs'
                    ? `${approvedCount} approved action${approvedCount !== 1 ? 's' : ''} sent via ZenTravel AI. Check your inbox.`
                    : `Your email client has opened with the full recovery summary. Please click Send to dispatch it.`}
                </p>
                <button
                  className="wrc2-resend-btn"
                  onClick={() => {
                    const list = executableActions.filter((a) => approved[a.id]);
                    const userName = auth.currentUser?.displayName ?? '';
                    const payload  = buildEmailPayload(output, list, emailedTo ?? '', userName);
                    void sendRecoveryEmail(payload);
                  }}
                >
                  ↗ Resend Email
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Failed ────────────────────────────────── */}
      {isFailed && (
        <div className="wrc2-fail-section">
          <div className="wrc2-fail-banner">❌ {output.finalMessage}</div>
          {output.failures.map((f, i) => (
            <div key={i} className="wrc2-fail-row">
              <span className="wrc2-fail-reason">{f.reason}</span>
              {f.recoverable && <span className="wrc2-fail-next">→ {f.nextBestStep}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── AI Reasoning ──────────────────────────── */}
      {output.reasoning.length > 0 && (
        <div className="wrc2-reasoning">
          <button className="wrc2-reasoning-toggle" onClick={() => setShowReasoning((v) => !v)}>
            {showReasoning ? '▲ Hide' : '▼ Show'} AI Reasoning
          </button>
          {showReasoning && (
            <ol className="wrc2-reasoning-list">
              {output.reasoning.map((r, i) => <li key={i}>{r}</li>)}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};
