import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, Loader2, CheckCircle, ShieldCheck, Plane, Building, Shield } from 'lucide-react';
import { getInsurancePlans, type InsurancePlan } from '../services/mockInsuranceAPI';
import { db, auth } from '../services/firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import "../styles/InsurancePage.css";

interface InsuranceProps {
  setView: (v: string) => void;
  pendingSearch?: { origin: string; destination: string } | null;
  clearSearch?: () => void;
}

export const InsurancePage: React.FC<InsuranceProps> = ({ setView, pendingSearch, clearSearch }) => {
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [uninsuredTrips, setUninsuredTrips] = useState<Record<string, unknown>[]>([]);
  const [protectedTrips, setProtectedTrips] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [isBuying, setIsBuying] = useState(false);

  const isInternational = (destination: string) => {
    const malaysianCities = ['kl', 'kuala lumpur', 'kul', 'penang', 'pen', 'langkawi', 'lgk', 'johor', 'malacca'];
    const lowerDest = destination?.toLowerCase() || "";
    return !malaysianCities.some(city => lowerDest.includes(city));
  };

  const fetchData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    // setLoading(true); // Redundant if loading starts as true
    try {
      const planData = await getInsurancePlans();
      setPlans(planData);

      const q = query(collection(db, "Booking"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const allBookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as { type?: string; linkedTripId?: string; status?: string; to?: string; name?: string; date?: string } }));
      
      // 1. Identify linked IDs and active trips
      const insuredIds = allBookings.filter(b => b.type === 'insurance').map(i => i.linkedTripId);
      
      // 🚀 FILTER: Only trips that are NOT 'cancelled'
      const validTrips = allBookings.filter(b => 
        (b.type === 'flight' || b.type === 'hotel') && b.status !== 'cancelled'
      );

      // 2. Separate into Uninsured vs Protected
      setUninsuredTrips(validTrips.filter(t => !insuredIds.includes(t.id)));
      setProtectedTrips(validTrips.filter(t => insuredIds.includes(t.id)));

    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 0);
    if (pendingSearch && clearSearch) clearSearch();
    return () => clearTimeout(timer);
  }, [pendingSearch, clearSearch]);

  const getFilteredTrips = () => {
    if (!selectedPlan) return [];
    return uninsuredTrips.filter(trip => {
      const dest = trip.to || trip.name;
      const international = isInternational(dest);
      return selectedPlan.type === 'overseas' ? international : !international;
    });
  };

  const handleBuyInsurance = async () => {
    const user = auth.currentUser;
    if (!user || !selectedPlan || !selectedTripId) return;
    setIsBuying(true);
    try {
      await addDoc(collection(db, "Booking"), {
        userId: user.uid,
        linkedTripId: selectedTripId,
        type: 'insurance',
        name: selectedPlan.title,
        price: selectedPlan.priceDisplay,
        status: 'valid',
        paymentStatus: 'paid',
        timestamp: serverTimestamp()
      });
      await fetchData(); // Refresh list
      setSelectedPlan(null);
    } catch { alert("Error saving."); }
    finally { setIsBuying(false); }
  };

  return (
    <div className="insurance-page-white fade-in">
      <header className="home-header">
        <ArrowLeft onClick={() => setView('home')} style={{ cursor: 'pointer' }} />
        ZenTravel
      </header>

      <main className="insurance-container">
        <h2 className="page-title-dark">Choose Your Protection</h2>

        {loading ? (
          <div className="loader-box"><Loader2 className="animate-spin" size={32} color="#7b2cbf" /></div>
        ) : (
          <>
            <div className="plans-stack">
              {plans.map((plan) => (
                <div key={plan.id} className="insurance-purple-card">
                  <div className="card-content">
                    <h3>{plan.title}</h3>
                    <ul className="mini-benefits">
                      {plan.coverages.slice(0, 2).map((c, i) => (
                        <li key={i}><CheckCircle size={12} /> {c}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="card-action-bottom-right">
                    <button className="price-pill-btn" onClick={() => setSelectedPlan(plan)}>
                      <span className="from-text">From</span>
                      <span className="actual-price">{plan.priceDisplay.replace('From ', '')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 🚀 NEW SECTION: Protected Trips */}
            {protectedTrips.length > 0 && (
              <section className="protected-section">
                <h3 className="section-subtitle">Active Protection</h3>
                <div className="protected-list">
                  {protectedTrips.map(trip => (
                    <div key={trip.id} className="protected-item">
                       <ShieldCheck size={18} color="#2e7d32" />
                       <div className="protected-info">
                          <span className="dest">{trip.to || trip.name}</span>
                          <span className="date">Insured • Trip Date: {trip.date}</span>
                       </div>
                       <span className="status-pill">Covered</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {selectedPlan && (
          <div className="modal-overlay" onClick={() => setSelectedPlan(null)}>
            <div className="modal-card luxe-modal" onClick={e => e.stopPropagation()}>
              <X className="close-icon" onClick={() => setSelectedPlan(null)} />
              <Shield size={40} color="#7b2cbf" style={{display:'block', margin:'0 auto 10px'}} />
              <h3 style={{textAlign:'center', marginBottom:'15px'}}>{selectedPlan.title}</h3>
              
              <div className="trip-selection-area">
                <label className="select-label">Select Trip to Insure:</label>
                {getFilteredTrips().length > 0 ? (
                  <div className="trip-list">
                    {getFilteredTrips().map(trip => (
                      <div key={trip.id} className={`trip-option ${selectedTripId === trip.id ? 'active' : ''}`} onClick={() => setSelectedTripId(trip.id)}>
                        {trip.type === 'flight' ? <Plane size={16}/> : <Building size={16}/>}
                        <div className="trip-info">
                          <span className="trip-dest">{trip.to || trip.name}</span>
                          <span className="trip-date">{trip.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-trips-msg">No eligible uninsured trips found.</p>
                )}
              </div>

              <button className="confirm-purchase-btn" onClick={handleBuyInsurance} disabled={isBuying || !selectedTripId}>
                {isBuying ? "Processing..." : `Protect This Trip`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
