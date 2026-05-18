import React, { useState } from 'react';
import {
  ArrowLeft, Plus, Trash2, MapPin,
  Clock, Utensils, Building2, Plane, Camera,
  Sparkles, Download, X, ChevronDown,
} from 'lucide-react';
import { getDestinationInfo } from '../services/mockDestinationAPI';
import jsPDF from 'jspdf';
import '../styles/TripPlannerPage.css';

interface Activity {
  id: string;
  type: 'Flight' | 'Stay' | 'Food' | 'Activity';
  time: string;
  location: string;
  description: string;
}

interface DayPlan {
  dayNumber: number;
  activities: Activity[];
}

interface Suggestion {
  text: string;
  location: string;
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

/** Helvetica in jsPDF is WinAnsi-only; strip emoji and normalize common Unicode punctuation. */
function pdfSafe(s: string): string {
  return s
    .replace(/[\u2190-\u2199\u21A6\u27A1\u2794]/g, '->')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\uFE0F/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '');
}

function exportManualPDF(itinerary: DayPlan[], tripName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 15;
  const purple: [number, number, number] = [123, 44, 191];
  const blue: [number, number, number]   = [68, 97, 242];
  let y = margin;

  const checkY = (needed: number) => {
    if (y + needed > 280) { doc.addPage(); y = margin; }
  };

  // Cover
  doc.setFillColor(...purple);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(pdfSafe(tripName).replace(/\s+/g, ' ').trim() || 'My Trip', margin, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${itinerary.length} Day${itinerary.length > 1 ? 's' : ''} | Custom Itinerary | Created with ZenTravel`,
    margin,
    30,
  );
  y = 48;

  for (const day of itinerary) {
    checkY(20);
    doc.setFillColor(...blue);
    doc.rect(margin, y, W - margin * 2, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`  DAY ${day.dayNumber}`, margin + 2, y + 6.5);
    y += 13;
    doc.setTextColor(0, 0, 0);

    if (day.activities.length === 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('  No activities added yet.', margin + 3, y);
      y += 10;
      continue;
    }

    for (const act of day.activities) {
      checkY(18);
      const typeColors: Record<string, [number, number, number]> = {
        Flight:   [68, 97, 242],
        Stay:     [123, 44, 191],
        Food:     [255, 159, 67],
        Activity: [40, 199, 111],
      };
      const [r, g, b] = typeColors[act.type] ?? [100, 100, 100];
      doc.setFillColor(r, g, b);
      doc.rect(margin, y, 4, 14, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(act.type.toUpperCase(), margin + 6, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(pdfSafe(`${act.time} - ${act.description || '(no description)'}`), margin + 6, y + 9.5);
      if (act.location) doc.text(pdfSafe(`Location: ${act.location}`), margin + 6, y + 13.5);
      y += act.location ? 18 : 14;
      checkY(4);
    }
    y += 6;
  }

  doc.save(`ZenTravel_MyTrip_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ManualPlannerPage: React.FC<{ setView: (v: string) => void }> = ({ setView }) => {
  const [itinerary, setItinerary] = useState<DayPlan[]>([{ dayNumber: 1, activities: [] }]);
  const [tripName,  setTripName]  = useState('My Custom Trip');

  // AI suggestions
  const [showSuggest,    setShowSuggest]    = useState<number | null>(null);
  const [suggestions,    setSuggestions]    = useState<Suggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [suggestDest,    setSuggestDest]    = useState('');

  const addDay = () =>
    setItinerary([...itinerary, { dayNumber: itinerary.length + 1, activities: [] }]);

  const addBlock = (dayIdx: number, type: Activity['type']) => {
    const newItin = [...itinerary];
    newItin[dayIdx].activities.push({
      id:          crypto.randomUUID(),
      type,
      time:        '12:00',
      location:    '',
      description: '',
    });
    setItinerary(newItin);
  };

  const updateBlock = (dayIdx: number, blockId: string, field: keyof Activity, value: string) => {
    const newItin = [...itinerary];
    const block   = newItin[dayIdx].activities.find(a => a.id === blockId);
    if (block) {
      (block as unknown as Record<string, string>)[field] = value;
      setItinerary(newItin);
    }
  };

  const removeBlock = (dayIdx: number, blockId: string) => {
    const newItin = [...itinerary];
    newItin[dayIdx].activities = newItin[dayIdx].activities.filter(a => a.id !== blockId);
    setItinerary(newItin);
  };

  const removeDay = (dIdx: number) => {
    const newItin = itinerary
      .filter((_, i) => i !== dIdx)
      .map((d, i) => ({ ...d, dayNumber: i + 1 }));
    setItinerary(newItin);
  };

  // Load AI suggestions for a day
  const loadSuggestions = async (dayIdx: number) => {
    setShowSuggest(dayIdx);
    if (!suggestDest.trim()) return;
    setLoadingSuggest(true);
    try {
      const info = await getDestinationInfo(suggestDest);
      const flat: Suggestion[] = [
        ...info.attractions.map(a => ({ text: `${a.name} — ${a.description.slice(0, 60)}…`, location: a.neighborhood })),
        ...info.foods.map(f => ({ text: `Try ${f.name} — ${f.description.slice(0, 50)}…`, location: f.where })),
      ];
      setSuggestions(flat.slice(0, 8));
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggest(false);
    }
  };

  const applySuggestion = (dayIdx: number, sug: Suggestion) => {
    const newItin = [...itinerary];
    newItin[dayIdx].activities.push({
      id:          crypto.randomUUID(),
      type:        'Activity',
      time:        '10:00',
      location:    sug.location,
      description: sug.text,
    });
    setItinerary(newItin);
    setShowSuggest(null);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Flight':   return <Plane    size={18} />;
      case 'Stay':     return <Building2 size={18} />;
      case 'Food':     return <Utensils  size={18} />;
      default:         return <Camera    size={18} />;
    }
  };

  return (
    <div className="home-page fade-in">
      <header className="home-header">
        <ArrowLeft onClick={() => setView('tripplanner')} style={{ cursor: 'pointer', marginRight: '10px' }} />
        Manual Trip Builder
      </header>

      <main className="insurance-container" style={{ paddingBottom: '140px' }}>

        {/* Summary card with editable name */}
        <div className="trip-summary-mini">
          <input
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'white', fontWeight: 700, fontSize: '1.1rem',
              width: '100%', marginBottom: '4px',
            }}
            value={tripName}
            onChange={e => setTripName(e.target.value)}
            placeholder="Name your trip…"
          />
          <p>{itinerary.length} Day{itinerary.length > 1 ? 's' : ''} Planned</p>
        </div>

        {/* AI destination input */}
        <div style={{
          background: '#f3ebff', borderRadius: '14px', padding: '12px 14px',
          marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center',
        }}>
          <Sparkles size={16} color="#7b2cbf" />
          <input
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              flex: 1, fontSize: '0.9rem', color: '#333',
            }}
            placeholder="Enter destination for AI suggestions (e.g. Tokyo)"
            value={suggestDest}
            onChange={e => setSuggestDest(e.target.value)}
          />
        </div>

        {/* Day-by-day */}
        {itinerary.map((day, dIdx) => (
          <section key={dIdx} className="day-block">
            <div className="day-block-header">
              <h2>Day {day.dayNumber}</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {suggestDest && (
                  <button
                    className="ai-suggest-btn"
                    onClick={() => showSuggest === dIdx ? setShowSuggest(null) : loadSuggestions(dIdx)}
                  >
                    <Sparkles size={12} /> AI Suggest
                    <ChevronDown size={12} style={{ transform: showSuggest === dIdx ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                  </button>
                )}
                {itinerary.length > 1 && (
                  <Trash2
                    size={18}
                    color="#ff4d4d"
                    style={{ cursor: 'pointer' }}
                    onClick={() => removeDay(dIdx)}
                  />
                )}
              </div>
            </div>

            {/* AI Suggestions panel */}
            {showSuggest === dIdx && (
              <div style={{
                background: '#faf7ff', borderRadius: '12px', padding: '12px',
                marginBottom: '10px', border: '1px solid rgba(123,44,191,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7b2cbf' }}>
                    {loadingSuggest ? 'Loading suggestions…' : `AI Suggestions for ${suggestDest}`}
                  </span>
                  <X size={14} color="#888" style={{ cursor: 'pointer' }} onClick={() => setShowSuggest(null)} />
                </div>
                {!loadingSuggest && (
                  <div className="suggestions-grid">
                    {suggestions.map((sug, i) => (
                      <button
                        key={i}
                        className="suggestion-pill"
                        onClick={() => applySuggestion(dIdx, sug)}
                      >
                        <span style={{ fontWeight: 600 }}>+ </span>{sug.text}
                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>📍 {sug.location}</div>
                      </button>
                    ))}
                    {suggestions.length === 0 && (
                      <span style={{ fontSize: '0.82rem', color: '#aaa' }}>
                        No suggestions — try entering a supported destination above.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Activity blocks */}
            <div className="activity-list">
              {day.activities.map((act) => (
                <div key={act.id} className="plan-card">
                  <div className="plan-card-sidebar" data-type={act.type}>
                    {getIcon(act.type)}
                  </div>
                  <div className="plan-card-content">
                    <div className="plan-input-group">
                      <Clock size={14} />
                      <input
                        type="time"
                        className="plan-time-input"
                        value={act.time}
                        onChange={e => updateBlock(dIdx, act.id, 'time', e.target.value)}
                      />
                      <Trash2
                        size={14}
                        className="delete-item"
                        onClick={() => removeBlock(dIdx, act.id)}
                      />
                    </div>
                    <input
                      className="plan-desc-input"
                      placeholder={act.type === 'Stay' ? 'Hotel / Stay Name' : 'Activity Description'}
                      value={act.description}
                      onChange={e => updateBlock(dIdx, act.id, 'description', e.target.value)}
                    />
                    <div className="plan-input-group">
                      <MapPin size={14} />
                      <input
                        className="plan-loc-input"
                        placeholder="Location / Address"
                        value={act.location}
                        onChange={e => updateBlock(dIdx, act.id, 'location', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Block picker */}
            <div className="block-picker">
              <button onClick={() => addBlock(dIdx, 'Flight')}><Plane size={14} /> Flight</button>
              <button onClick={() => addBlock(dIdx, 'Stay')}><Building2 size={14} /> Stay</button>
              <button onClick={() => addBlock(dIdx, 'Food')}><Utensils size={14} /> Food</button>
              <button onClick={() => addBlock(dIdx, 'Activity')}><Camera size={14} /> Event</button>
            </div>
          </section>
        ))}

        <button className="add-day-btn-large" onClick={addDay}>
          <Plus size={20} /> Add Next Day
        </button>
      </main>

      {/* Bottom action area */}
      <div className="floating-save-area">
        <button
          className="confirm-btn-purple"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          onClick={() => exportManualPDF(itinerary, tripName)}
        >
          <Download size={18} /> Save & Export PDF
        </button>
      </div>

    </div>
  );
};
