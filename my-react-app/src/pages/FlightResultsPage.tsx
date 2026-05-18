import React from 'react';
import { ArrowLeft, Plane, ShieldCheck, ChevronRight, Clock } from 'lucide-react';
import '../styles/FlightsPage.css';

const getFlightSelectionKey = (flight: Record<string, unknown> | undefined) =>
  flight ? `${flight.flightNumber}-${flight.timeDepart}-${flight.timeLanding}` : '';

interface FlightResultsPageProps {
  flights: { title: string; data: Record<string, unknown>[] }[];
  meta: { origin: string; destination: string; date: string; returnDate?: string; tripType: string; pax: number; class: string };
  onBack: () => void;
  onBook: (flight: Record<string, unknown>, legIdx: number) => void;
  selectedFlights?: Record<number, Record<string, unknown>>;
  canConfirm?: boolean;
  onConfirmBooking: () => void;
}

export const FlightResultsPage: React.FC<FlightResultsPageProps> = ({
  flights,
  meta,
  onBack,
  onBook,
  selectedFlights = {},
  canConfirm = false,
  onConfirmBooking,
}) => {
  return (
    <div className="zen-results-wrapper fade-in">
      <header className="zen-results-hero-flight">
        <button className="glass-back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="hero-content">
          <h2 className="hero-route">
            {meta.origin} to {meta.destination}
          </h2>
          <div className="hero-meta-pills">
            <span className="meta-pill">{meta.date}</span>
            {meta.tripType === 'Return' && meta.returnDate && (
              <span className="meta-pill">Return {meta.returnDate}</span>
            )}
            <span className="meta-pill">
              {meta.pax} Pax • {meta.class}
            </span>
          </div>
        </div>
      </header>

      <main className="results-list-premium">
        {flights.map((leg, legIdx: number) => (
          <div key={legIdx} className="leg-section">
            <h3 className="leg-title">{leg.title}</h3>

            {leg.data.map((f, i: number) => (
              <div key={i} className="premium-flight-card fade-in">
                <div className="flight-card-header">
                  <div className="airline-brand">
                    <div className="airline-logo-box">{f.airline[0]}</div>
                    <div className="airline-meta">
                      <h4>{f.airline}</h4>
                      <span>
                        {f.flightNumber} • {f.cabin}
                      </span>
                    </div>
                  </div>
                  <div className="price-tag">
                    <span className="cur">MYR</span> {f.priceMYR}
                  </div>
                </div>

                <div className="flight-timeline-path">
                  <div className="time-node">
                    <strong>{f.timeDepart}</strong>
                    <span className="iata">{f.from}</span>
                  </div>
                  <div className="path-visual">
                    <span className="duration-text">
                      <Clock size={10} /> {f.duration}
                    </span>
                    <div className="line"></div>
                    <Plane size={16} className="plane-anim" />
                  </div>
                  <div className="time-node">
                    <strong>{f.timeLanding}</strong>
                    <span className="iata">{f.to}</span>
                  </div>
                </div>

                <div className="flight-card-footer">
                  <span className="verified-badge">
                    <ShieldCheck size={12} /> Best price match
                  </span>
                  {(() => {
                    const isSelected =
                      getFlightSelectionKey(selectedFlights[legIdx]) === getFlightSelectionKey(f);

                    return (
                  <button
                    className={`select-flight-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => onBook(f, legIdx)}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                    <ChevronRight size={16} />
                  </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        ))}
      </main>

      {meta.tripType === 'Return' && (
        <div className="flight-selection-summary">
          <div className="selection-copy">
            <strong>Complete your round trip</strong>
            <span>
              {canConfirm
                ? 'Both tickets are selected and ready to book.'
                : 'Choose one outbound and one return ticket before continuing.'}
            </span>
          </div>
          <button
            className="confirm-flight-selection-btn"
            onClick={onConfirmBooking}
            disabled={!canConfirm}
          >
            Confirm Return Booking
          </button>
        </div>
      )}
    </div>
  );
};
