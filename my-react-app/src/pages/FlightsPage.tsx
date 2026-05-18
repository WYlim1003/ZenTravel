import React, { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Users, PlaneTakeoff, PlaneLanding, ArrowUpDown, X, Plus, Minus, PlusCircle, Loader2, Check } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { BottomNav } from '../components/BottomNav';
import { db, auth } from '../services/firebase'; 
import { collection, addDoc } from 'firebase/firestore';
import { FlightResultsPage } from './FlightResultsPage';
import { searchFlights, toIATA } from '../services/mockTravelAPI'; 
import "../styles/FlightsPage.css";

const recommendations = [
  { id: 1, name: "Bali", pos: { lat: -8.4095, lng: 115.1889 } },
  { id: 2, name: "Tokyo", pos: { lat: 35.6762, lng: 139.6503 } },
  { id: 3, name: "Phuket", pos: { lat: 7.8804, lng: 98.3923 } }
];

const FLIGHT_CLASSES = ["Economy", "Economy/premium economy", "Premium Economy", "Business/First", "Business", "First"];

// 🚀 Updated Interface to include AI pendingSearch
interface FlightProps {
  setView: (v: string) => void;
  pendingSearch?: { origin: string; destination: string } | null;
  clearSearch?: () => void;
}

const getFlightSelectionKey = (flight: Record<string, unknown> | undefined) =>
  flight ? `${flight.flightNumber}-${flight.timeDepart}-${flight.timeLanding}` : '';

