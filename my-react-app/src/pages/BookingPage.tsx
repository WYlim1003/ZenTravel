import { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { MessageSquare } from 'lucide-react';
import mascotImg from '../assets/MASCOT.png';
import { translations } from '../utils/translations'; 
import '../styles/BookingPage.css';

export const BookingPage = ({ setView, globalLang }: { setView: (view: string, id?: string) => void; globalLang: string }) => {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const t = translations[globalLang || 'en']; 

  const getTransportTitle = (item: Record<string, unknown>) => {
    if (item.transportMode === 'pickup') return 'Airport Pick-up';
    if (item.transportMode === 'dropoff') return 'Airport Drop-off';
    if (item.transportMode === 'rental') return 'Car Rental';
    return (item.name as string) || (item.hotelName as string) || 'Transport';
  };

  // Firebase Timestamp 安全转换逻辑
  const safeDate = (val: string | number | { seconds: number }) => {
    if (!val) return "";
    if (typeof val === 'object' && 'seconds' in val) {
      return new Date(val.seconds * 1000).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    return String(val);
  };

  const safeSlashDate = (val: string | number | { seconds: number }) => {
    if (!val) return "";

    if (typeof val === 'object' && val.seconds) {
      return new Date(val.seconds * 1000).toLocaleDateString('en-GB');
    }

    if (typeof val === 'string') {
      const directDate = new Date(val);
      if (!Number.isNaN(directDate.getTime())) {
        return directDate.toLocaleDateString('en-GB');
      }

      const normalized = val
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const parts = normalized.split(' ');
      if (parts.length === 3) {
        const [dayRaw, monthRaw, yearRaw] = parts;
        const monthMap: Record<string, number> = {
          jan: 0,
          feb: 1,
          mar: 2,
          apr: 3,
          may: 4,
          jun: 5,
          jul: 6,
          aug: 7,
          sep: 8,
          oct: 9,
          nov: 10,
          dec: 11,
        };
        const day = Number(dayRaw);
        const year = Number(yearRaw);
        const month = monthMap[monthRaw.slice(0, 3).toLowerCase()];
        if (!Number.isNaN(day) && !Number.isNaN(year) && month !== undefined) {
          return new Date(year, month, day).toLocaleDateString('en-GB');
        }
      }
    }

    return String(val);
  };

  // Firebase 实时监听
  useEffect(() => {
    // Listen for Auth changes first to ensure we have the user
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, "Booking"), where("userId", "==", user.uid));
        
        const unsubscribeDb = onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setBookings(items);
        }, (error) => {
          console.error("Firestore error: ", error);
        });

        return () => unsubscribeDb();
      } else {
        setBookings([]); // Clear bookings if logged out
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const filterBy = (type: string) => {
    return bookings.filter(b =>
      (b.status === activeTab) &&
      (b.type === type || (type === 'ticket' && b.type === 'flight'))
    );
  };

  const renderSection = (titleKey: string, type: string) => {
    const data = filterBy(type);
    return (
      <section className="zen-section">
        <h3 className="section-title">{t[titleKey]}</h3>
        {data.length === 0 ? (
          <div className="zen-no-booking">
            <img src={mascotImg} alt="No Booking" className="zen-mascot" />
            <p>{t.noBooking}</p>
          </div>
        ) : (
          data.map(item => {
            const isFlight = item.type === 'flight' || item.type === 'ticket';
            const isTransport = item.type === 'transport';
            return (
              <div key={item.id} className="zen-card-wrapper">
                <div className="zen-status-badge">
                  {isFlight ? t.checkIn : t.confirmed}
                </div>
               
                <div className="zen-card-body">
                  {isFlight ? (
                    /* 【新版 Design】Ticket 布局：大字体 + 标签式展示 */
                    <div className="zen-ticket-content">
                      <div className="ticket-left">
                        <h4 className="ticket-main-title">{t.depart}</h4>
                        <p className="ticket-text-large">{safeDate(item.date)}</p>
                        
                        <div className="ticket-location-container">
                          {/* 保留新版的 label 和 value 结构，确保 CSS 渲染大字体 */}
                          <div className="location-row">
                            <span className="location-label">{t.from}</span>
                            <span className="location-value">{item.from}</span>
                          </div>
                          <div className="location-row">
                            <span className="location-label">{t.to}</span>
                            <span className="location-value">{item.to}</span>
                          </div>
                        </div>
                      </div>

                      <div className="ticket-right">
                        {/* 纯数据渲染，不带 "no:" 前缀 */}
                        <p className="ticket-sub-id">{item.bookingNum || item.bookNum}</p>
                        <p className="ticket-sub">{item.airline}</p>
                        <p className="ticket-sub">{item.pax} {item.pax ? 'pax.' : ''}</p>
                      </div>
                    </div>
                  ) : (
                    /* 酒店/交通布局 */
                    <div className="zen-card-main-content">
                      <img src={item.imageUrl || mascotImg} alt="item" className="zen-item-thumb" />
                      <div className="zen-item-details">
                        <div className="zen-detail-header">
                          <h4 className="zen-item-name">
                            {isTransport ? getTransportTitle(item) : (item.name || item.hotelName)}
                          </h4>
                          <span className="zen-booking-no">{item.bookingNum || item.bookNum}</span>
                        </div>
                        <p className="zen-date-normal">
                          {isTransport ? safeSlashDate(item.date) : safeDate(item.date)}
                        </p>
                        <p className="zen-description">
                          {item.type === 'transport' ? item.plateNum : item.details}
                        </p>
                      </div>
                    </div>
                  )}
                 
                  <div className="zen-action-row">
                    {activeTab === 'upcoming' && (
                      <span className="zen-refund-btn" onClick={() => setView('refund', item.id)}>
                        {t.refund}
                      </span>
                    )}
                    {(isFlight || isTransport) && (
                      <span className="zen-view-btn" onClick={() => setView('view-ticket', item.id)}>
                        {t.view}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    );
  };

  return (
    <div className="zen-container">
      <header className="zen-purple-header">
        <h1>ZenTravel</h1>
        <div className="zen-notif-wrapper" onClick={() => setView('notification')}>
          <MessageSquare color="white" />
          {bookings.some(b => b.hasNotification) && <span className="zen-red-dot"></span>}
        </div>
      </header>

      <div className="max-width-container">
        <div className="zen-tab-bar">
          {['upcoming', 'past', 'cancelled'].map(tab => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {t[tab]}
            </button>
          ))}
        </div>

        <main className="zen-list" style={{ paddingBottom: '40px' }}>
          {renderSection('myTicket', 'ticket')}
          {renderSection('myHotel', 'hotel')}
          {renderSection('myTransport', 'transport')}
        </main>
      </div>
    </div>
  );
};
