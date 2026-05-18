import { useEffect, useState } from 'react';
import { db, auth } from '../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ChevronLeft, X, Info } from 'lucide-react';
import '../styles/Achievement.css';

// 导入图片资源
import mascotImg from '../assets/MASCOT.png'; 
import mascot1 from '../assets/MASCOT1.png';
import mascot2 from '../assets/MASCOT2.png';
import mascot3 from '../assets/MASCOT3.png';
import mascot4 from '../assets/MASCOT4.png';
import mascot5 from '../assets/MASCOT5.png';

export const Achievement = ({ setLocalView }: { setLocalView: (v: string) => void }) => {
  const [selectedZen, setSelectedZen] = useState<Record<string, unknown> | null>(null);
  const [bookingData, setBookingData] = useState<Record<string, unknown>[]>([]);
  const [hasReview, setHasReview] = useState(false); 

  // --- 逻辑部分：从 Firebase 实时获取数据 ---
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 监听订单数据
    const qBooking = query(collection(db, "Booking"), where("userId", "==", user.uid));
    const unsubBooking = onSnapshot(qBooking, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      setBookingData(docs);
    });

    // 监听评论数据 (判断是否有评论)
    const qReviews = query(collection(db, "My_Reviews"), where("userId", "==", user.uid));
    const unsubReviews = onSnapshot(qReviews, (snapshot) => {
      setHasReview(!snapshot.empty);
    });

    return () => {
      unsubBooking();
      unsubReviews();
    };
  }, []);

  // --- 逻辑部分：动态计算统计数据 ---
  const hotelBookings = bookingData.filter(b => b.type === 'hotel');
  const transportBookings = bookingData.filter(b => b.type === 'transport' || b.type === 'flight');
  
  const stats = {
    hotels: hotelBookings.length,
    total: bookingData.length,
    cities: new Set(hotelBookings.map(h => h.name)).size || (hotelBookings.length > 0 ? 1 : 0),
    nights: hotelBookings.reduce((acc, curr) => {
        // 从详情文本中提取数字，例如 "2 nights" -> 2
        const n = parseInt((curr.details as string)?.match(/\d+/)?.[0] || "1");
        return acc + n;
    }, 0)
  };

  // --- 逻辑部分：将数据映射到成就系统 ---
  const zensData = [
    { id: 1, name: 'Welcome', status: '1/1', unlocked: true, img: mascot1, desc: "Joined ZenTravel family!" },
    { id: 2, name: 'Navigator', status: '0/1', unlocked: false, img: mascot2, desc: "Explore more places using the map." }, 
    { id: 3, name: 'Newbie', status: stats.total > 0 ? '1/1' : '0/1', unlocked: stats.total > 0, img: mascot3, desc: "Completed your first booking." },
    { id: 4, name: 'Traveler', status: `${Math.min(stats.hotels, 2)}/2`, unlocked: stats.hotels >= 2, img: mascot4, desc: "Completed 2 or more hotel stays." },
    { id: 5, name: 'Scribbler', status: hasReview ? '1/1' : '0/1', unlocked: hasReview, img: mascot5, desc: "Shared your first travel review." },
    { id: 6, name: 'Buddy', status: transportBookings.length > 0 ? '1/1' : '0/1', unlocked: transportBookings.length > 0, img: mascotImg, desc: "Booked a flight or transport." }, 
  ];

  return (
    <div className="profile-container fade-in">
      {/* 头部保留原版设计 */}
      <div className="sub-page-header">
        <ChevronLeft onClick={() => setLocalView('main')} className="back-icon" />
        <span>Travel achievements</span>
      </div>
      
      <div className="achievement-detail-body">
        <h3 className="section-title">
          My Zens <Info size={14} style={{marginLeft: '5px', color: '#ccc'}} />
        </h3>
        
        {/* 成就网格保留原版设计 */}
        <div className="agojis-grid">
          {zensData.map(zen => (
            <div 
              key={zen.id} 
              className={`agoji-card ${!zen.unlocked ? 'locked' : ''}`} 
              onClick={() => setSelectedZen(zen)}
            >
              <div className="agoji-img-wrap">
                <img 
                  src={zen.img} 
                  alt={zen.name} 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain',
                    filter: zen.unlocked ? 'none' : 'grayscale(100%) opacity(0.4)' 
                  }} 
                />
                {!zen.unlocked && <span className="new-tag">Locked</span>}
              </div>
              <p className="agoji-name">{zen.name}</p>
              <p className="agoji-status">{zen.status}</p>
            </div>
          ))}
        </div>

        {/* 弹窗详情保留原版设计 */}
        {selectedZen && (
          <div className="modal-overlay" onClick={() => setSelectedZen(null)}>
            <div className="zen-progress-modal" onClick={e => e.stopPropagation()}>
              <X className="modal-close" onClick={() => setSelectedZen(null)} />
              <img src={selectedZen.img} alt={selectedZen.name} style={{ width: '80px', marginBottom: '15px' }} />
              <h2>{selectedZen.name}</h2>
              <p style={{ fontSize: '14px', color: '#666' }}>{selectedZen.desc}</p>
              
              <div className="progress-container">
                <div 
                  className="progress-bar" 
                  style={{ width: selectedZen.unlocked ? '100%' : '0%' }}
                ></div>
              </div>
              
              <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#8A00E5' }}>
                {selectedZen.unlocked ? 'Unlocked!' : `Progress: ${selectedZen.status}`}
              </p>
            </div>
          </div>
        )}

        <h3 className="section-title">My travel stats</h3>
        <div className="stats-grid">
          <div className="stat-box">🌍 1 country</div>
          <div className="stat-box">📍 {stats.cities} City</div>
          <div className="stat-box">🏨 {stats.hotels} hotel</div>
          <div className="stat-box">🌙 {stats.nights} night</div>
        </div>
      </div>
    </div>
  );
};
