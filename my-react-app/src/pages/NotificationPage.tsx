import React, { useEffect, useState } from 'react';
import { db, auth } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Sparkles, ChevronRight, X, Loader2, CheckCircle, Building2, Car, Plane } from 'lucide-react';
import { searchHotels, searchTransport, searchFlights } from '../services/mockTravelAPI';
import mascotImg from '../assets/MASCOT.png'; 
import '../App.css';
import '../styles/NotificationPage.css';

interface NotificationPageProps {
  setView: (v: string, id?: string) => void;
  globalCurrency: { name: string; code: string };
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'cancelled' | 'success';
  hotelName?: string;
  location?: string;
  bookingType?: string;
}

export const NotificationPage: React.FC<NotificationPageProps> = ({ setView, globalCurrency }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisTarget, setAnalysisTarget] = useState<AppNotification | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, unknown>[]>([]);

  const symbol = globalCurrency.code.split(' | ')[0];

  const formatDate = (dateValue: string | number | Date) => {
    if (!dateValue) return 'Recently';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return String(dateValue); 
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "Booking"), where("userId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const item = doc.data();
        let displayName = '';
        let dynamicTitle = '';

        if (item.type === 'flight') {
          displayName = item.airline || 'Your Flight'; 
          dynamicTitle = 'Flight Cancelled';
        } else if (item.type === 'hotel') {
          displayName = item.name || 'Your Hotel';    
          dynamicTitle = 'Hotel Cancelled';
        } else if (item.type === 'transport') {
          displayName = item.name || 'Your Transport'; 
          dynamicTitle = 'Transport Cancelled';
        } else {
          displayName = item.name || item.hotelName || 'Your Booking';
          dynamicTitle = 'Booking Cancelled';
        }

        if (item.status === 'cancelled') {
          return { id: doc.id, title: dynamicTitle, message: `Your reservation for ${displayName} has been cancelled.`, date: formatDate(item.date), type: 'cancelled', hotelName: displayName, location: item.location || '', bookingType: item.type };
        } else if (item.status === 'confirmed' || item.status === 'upcoming') {
          return { id: doc.id, title: 'Booking Successful', message: `Your trip to ${displayName} is confirmed!`, date: formatDate(item.date), type: 'success' };
        }
        return null;
      }).filter(Boolean);
      setNotifications(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const startAIAnalysis = async (notif: AppNotification) => {
    setAnalysisTarget(notif);
    setIsAnalyzing(true);
    
    let results: Record<string, unknown>[] = [];
    const location = notif.location || "Bali";
    const cancelledName = notif.hotelName; // 这是要排除的名字

    if (notif.bookingType === 'transport') {
      results = await searchTransport(location, cancelledName);
    } else if (notif.bookingType === 'flight') {
      results = await searchFlights("KUL", location, cancelledName);
    } else {
      results = await searchHotels(location, cancelledName);
    }
    
    setAiSuggestions(results.slice(0, 2));
    setTimeout(() => setIsAnalyzing(false), 2500);
  };

  return (
    <div className="notification-page fade-in">
      <header className="notification-header">Notifications</header>
      <main className="notification-content">
        {loading ? (
          <div className="loading-state-centered"><p>Scanning updates...</p></div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty-container">
            <img src={mascotImg} alt="Mascot" className="notif-mascot-img" />
            <p className="notif-empty-text">No notifications yet!</p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((n) => (
              <div key={n.id} className={`notification-card border-${n.type}`}>
                <div className="notification-header-row">
                  <h3 className="notification-title">{n.title}</h3>
                  <span className="notification-date">{n.date}</span>
                </div>
                <p className="notification-message">{n.message}</p>
                {n.type === 'cancelled' && (
                  <div className="ai-notice-box" onClick={() => startAIAnalysis(n)}>
                    <div className="ai-notice-left">
                      <Sparkles size={16} color="#7b2cbf" />
                      <span>Analyze Alternatives with Zen AI</span>
                    </div>
                    <ChevronRight size={16} color="#7b2cbf" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {analysisTarget && (
        <div className="analysis-modal-overlay" onClick={() => setAnalysisTarget(null)}>
          <div className="analysis-card fade-in-up" onClick={(e) => e.stopPropagation()}>
            <button className="close-analysis" onClick={() => setAnalysisTarget(null)}><X size={20} /></button>
            <div className="analysis-header">
              <Sparkles size={24} color="#7b2cbf" />
              <h2>Zen AI Analysis</h2>
            </div>

            {isAnalyzing ? (
              <div className="analyzing-state">
                <Loader2 className="tp-spin" size={40} color="#7b2cbf" />
                <p>Analyzing alternatives for <strong>{analysisTarget.hotelName}</strong> in {analysisTarget.location}...</p>
                <div className="loading-bar"><div className="loading-progress"></div></div>
              </div>
            ) : (
              <div className="analysis-results">
                <div className="ai-brief">
                  <CheckCircle size={16} color="#28C76F" />
                  <p>I've analyzed available {analysisTarget.bookingType} options in {analysisTarget.location}. Here are the best matches for your trip.</p>
                </div>

                <div className="alt-hotels-list">
                  {aiSuggestions.length > 0 ? aiSuggestions.map((item, idx) => (
                    <div key={idx} className="alt-hotel-item" onClick={() => setView(analysisTarget.bookingType === 'transport' ? 'carrental' : analysisTarget.bookingType === 'flight' ? 'flights' : 'hotels')}>
                      {analysisTarget.bookingType === 'transport' ? <Car size={24} color="#7b2cbf" /> : analysisTarget.bookingType === 'flight' ? <Plane size={24} color="#7b2cbf" /> : <Building2 size={24} color="#7b2cbf" />}
                      <div className="alt-info">
                        <h4>{item.name || item.airline}</h4>
                        <p>{item.type || item.stars + ' ★'} · {item.note || item.distance}</p>
                        <span className="alt-price">{symbol} {item.priceMYR}</span>
                      </div>
                      <ChevronRight size={18} color="#ccc" />
                    </div>
                  )) : (
                    <p style={{textAlign:'center', color:'#999', fontSize:'0.9rem'}}>No other alternatives found in this location.</p>
                  )}
                </div>

                <button className="chat-ai-btn" onClick={() => setView('chatbot')}>
                  Chat with Zen AI for more details
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
