import React, { useState, useEffect } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { db, auth } from '../services/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import '../App.css';
import "../styles/HomePage.css";

// Assets
import carRentalImg from '../assets/CarRental_pic.jpg';
import flightsImg from '../assets/Flights_pic.jpg';
import hotelsImg from '../assets/Hotels_pic.jpg';
import insuranceImg from '../assets/Insurances_pic.png';
import tripPlannerImg from '../assets/TripPlanner_pic.png';

interface HomeProps {
  setView: (v: string) => void;
  setPendingSearch: (data: { origin: string, destination: string } | null) => void;
}

const extractLocationIntelligence = (term: string) => {
  const routePattern = /(?:from\s+)?([\w\s]+)\s+to\s+([\w\s]+)/i;
  const routeMatch = term.match(routePattern);
  if (routeMatch) {
    return { origin: routeMatch[1].trim(), destination: routeMatch[2].trim() };
  }
  const locationPattern = /(?:in|at|near)\s+([\w\s]+)/i;
  const locationMatch = term.match(locationPattern);
  if (locationMatch) {
    return { origin: "", destination: locationMatch[1].trim() };
  }
  return null;
};

export const HomePage: React.FC<HomeProps> = ({ setView, setPendingSearch }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // 🤖 初始状态
  const [aiMessage, setAiMessage] = useState("Analyzing your travel profile...");
  const [targetSearchCity, setTargetSearchCity] = useState("");



  // 🤖 Z-AI 智能地段分析
  const getAiRegionRecommendation = (dest: string) => {
    const d = dest.toUpperCase();
    if (d.includes("DPS") || d.includes("BALI")) return { display: "Ubud or Seminyak", search: "Ubud" };
    if (d.includes("KUL")) return { display: "Bukit Bintang", search: "Bukit Bintang" };
    if (d.includes("SIN")) return { display: "Marina Bay", search: "Marina Bay" };
    if (d.includes("NRT") || d.includes("HND") || d.includes("TOKYO")) return { display: "Shinjuku", search: "Shinjuku" };
    if (d.includes("LHR") || d.includes("LONDON")) return { display: "Westminster", search: "Westminster" };
    return { display: "the city center", search: "" };
  };

  // 🤖 核心逻辑：获取真实机票
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "Booking"),
      where("userId", "==", user.uid),
      where("type", "==", "flight"),
      where("status", "==", "upcoming")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const bookings = snapshot.docs.map(doc => doc.data());
        const lastFlight = bookings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        const dest = lastFlight.to || "your destination";
        const flightNo = lastFlight.flightNum || "";
        const regionData = getAiRegionRecommendation(dest);
        
        setTargetSearchCity(regionData.search);
        setAiMessage(`Your flight to ${dest} (${flightNo}) is confirmed! Z-AI recommends exploring hotels in ${regionData.display} for your upcoming stay.`);
      } else {
        setAiMessage(`Ready for a new adventure? Stay protected with our premium travel insurance.`);
        setTargetSearchCity("");
      }
    }, (error) => {
      console.error("Firebase fetch error:", error);
      setAiMessage("Discover top-rated destinations and local stays with ZenTravel.");
    });

    return () => unsubscribe();
  }, []);

  const fetchHistory = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const q = query(collection(db, "search_history"), where("userId", "==", user.uid), orderBy("timestamp", "desc"), limit(3));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => doc.data().term);
      setHistory([...new Set(docs)]);
    } catch (error) { console.error("History fetch error:", error); }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => { if (user) fetchHistory(); });
    return () => unsubscribe();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term || !auth.currentUser) return;
    setIsAiProcessing(true);
    try {
      await addDoc(collection(db, "search_history"), { userId: auth.currentUser.uid, term: term, timestamp: serverTimestamp() });
      const intent = detectIntent(term);
      const locationData = extractLocationIntelligence(term);
      if (intent) {
        if (locationData) setPendingSearch(locationData);
        setTimeout(() => {
          setIsAiProcessing(false);
          setSearchTerm("");
          setView(intent); 
        }, 800);
      } else {
        setIsAiProcessing(false);
        setSearchTerm("");
        await fetchHistory();
      }
    } catch (err) {
      console.error("Search Error:", err);
      setIsAiProcessing(false);
    }
  };

  const detectIntent = (term: string) => {
    const lower = term.toLowerCase();
    if (lower.includes("hotel") || lower.includes("stay") || lower.includes("room")) return 'hotels';
    if (lower.includes("flight") || lower.includes("ticket") || lower.includes("fly")) return 'flights';
    if (lower.includes("car") || lower.includes("rent")) return 'carrental';
    if (lower.includes("insurance") || lower.includes("protect")) return 'insurance';
    if (lower.includes("plan") || lower.includes("itinerary")) return 'tripplanner';
    return null;
  };

  return (
    <div className="home-page fade-in">
      <header className="home-header">ZenTravel</header>
      
      <main className="home-content">
        <div className="category-grid">
          <div className="cat-box red" onClick={() => setView('hotels')}>
            <span className="cat-label">HOTELS</span>
            <div className="cat-img-wrapper"><img src={hotelsImg} alt="Hotels" className="cat-img-fit" /></div>
          </div>
          <div className="cat-box orange" onClick={() => setView('flights')}>
            <span className="cat-label">FLIGHTS</span>
            <div className="cat-img-wrapper"><img src={flightsImg} alt="Flights" className="cat-img-fit" /></div>
          </div>
          <div className="cat-box yellow" onClick={() => setView('insurance')}>
            <span className="cat-label">INSURANCE</span>
            <div className="cat-img-wrapper"><img src={insuranceImg} alt="Insurance" className="cat-img-fit" /></div>
          </div>
          <div className="cat-box green" onClick={() => setView('tripplanner')}>
            <span className="cat-label">TRIP PLANNER</span>
            <div className="cat-img-wrapper"><img src={tripPlannerImg} alt="Trip Planner" className="cat-img-fit" /></div>
          </div>
          <div className="cat-box blue" onClick={() => setView('carrental')}>
            <span className="cat-label">CAR RENTAL</span>
            <div className="cat-img-wrapper"><img src={carRentalImg} alt="Car Rental" className="cat-img-fit" /></div>
          </div>
        </div>

        <div className="search-section">
          <form className={`search-bar-container ${isAiProcessing ? 'ai-glow' : ''}`} onSubmit={handleSearch}>
            <input
              type="text"
              placeholder={isAiProcessing ? "Analyzing with Z-AI..." : "e.g. 'hotels in London'"}
              className="main-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isAiProcessing}
            />
            <button type="submit" className="search-submit-btn">
              {isAiProcessing ? <Sparkles size={22} className="animate-pulse" color="#7b2cbf" /> : <Search size={22} color="#7b2cbf" />}
            </button>
          </form>
          
          <div className="search-history-row">
            {history.length > 0 && <span className="history-label">Recent:</span>}
            {history.map((item, index) => (
              <div key={index} className="history-pill" onClick={() => setSearchTerm(item)}>{item}</div>
            ))}
          </div>
        </div>

        <div className="ai-recommendation" onClick={() => setShowModal(true)}>
          <h3>AI RECOMMENDATION</h3>
          <p className="truncate">{aiMessage}</p>
          <span className="more-link">Press to know more</span>
        </div>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <button className="close-modal" onClick={() => setShowModal(false)}><X size={20} /></button>
              <h3>AI RECOMMENDATION</h3>
              <p>{aiMessage}</p>
              <button className="modal-action-btn" onClick={() => { 
                if (targetSearchCity) {
                  setPendingSearch({ origin: "", destination: targetSearchCity });
                }
                setShowModal(false); 
                setView('hotels'); 
              }}>Book Now</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
