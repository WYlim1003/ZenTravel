import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import '../styles/RefundPage.css';

interface RefundPageProps {
  bookingId: string;
  setView: (view: string, id?: string) => void;
}

export const RefundPage = ({ bookingId, setView }: RefundPageProps) => {
  const [item, setItem] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  const refundReasons = [
    "Change of travel plans",
    "Found a better price elsewhere",
    "Booked the wrong date/time",
    "Personal medical reasons"
  ];

  const formatDisplayDate = (val: string | number | { seconds: number }) => {
    if (!val) return "No Date";
    if (typeof val === 'object' && 'seconds' in val) {
      return new Date(val.seconds * 1000).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    return String(val);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!bookingId) return;
      try {
        const docRef = doc(db, "Booking", bookingId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setItem({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Firebase fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [bookingId]);

  const handleConfirmRefund = async () => {
    if (!reason) {
      alert("Please select a reason for your refund.");
      return;
    }

    const confirmAction = window.confirm("Are you sure you want to request a refund?");
    if (!confirmAction) return;

    try {
      await updateDoc(doc(db, "Booking", bookingId), {
        status: 'cancelled',
        refundReason: reason,
        refundRequestedAt: new Date().toISOString()
      });
      alert("Refund request submitted successfully!");
      setView('booking');
    } catch (e) {
      console.error("Update error:", e);
      alert("Failed to submit refund. Please try again.");
    }
  };

  if (loading) return <div className="rf-white-bg"><p style={{padding: '20px'}}>Loading booking details...</p></div>;
  if (!item) return <div className="rf-white-bg"><p style={{padding: '20px'}}>Error: Booking not found.</p></div>;

  return (
    <div className="rf-white-bg">
      <header className="rf-purple-header">
        <ArrowLeft className="rf-clickable" color="white" onClick={() => setView('booking')} />
        <h1>ZenTravel</h1>
        <MessageSquare color="white" />
      </header>

      <main className="rf-main-content">
        <div className="rf-ticket-box">
          <div className="rf-top-bar">
            <span>{formatDisplayDate(item.date || item.timeDepart)}</span>
            <span>{item.airline || item.name || item.hotelName}</span>
          </div>

          <div className="rf-card-flex">
            <div className="rf-left-info">
              {item.type === 'flight' || item.type === 'ticket' ? (
                <div className="rf-path-ui">
                  <span className="rf-city-name">{item.from || "N/A"}</span>
                  <div className="rf-purple-line"></div>
                  <span className="rf-city-name">{item.to || "N/A"}</span>
                </div>
              ) : (
                <div className="rf-simple-info">
                  <p className="rf-item-title">{item.name || item.hotelName}</p>
                  <p className="rf-item-sub">
                    {item.type === 'transport' ? `Plate: ${item.plateNum || 'N/A'}` : (item.details || "Booking Detail")}
                  </p>
                </div>
              )}
            </div>

            <div className="rf-purple-action-card">
              <p className="rf-p-text">{item.bookingNum || item.bookNum || item.id?.slice(0,8)}</p>
              <p className="rf-p-text">{item.passenger || item.userName || "Customer"}</p>
             
              <div className="rf-reason-container">
                <label className="rf-label">Reason</label>
                <select
                  className="rf-select-long"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Choose your reason</option>
                  {refundReasons.map((r, index) => (
                    <option key={index} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <button 
          className="rf-big-red-btn" 
          onClick={handleConfirmRefund}
          style={{ opacity: reason ? 1 : 0.6 }}
        >
          REFUND
        </button>
      </main>
    </div>
  );
};