export const FlightsPage: React.FC<FlightProps> = ({ setView, pendingSearch, clearSearch }) => {
  const [tripType, setTripType] = useState('Return');
  const [viewMode, setViewMode] = useState<'search' | 'results'>('search');
  const [loading, setLoading] = useState(false);
  const [sourcedFlights, setSourcedFlights] = useState<{ title: string; data: Record<string, unknown>[] }[]>([]);
  const [selectedFlights, setSelectedFlights] = useState<Record<number, Record<string, unknown>>>({});

  const [flights, setFlights] = useState([{ origin: "Kuala Lumpur", destination: "Bali", date: "2026-04-28" }]);
  const [returnDate, setReturnDate] = useState("2026-05-01");
  const [passengers, setPassengers] = useState({ adult: 1, child: 0, baby: 0 });
  const [flightClass, setFlightClass] = useState("Economy");

  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [activeDateIndex, setActiveDateIndex] = useState(0);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  // 🤖 AI INTELLIGENT AUTO-SEARCH LOGIC
  useEffect(() => {
    if (pendingSearch) {
      const runAutoSearch = async () => {
        // 1. Instantly fill the UI fields
        setFlights([{ 
            origin: pendingSearch.origin, 
            destination: pendingSearch.destination, 
            date: "2026-04-28" 
        }]);
        
        setLoading(true);
        try {
          const allLegsResults = [];
          
          // 2. Auto-fetch the correct mock data based on AI inquiry
          const leg1 = await searchFlights(pendingSearch.origin, pendingSearch.destination, flightClass);
          allLegsResults.push({ 
            title: `Outbound: ${pendingSearch.origin} to ${pendingSearch.destination}`, 
            data: leg1 
          });

          // 3. If trip type is return, fetch the back leg automatically too
          if (tripType === 'Return') {
            const inbound = await searchFlights(pendingSearch.destination, pendingSearch.origin, flightClass);
            allLegsResults.push({ 
                title: `Inbound: ${pendingSearch.destination} to ${pendingSearch.origin}`, 
                data: inbound 
            });
          }

          setSourcedFlights(allLegsResults);
          setViewMode('results'); // 4. Switch to results page immediately
          
          // 5. Clean up the AI handoff
          if (clearSearch) clearSearch();
        } catch (err) {
          console.error("AI Auto-search error:", err);
        } finally {
          setLoading(false);
        }
      };

      runAutoSearch();
    }
  }, [pendingSearch, clearSearch, flightClass, tripType]); // Only runs when AI provides new data

  const handleSearch = async () => {
    if (!flights[0].origin || !flights[0].destination) return alert("Please enter cities!");
    setLoading(true);
    setSelectedFlights({});
    try {
      const allLegsResults = [];
      const leg1 = await searchFlights(flights[0].origin, flights[0].destination, flightClass);
      allLegsResults.push({ title: `Outbound: ${flights[0].origin} to ${flights[0].destination}`, data: leg1 });

      if (tripType === 'Return') {
        const inbound = await searchFlights(flights[0].destination, flights[0].origin, flightClass);
        allLegsResults.push({ title: `Inbound: ${flights[0].destination} to ${flights[0].origin}`, data: inbound });
      }

      if (tripType === 'Multi-city') {
        for (let i = 1; i < flights.length; i++) {
          if (flights[i].origin && flights[i].destination) {
            const multiLeg = await searchFlights(flights[i].origin, flights[i].destination, flightClass);
            allLegsResults.push({ title: `Flight ${i + 1}: ${flights[i].origin} to ${flights[i].destination}`, data: multiLeg });
          }
        }
      }

      setSourcedFlights(allLegsResults);
      setViewMode('results');
    } catch {
      alert("Error fetching flights.");
    } finally {
      setLoading(false);
    }
  };

  const handleExchange = (index: number) => {
    const newFlights = [...flights];
    const temp = newFlights[index].origin;
    newFlights[index].origin = newFlights[index].destination;
    newFlights[index].destination = temp;
    setFlights(newFlights);
  };

  const saveFlightBooking = async (f: Record<string, unknown>, legIndex: number) => {
    const user = auth.currentUser;
    if (!user) return alert("Please log in!");

    const totalPax = passengers.adult + passengers.child + passengers.baby;
    const passengerName =
      user.displayName?.trim() ||
      user.email?.split('@')[0]?.toUpperCase() ||
      'Guest';
    const isReturnInbound = tripType === 'Return' && legIndex === 1;
    const travelDate = isReturnInbound ? returnDate : flights[0].date;
    const route = isReturnInbound
      ? { from: flights[0].destination, to: flights[0].origin }
      : { from: flights[0].origin, to: flights[0].destination };

    const bookingData = {
      airline: f.airline,
      bookingNum: `AR${Math.floor(1000 + Math.random() * 9000)}`,
      cashbackClaimed: true,
      date: travelDate,
      flightNum: f.flightNumber,
      from: toIATA(route.from),
      to: toIATA(route.to),
      hasNotification: true,
      name: passengerName,
      pax: String(totalPax),
      price: f.priceMYR,
      status: 'upcoming',
      type: 'flight',
      timeDepart: f.timeDepart,
      timeLanding: f.timeLanding,
      userId: user.uid
    };

    await addDoc(collection(db, "Booking"), bookingData);
  };

  const handleBooking = async (f: Record<string, unknown>, legIndex: number) => {
    if (tripType === 'Return') {
      setSelectedFlights((current) => {
        if (getFlightSelectionKey(current[legIndex]) === getFlightSelectionKey(f)) {
          const next = { ...current };
          delete next[legIndex];
          return next;
        }

        return { ...current, [legIndex]: f };
      });
      return;
    }

    try {
      await saveFlightBooking(f, legIndex);
      alert("Flight Booked!");
      setView('booking');
    } catch {
      alert("Save failed");
    }
  };

  const handleConfirmReturnBooking = async () => {
    if (!selectedFlights[0] || !selectedFlights[1]) {
      alert('Please select both outbound and return flights.');
      return;
    }

    try {
      await saveFlightBooking(selectedFlights[0], 0);
      await saveFlightBooking(selectedFlights[1], 1);
      alert('Return flights booked!');
      setView('booking');
    } catch {
      alert('Save failed');
    }
  };

  const addFlightRow = () => {
    if (flights.length < 4) {
      setFlights([...flights, { origin: "", destination: "", date: "" }]);
    }
  };

  if (viewMode === 'results') {
    return (
      <FlightResultsPage
        flights={sourcedFlights}
        meta={{
          origin: flights[0].origin,
          destination: flights[0].destination,
          date: flights[0].date,
          returnDate,
          pax: passengers.adult + passengers.child + passengers.baby,
          class: flightClass,
          tripType
        }}
        onBack={() => setViewMode('search')}
        onBook={handleBooking}
        selectedFlights={selectedFlights}
        canConfirm={tripType !== 'Return' || Boolean(selectedFlights[0] && selectedFlights[1])}
        onConfirmBooking={handleConfirmReturnBooking}
      />
    );
  }

  return (
    <div className="home-page fade-in">
      <header className="home-header">
        <ArrowLeft onClick={() => setView('home')} style={{ cursor: 'pointer' }} /> 
        ZenTravel
      </header>

      <main className="flights-container">
        <h2 className="section-title">Flights</h2>
        
        <div className="flight-search-card">
          <div className="trip-type-row">
            {['One-way', 'Return', 'Multi-city'].map(t => (
              <button key={t} className={`type-btn ${tripType === t ? 'active' : ''}`} onClick={() => setTripType(t)}>{t}</button>
            ))}
          </div>

          {(tripType === 'Multi-city' ? flights : [flights[0]]).map((f, i) => (
            <div key={i} className="flight-block">
              {tripType === 'Multi-city' && <div className="flight-block-title">Flight {i + 1}</div>}
              
              <div className="flight-row">
                <PlaneTakeoff size={18} color="#7b2cbf" />
                <input 
                  value={f.origin} 
                  placeholder="Enter departure city" 
                  onChange={(e) => { const n = [...flights]; n[i].origin = e.target.value; setFlights(n); }} 
                />
                {tripType !== 'Multi-city' && i === 0 && (
                  <div className="exchange-icon" onClick={() => handleExchange(i)}>
                    <ArrowUpDown size={16} color="#7b2cbf" />
                  </div>
                )}
              </div>

              <div className="flight-row">
                <PlaneLanding size={18} color="#7b2cbf" />
                <input 
                  value={f.destination} 
                  placeholder="Enter arrival city" 
                  onChange={(e) => { const n = [...flights]; n[i].destination = e.target.value; setFlights(n); }} 
                />
              </div>

              <div className="flight-row clickable" onClick={() => { setActiveDateIndex(i); setShowDateModal(true); }}>
                <Calendar size={18} color="#7b2cbf" />
                <span className="row-text-align">
                  {tripType === 'Return' && i === 0 
                    ? `${f.date} - ${returnDate}` 
                    : (f.date || "Select Date")}
                </span>
              </div>
            </div>
          ))}

          {tripType === 'Multi-city' && (
            <button className="add-flight-btn" onClick={addFlightRow}>
              <PlusCircle size={18} /> Add another flight
            </button>
          )}

          <div className="flight-row clickable" onClick={() => setShowPassengerModal(true)}>
            <Users size={18} color="#7b2cbf" />
            <span className="row-text-align">
                {passengers.adult} Adult, {passengers.child} Child | 
                <span className="class-trigger" onClick={(e) => { e.stopPropagation(); setShowClassModal(true); }}> {flightClass}</span>
            </span>
          </div>

          <button className="btn-primary-search-luxe" onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Search Flights"}
          </button>
        </div>

        <h3 className="section-title">Travel Inspiration</h3>
        <div className="map-container">
            {isLoaded ? (
              <GoogleMap 
                mapContainerStyle={{width:'100%', height:'100%'}} 
                center={{lat:15, lng:110}} 
                zoom={3} 
                options={{disableDefaultUI:true}}
              >
                {recommendations.map(p => <Marker key={p.id} position={p.pos} label={{text: p.name, color: '#4b0082', fontWeight: 'bold'}}/>)}
              </GoogleMap>
            ) : <div className="map-placeholder">Loading Map...</div>}
        </div>
      </main>

      {/* Modals for Date, Passenger, and Class remain preserved below */}
      {showDateModal && (
        <div className="modal-overlay" onClick={() => setShowDateModal(false)}>
          <div className="modal-card date-picker-modal" onClick={e => e.stopPropagation()}>
            <X className="close-icon" onClick={() => setShowDateModal(false)} />
            <h3 className="modal-title-purple">Select Dates</h3>
            <div className="date-input-section">
              <label className="date-label">Departure</label>
              <div className="custom-date-box">
                <input type="date" value={flights[activeDateIndex]?.date} onChange={(e) => { const n = [...flights]; n[activeDateIndex].date = e.target.value; setFlights(n); }} />
              </div>
              {tripType === 'Return' && activeDateIndex === 0 && (
                <>
                  <label className="date-label" style={{marginTop: '15px'}}>Return</label>
                  <div className="custom-date-box">
                    <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <button className="confirm-btn-purple-luxe" onClick={() => setShowDateModal(false)}>Confirm</button>
          </div>
        </div>
      )}

      {showPassengerModal && (
        <div className="modal-overlay" onClick={() => setShowPassengerModal(false)}>
          <div className="modal-card pretty-guest-modal" onClick={e => e.stopPropagation()}>
            <X className="close-icon" onClick={() => setShowPassengerModal(false)} />
            <h3 className="modal-title-purple">Passengers</h3>
            {Object.entries(passengers).map(([type, count]) => (
              <div key={type} className="luxe-counter-row">
                <div className="counter-info">
                  <span className="type-name">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                  <span className="type-desc">{type === 'adult' ? 'Age 12+' : type === 'child' ? 'Age 2-11' : 'Under 2'}</span>
                </div>
                <div className="counter-actions">
                  <button className="cnt-btn" onClick={() => setPassengers({...passengers, [type]: Math.max(0, count - 1)})}><Minus size={16}/></button>
                  <span className="cnt-number">{count}</span>
                  <button className="cnt-btn" onClick={() => setPassengers({...passengers, [type]: count + 1})}><Plus size={16}/></button>
                </div>
              </div>
            ))}
            <button className="confirm-btn-purple-luxe" onClick={() => setShowPassengerModal(false)}>Apply Selection</button>
          </div>
        </div>
      )}

      {showClassModal && (
        <div className="modal-overlay" onClick={() => setShowClassModal(false)}>
          <div className="modal-card luxe-glass-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-simple">Select Class</div>
            {FLIGHT_CLASSES.map(c => (
              <div key={c} className={`luxe-class-option ${flightClass === c ? 'active' : ''}`} onClick={() => { setFlightClass(c); setShowClassModal(false); }}>
                {c} {flightClass === c && <Check size={18} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <BottomNav setView={setView} currentView="home" />
    </div>
  );
};
