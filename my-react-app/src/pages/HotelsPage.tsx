import React, { useState, useEffect } from 'react';
import { Search, Calendar, User, ArrowLeft, X, Plus, Minus, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { db, auth } from '../services/firebase'; 
import { collection, addDoc } from 'firebase/firestore';
import { HotelResultsPage } from './HotelResultsPage';
import { searchHotels, toIATA } from '../services/mockTravelAPI'; 
import "../styles/HotelsPage.css";

interface HotelProps {
  setView: (v: string) => void;
  pendingSearch?: { origin: string; destination: string } | null;
  clearSearch?: () => void;
}

export const HotelsPage: React.FC<HotelProps> = ({ setView, pendingSearch, clearSearch }) => {
  const [viewMode, setViewMode] = useState<'search' | 'results'>('search');
  const [loading, setLoading] = useState(false);
  const [hotels, setHotels] = useState<any[]>([]);

  // --- Search Form States ---
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("2026-04-25");
  const [endDate, setEndDate] = useState("2026-04-26");
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const [showDateModal, setShowDateModal] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);

  const calculateNights = () => {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // 🤖 AI INTELLIGENT FILL LOGIC (只填充，不自动搜索)
  useEffect(() => {
    if (pendingSearch) {
      const targetCity = pendingSearch.destination || pendingSearch.origin;
      if (targetCity) {
        setDestination(targetCity); // 填充地名
        // 填充完后立刻清理 pendingSearch，这样下次进入页面就不会再重复填充旧数据
        if (clearSearch) clearSearch(); 
      }
    }
  }, [pendingSearch, clearSearch]);

  const handleSearch = async () => {
    if (!destination) return alert("Please enter a destination!");
    setLoading(true);
    
    try {
      const mockResults = await searchHotels(destination);
      const formattedResults = mockResults.map(h => ({
        name: h.name,
        location: h.distance,
        price: `MYR ${h.priceMYR}`,
        rating: h.stars.toFixed(1),
        description: `Verified stay near ${toIATA(destination)} airport. ${h.amenity}`,
        amenities: [h.amenity, "High-speed WiFi", "24/7 Concierge"],
        image_keyword: h.recommended ? "luxury-hotel" : "modern-hotel",
        isRecommended: h.recommended
      }));

      setHotels(formattedResults);
      setViewMode('results');
    } catch (err) {
      alert("Error retrieving mock hotel data.");
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (hotel: any) => {
    const user = auth.currentUser;
    if (!user) return alert("Please log in to book!");

    try {
      const bookingData = {
        bookingNum: `GK${Math.floor(1000 + Math.random() * 9000)}`,
        cashbackClaimed: false,
        date: startDate,
        details: `${rooms} room, ${calculateNights()} nights`,
        hasNotification: true,
        hasReviewed: false,
        imageUrl: `https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&sig=${hotel.image_keyword}`,
        name: hotel.name,
        passenger: "wanyee",
        price: hotel.price,
        status: "upcoming",
        type: "hotel",
        userId: user.uid 
      };
      await addDoc(collection(db, "Booking"), bookingData);
      alert(`Success! Booked ${hotel.name}.`);
      setView('booking');
    } catch (err) {
      alert("Firebase save failed.");
    }
  };

  if (viewMode === 'results') {
    return (
      <HotelResultsPage 
        hotels={hotels} 
        destination={destination}
        searchMeta={{ startDate, endDate, guests: adults + children, nights: calculateNights() }}
        onBack={() => setViewMode('search')}
        onBook={handleBooking}
      />
    );
  }

  return (
    <div className="home-page fade-in">
      <header className="home-header">
        <ArrowLeft onClick={() => setView('home')} style={{ cursor: 'pointer', marginRight: '10px' }} />
        ZenTravel
      </header>

      <main className="hotels-container">
        <h2 className="section-title">Hotels</h2>

        <div className="hotel-search-card">
          <div className="search-row">
            <Search size={18} color="#7b2cbf" />
            <input 
              type="text" 
              placeholder="Enter destination (e.g. London, Tokyo)" 
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          <div className="search-row clickable" onClick={() => setShowDateModal(true)}>
            <Calendar size={18} color="#7b2cbf" />
            <div className="row-text">{startDate} - {endDate}</div>
            <span className="night-count">{calculateNights()} night(s)</span>
          </div>

          <div className="search-row clickable" onClick={() => setShowGuestModal(true)}>
            <User size={18} color="#7b2cbf" />
            <div className="row-text">{rooms} room, {adults + children} guests</div>
          </div>

          <button className="btn-primary-search" onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Search Stays"}
          </button>
        </div>
      </main>

      {showDateModal && (
        <div className="modal-overlay" onClick={() => setShowDateModal(false)}>
          <div className="modal-card guest-modal" onClick={e => e.stopPropagation()}>
            <X className="close-icon" onClick={() => setShowDateModal(false)} />
            <h3>Select Dates</h3>
            <div className="date-input-group">
              <label>Check-in</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <label>Check-out</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <button className="modal-action-btn" onClick={() => setShowDateModal(false)}>Confirm</button>
          </div>
        </div>
      )}

      {showGuestModal && (
        <div className="modal-overlay" onClick={() => setShowGuestModal(false)}>
          <div className="modal-card guest-modal" onClick={e => e.stopPropagation()}>
            <X className="close-icon" onClick={() => setShowGuestModal(false)} />
            <h3>Occupancy</h3>
            {[ {label: 'Rooms', val: rooms, set: setRooms, min: 1}, 
               {label: 'Adults', val: adults, set: setAdults, min: 1}, 
               {label: 'Children', val: children, set: setChildren, min: 0} 
            ].map((item, i) => (
              <div key={i} className="counter-row">
                <span>{item.label}</span>
                <div className="counter-controls">
                  <Minus size={16} onClick={() => item.set(Math.max(item.min, item.val - 1))} />
                  <span>{item.val}</span>
                  <Plus size={16} onClick={() => item.set(item.val + 1)} />
                </div>
              </div>
            ))}
            <button className="modal-action-btn" onClick={() => setShowGuestModal(false)}>Apply</button>
          </div>
        </div>
      )}
      <BottomNav setView={setView} currentView="home" />
    </div>
  );
};