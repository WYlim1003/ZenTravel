import React from 'react';
import { ArrowLeft, Star, MapPin, Sparkles, Calendar, Users, ChevronRight, Info, Building2 } from 'lucide-react';
import "../styles/HotelsPage.css"; 

interface Hotel {
  name: string;
  location: string;
  price: string;
  rating: string;
  description: string;
  amenities: string[];
  image_keyword: string;
  isRecommended?: boolean;
}

interface ResultsProps {
  hotels: Hotel[];
  destination: string;
  searchMeta: { startDate: string; endDate: string; guests: number; nights: number };
  onBack: () => void;
  onBook: (hotel: Hotel) => void;
}

export const HotelResultsPage: React.FC<ResultsProps> = ({ 
  hotels, destination, searchMeta, onBack, onBook 
}) => {
  return (
    <div className="zen-results-wrapper fade-in">
      {/* 1. PREMIUM HEADER */}
      <header className="zen-results-hero">
        <div className="hero-overlay">
          <button className="glass-back-btn" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <div className="hero-content">
            <h2 className="hero-city">{destination}</h2>
            <div className="hero-meta-pills">
              <span className="meta-pill"><Calendar size={12} /> {searchMeta?.startDate}</span>
              <span className="meta-pill"><Users size={12} /> {searchMeta?.guests} Guests</span>
              <span className="meta-pill"><Building2 size={12} /> {hotels.length} Stays</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN RESULTS FEED */}
      <main className="zen-results-container">
        {hotels.length > 0 ? (
          hotels.map((h, i) => (
            <div key={i} className="luxury-hotel-card fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              {/* Media Section */}
              <div className="luxury-card-media">
                <img 
                  src={`https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80&sig=${h.image_keyword}`} 
                  alt={h.name} 
                />
                <div className="luxury-rating-badge">
                  <Star size={12} fill="currentColor" /> {h.rating}
                </div>
                {h.isRecommended && (
                  <div className="luxury-featured-tag">
                    <Sparkles size={12} /> Best Value
                  </div>
                )}
              </div>

              {/* Information Section */}
              <div className="luxury-card-body">
                <div className="body-header">
                  <h4 className="hotel-name-text">{h.name}</h4>
                  <div className="location-row">
                    <MapPin size={14} />
                    <span>{h.location}</span>
                  </div>
                </div>
                
                <div className="concierge-note">
                  <div className="note-icon"><Info size={14} /></div>
                  <p>"{h.description}"</p>
                </div>

                <div className="amenity-cloud">
                  {h.amenities?.map((amt, idx) => (
                    <span key={idx} className="luxury-pill">{amt}</span>
                  ))}
                </div>

                {/* Footer Section */}
                <div className="luxury-card-footer">
                  <div className="price-stack">
                    <span className="currency-label">{h.price.split(' ')[0]}</span>
                    <div className="price-row">
                       <span className="price-big">{h.price.split(' ')[1]}</span>
                       <span className="price-per">/night</span>
                    </div>
                  </div>
                  <button className="luxury-book-btn" onClick={() => onBook(h)}>
                    <span>Book Stay</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state-lux">
             <Building2 size={48} />
             <p>No matches found in {destination}.</p>
          </div>
        )}
      </main>
    </div>
  );
};
