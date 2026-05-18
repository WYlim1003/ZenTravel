import { useEffect, useState } from 'react';
import { db, auth } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Heart, MapPin } from 'lucide-react';
import mascotImg from '../assets/MASCOT.png';
import '../styles/SavedPage.css';

interface SavedItem {
  id: string;
  hotelId: string;
  name: string;
  location: string;
  price: number | string;
  imageUrl?: string;
  userId: string;
}

// Ensure the props match what App.tsx sends
interface SavedPageProps {
  setView: (v: string, id?: string) => void;
  globalCurrency?: { name: string; code: string }; 
}

export const SavedPage = ({ setView, globalCurrency }: SavedPageProps) => {
  const [favorites, setFavorites] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, number>>({ MYR: 1 });

  // SAFE EXTRACTION: Prevent white screen if globalCurrency is undefined
  const currencyInfo = globalCurrency?.code || 'RM | MYR';
  const symbol = currencyInfo.split(' | ')[0];
  const currencyCode = currencyInfo.split(' | ')[1];

  // Fetch Exchange Rates
  useEffect(() => {
    fetch(`https://open.er-api.com/v6/latest/MYR`)
      .then(res => res.json())
      .then(data => {
        if (data && data.rates) {
          setRates(data.rates);
        }
      })
      .catch(err => {
        console.error("Currency API Error:", err);
      });
  }, []);

  // Firebase Listener
  useEffect(() => {
    if (!auth.currentUser) {
      setTimeout(() => setLoading(false), 0);
      return;
    }

    const uid = auth.currentUser.uid;
    const q = query(collection(db, "favorites"), where("userId", "==", uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const favData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as SavedItem[];
      
      setFavorites(favData);
      setLoading(false);
    }, (error) => {
      console.error("Firebase Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="saved-page-root">
      <header className="zen-purple-header">
        <ArrowLeft className="header-icon-left" onClick={() => setView('profile')} />
        <h1 className="header-centered-title">Saved</h1>
        <div className="header-placeholder-right"></div>
      </header>

      <div className="white-content-area">
        {loading ? (
          <div className="empty-state-container">
            <p>Loading favorites...</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="empty-state-container">
            <img src={mascotImg} alt="Mascot" className="mascot-img-center" />
            <p className="empty-msg-text">Your wishlist is empty!</p>
            <button className="zen-solid-purple-btn" onClick={() => setView('home')}>
              Explore Hotels
            </button>
          </div>
        ) : (
          <div className="saved-items-grid">
            {favorites.map((item) => {
              // Convert price dynamically
              const basePrice = typeof item.price === 'string' ? parseFloat(item.price) : Number(item.price);
              const rate = rates[currencyCode] || 1;
              const convertedPrice = (basePrice * rate).toFixed(2);

              return (
                <div 
                  key={item.id} 
                  className="saved-item-card" 
                  onClick={() => setView('hotels', item.hotelId)}
                >
                  <div className="card-image-box">
                    <img 
                      src={item.imageUrl || 'https://via.placeholder.com/150'} 
                      alt={item.name} 
                    />
                    <div className="heart-icon-badge">
                      <Heart size={14} fill="#ff4d4d" color="#ff4d4d" />
                    </div>
                  </div>
                  
                  <div className="card-details-box">
                    <h3 className="hotel-name-text">{item.name}</h3>
                    <p className="hotel-loc-text">
                      <MapPin size={14} /> {item.location}
                    </p>
                    <span className="hotel-price-tag">
                      {symbol} {convertedPrice} <small>/night</small>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
