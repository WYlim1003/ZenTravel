import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { MessageSquare, ChevronLeft } from 'lucide-react';
import '../styles/ViewTicket.css';

interface ViewTicketProps {
  ticketId: string;
  setView: (view: any) => void;
}

export const ViewTicket = ({ ticketId, setView }: ViewTicketProps) => {
  const [ticket, setTicket] = useState<any>(null);

  useEffect(() => {
    if (!ticketId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'Booking', ticketId),
      (docSnap) => {
        if (docSnap.exists()) {
          setTicket({ id: docSnap.id, ...docSnap.data() });
        }
      },
      (error) => {
        console.error('Error fetching ticket:', error);
      }
    );

    return () => unsubscribe();
  }, [ticketId]);

  const formatTime = (ts: any) => {
    if (!ts) return '--:--';

    if (ts.toDate) {
      const date = ts.toDate();
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    if (typeof ts === 'string') return ts;

    return '--:--';
  };

  if (!ticket) {
    return (
      <div className="vt-container">
        <div className="loading" style={{ padding: '20px', textAlign: 'center' }}>
          Loading ticket details...
        </div>
      </div>
    );
  }

  const isTransport = ticket.type === 'transport';

  return (
    <div className="vt-container">
      <header className="vt-header">
        <div className="vt-header-left">
          <ChevronLeft className="vt-back" onClick={() => setView('booking')} />
          <h1>ZenTravel</h1>
        </div>
        <MessageSquare color="white" />
      </header>

      <main className="vt-content">
        <h2 className="vt-title">{isTransport ? 'My Transport' : 'My Ticket'}</h2>

        <div className="vt-route-summary">
          <span>{isTransport ? (ticket.name || 'Transport') : (ticket.from || 'N/A')}</span>
          <span className="vt-plane-icon">{isTransport ? 'CAR' : 'FLIGHT'}</span>
          <span>{isTransport ? (ticket.plateNum || 'Assigned vehicle') : (ticket.to || 'N/A')}</span>
        </div>

        <div className="vt-info-header">
          <p>Booking Number: {ticket.bookNum || ticket.bookingNum || ticket.id?.slice(0, 8)}</p>
          <p>Passenger Name: {ticket.passenger || ticket.name || ticket.userName || 'Customer'}</p>
          {isTransport && (
            <>
              <p>Driver Name: {ticket.driverName || 'Assigned after confirmation'}</p>
              <p>Driver Phone: {ticket.driverPhone || 'Provided before pick-up'}</p>
            </>
          )}
        </div>

        {isTransport && (
          <div className="vt-transport-route">
            <div className="vt-transport-route-item">
              <label>Pick-up Point</label>
              <span>{ticket.pickupPoint || 'Shared before trip'}</span>
            </div>
            <div className="vt-transport-route-item">
              <label>Destination</label>
              <span>{ticket.destination || 'Shared before trip'}</span>
            </div>
            <div className="vt-transport-route-item">
              <label>Distance</label>
              <span>{ticket.distance || 'Route estimate pending'}</span>
            </div>
          </div>
        )}

        <div className="vt-card">
          <div className="vt-card-row">
            <div className="vt-loc">
              <span className="vt-city-code">{isTransport ? (ticket.name || 'CAR') : (ticket.from || '---')}</span>
              <span className="vt-time-display">
                {isTransport ? (ticket.date || 'Scheduled') : formatTime(ticket.timeDepart)}
              </span>
            </div>

            <div className="vt-divider">
              <span className="vt-plane-mini">{isTransport ? 'CAR' : 'FLIGHT'}</span>
            </div>

            <div className="vt-loc vt-right">
              <span className="vt-city-code">{isTransport ? (ticket.plateNum || '---') : (ticket.to || '---')}</span>
              <span className="vt-time-display">
                {isTransport ? `RM ${ticket.price ?? '--'}` : formatTime(ticket.timeLanding)}
              </span>
            </div>
          </div>

          <div className="vt-card-details">
            <div className="vt-detail-item vt-align-left">
              <label>{isTransport ? 'Transport' : 'Flight no.'}</label>
              <span>{isTransport ? (ticket.carType || ticket.name || 'Assigned') : (ticket.flightNum || ticket.flightNo || 'TBA')}</span>
            </div>
            <div className="vt-detail-item vt-align-center">
              <label>{isTransport ? 'Scheduled' : 'Departing'}</label>
              <span>{ticket.date || 'TBA'}</span>
            </div>
            <div className="vt-detail-item vt-align-right">
              <label>Status</label>
              <span className="vt-status-on" style={{ color: ticket.status === 'cancelled' ? '#ff3b30' : '#4cd964' }}>
                {ticket.status === 'upcoming' ? 'On time' : (ticket.status || 'Confirmed')}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
