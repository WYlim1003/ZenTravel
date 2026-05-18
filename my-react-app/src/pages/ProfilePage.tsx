import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { 
  Ticket, Wallet, MapPin, UserCircle, Heart, Star, 
  Globe, Eye, CircleDollarSign, Ruler, HelpCircle, Info,
  X, InfoIcon, ChevronLeft, Check
} from 'lucide-react';
import { Achievement } from './Achievement'; 
import { Currency } from './Currency'; 
import { Cashback } from './Cashback'; 
import mascotImg from '../assets/MASCOT.png'; 
import { translations } from '../utils/translations'; 
import '../styles/ProfilePage.css';

interface ProfilePageProps {
  setView: (v: string, id?: string) => void;
  globalCurrency: { name: string; code: string }; 
  setGlobalCurrency: (c: { name: string; code: string }) => void;
  cashbackBalance: number;
  setGlobalLang: (l: string) => void;
  setCashbackBalance: (v: number | ((prev: number) => number)) => void;
  globalLang: string;
}

export const ProfilePage = ({ 
  setView, 
  globalCurrency, 
  setGlobalCurrency, 
  cashbackBalance, 
  setGlobalLang,
  setCashbackBalance,
  globalLang 
}: ProfilePageProps) => {
  const [localView, setLocalView] = useState<'main' | 'coupons' | 'achievements' | 'currency' | 'cashback'>('main');
  const [bookingStats, setBookingStats] = useState({ count: 0, cities: 0, zensUnlocked: 2 });
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  
  const [redeemedAmount, setRedeemedAmount] = useState(() => {
    return localStorage.getItem('zen_coupon_amount') || '0';
  });

  const t = translations[globalLang || 'en'];
  const user = auth.currentUser;
  const symbol = globalCurrency.code.split(' | ')[0];

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "Booking"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setBookings(docs);
      
      const hotelDocs = docs.filter((d: Record<string, unknown>) => d.type === 'hotel');
      const uniqueCities = new Set(hotelDocs.map((d: Record<string, unknown>) => (d.name || d.hotelName))).size || (docs.length > 0 ? 1 : 0);
      
      let unlocked = 2; 
      if (docs.length > 0) unlocked += 1; 
      if (hotelDocs.length >= 2) unlocked += 1; 
      if (docs.some((d: Record<string, unknown>) => d.type === 'transport' || d.type === 'flight')) unlocked += 1; 

      setBookingStats({ count: docs.length, cities: uniqueCities, zensUnlocked: unlocked });
    });
    return () => unsubscribe();
  }, [user]);

  const handleLangChange = async (langCode: string) => {
    setGlobalLang(langCode);
    setShowLangModal(false);
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { languagePreference: langCode });
      } catch (error) {
        console.error("Error updating language preference:", error);
      }
    }
  };

  const handleRedeem = () => {
    if (promoInput.trim() === 'KCL0605') {
      setShowSuccessModal(true);
    }
  };

  const closeAndShowCoupons = () => {
    setShowSuccessModal(false);
    setRedeemedAmount('31');
    localStorage.setItem('zen_coupon_amount', '31');
    setPromoInput('');
  };

  if (localView === 'achievements') return <Achievement setLocalView={setLocalView} />;
  
  if (localView === 'currency') return (
    <Currency 
      setLocalView={setLocalView} 
      currentCurrency={globalCurrency.code} 
      setCurrentCurrency={setGlobalCurrency} 
    />
  );
  
  if (localView === 'cashback') return (
    <Cashback 
      setLocalView={setLocalView} 
      balance={cashbackBalance} 
      setBalance={(newVal: number | ((prev: number) => number)) => {
        const oldVal = cashbackBalance;
        const finalVal = typeof newVal === 'function' ? (newVal as (prev: number) => number)(oldVal) : newVal;
        setCashbackBalance(finalVal);
        if (finalVal === 0 && oldVal > 0) {
          const amountStr = oldVal.toFixed(2);
          setRedeemedAmount(amountStr);
          localStorage.setItem('zen_coupon_amount', amountStr);
        }
      }} 
      symbol={symbol} 
      globalLang={globalLang}
      bookings={bookings}
    />
  );

  if (localView === 'coupons') {
    return (
      <div className="profile-container fade-in">
        <header className="sub-page-header">
          <ChevronLeft onClick={() => setLocalView('main')} className="back-icon" />
          <h1>{t.couponWallet}</h1>
        </header>

        <main className="sub-page-body">
          {Number(redeemedAmount) > 0 && (
            <div className="coupon-summary-card fade-in">
              <div className="inner-tag"><Ticket size={14} style={{marginRight:'5px'}} /> 1 coupon</div>
              <div className="inner-val">{symbol} {redeemedAmount}</div>
              <p className="inner-desc">Estimated savings based on collected coupons and regional averages.</p>
            </div>
          )}

          <div className="auto-apply-banner">
            <InfoIcon size={16} />
            <span>The highest-value coupon will be applied automatically</span>
          </div>

          <div className="promo-input-section">
            <div className="promo-field">
              <input type="text" placeholder="Enter Promo Code" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} />
              <button className="promo-check-btn" onClick={handleRedeem}><Check size={20} color="white" /></button>
            </div>
            <p className="promo-hint">Enter a promo code here to get extra discounts!</p>
          </div>

          <div className="coupon-list">
            {Number(redeemedAmount) === 0 ? (
              <div className="empty-state">
                <img src={mascotImg} alt="Bot" className="empty-bot" />
                <p>No active coupons available</p>
              </div>
            ) : (
              <div className="ticket-container fade-in">
                <div className="ticket-main">
                  <div className="ticket-badge">
                    <div className="badge-content">
                      <small style={{fontSize:'8px', display:'block'}}>SAVE</small>
                      <span style={{fontSize:'16px', fontWeight:'800', display:'block'}}>
                        {symbol} {redeemedAmount}
                      </span>
                      <small style={{fontSize:'8px', display:'block'}}>OFF</small>
                    </div>
                  </div>
                  <div className="ticket-info">
                    <h3>{symbol} {redeemedAmount} {t.coupons}</h3>
                    <p>{Number(redeemedAmount) === 31 ? 'Promo Code Reward' : 'Reward Coupon'}</p>
                    <small>Expiry: Jun 30, 2026</small>
                  </div>
                </div>
                
                <div className="ticket-divider-end">
                  <div className="notch notch-top"></div>
                  <div className="notch notch-bottom"></div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="profile-container fade-in">
      <div className="profile-header">
        <div className="user-profile-info">
          <div className="user-avatar" style={{ backgroundImage: `url(${user?.photoURL || 'https://via.placeholder.com/100'})` }} onClick={() => setView('edit-profile')}></div>
          <div className="user-meta">
            <h2>{t.welcome} {user?.displayName || 'User'}</h2>
            <p>{user?.email || 'user@example.com'}</p>
          </div>
        </div>
      </div>

      <div className="profile-body">
        <div className="ui-card">
          <h3 className="ui-card-title">{t.rewardSavings}</h3>
          <div className="ui-row clickable" onClick={() => setLocalView('coupons')}><Ticket size={18} /> <span>{t.coupons}</span></div>
          <div className="ui-row clickable" onClick={() => setLocalView('cashback')}>
            <Wallet size={18} /> <span>{t.cashback}</span> 
            <span className="ui-val">{symbol} {Number(cashbackBalance).toFixed(2)}</span>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card-header">
            <h3 className="ui-card-title">{t.achievements}</h3>
            <span className="see-more" onClick={() => setLocalView('achievements')}>{t.seeMore}</span>
          </div>
          <div className="achieve-split-layout no-click">
            <div className="achieve-item"><img src={mascotImg} alt="Zen" /><div className="achieve-text"><strong>{bookingStats.zensUnlocked}/7</strong><span>{t.zens}</span></div></div>
            <div className="v-divider"></div>
            <div className="achieve-item"><MapPin color="#7b2cbf" size={32} /><div className="achieve-text"><strong>{bookingStats.cities}</strong><span>{t.city}</span></div></div>
          </div>
        </div>

        <div className="ui-card">
          <h3 className="ui-card-title">{t.myAccount}</h3>
          <div className="ui-row clickable" onClick={() => setView('edit-profile')}><UserCircle size={18} /> <span>{t.profileEdit}</span></div>
          <div className="ui-row clickable" onClick={() => setView('saved')}><Heart size={18} /> <span>{t.saved}</span></div>
          <div className="ui-row clickable" onClick={() => setView('my-reviews')}><Star size={18} /> <span>{t.myReviews}</span></div>
        </div>

        <div className="ui-card">
          <h3 className="ui-card-title">{t.settings}</h3>
          <div className="ui-row clickable" onClick={() => setShowLangModal(true)}>
            <Globe size={18} /> <span>{t.language}</span> 
            <span className="ui-val" style={{ color: '#7b2cbf', fontWeight: 'bold' }}>{globalLang === 'zh' ? '简体中文' : 'English'}</span>
          </div>
          <div className="ui-row no-click"><Eye size={18} /> <span>{t.priceDisplay}</span> <span className="ui-val">{t.basePerNight}</span></div>
          <div className="ui-row clickable" onClick={() => setLocalView('currency')}><CircleDollarSign size={18} /> <span>{t.currency}</span> <span className="ui-val">{globalCurrency.code}</span></div>
          <div className="ui-row no-click"><Ruler size={18} /> <span>{t.distance}</span> <span className="ui-val">km</span></div>
        </div>

        <div className="ui-card">
          <h3 className="ui-card-title">{t.helpInfo}</h3>
          <div className="ui-row clickable" onClick={() => setView('about')}><Info size={18} /> <span>{t.aboutUs}</span></div>
          <div className="ui-row clickable" onClick={() => setView('help')}><HelpCircle size={18} /> <span>{t.helpCenter}</span></div>
        </div>

        <button className="ui-logout-btn" onClick={() => signOut(auth).then(() => setView('auth'))}>{t.logout}</button>
      </div>

      {showLangModal && (
        <div className="modal-overlay" onClick={() => setShowLangModal(false)}>
          <div className="lang-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lang-modal-top"><h3>{t.selectLang}</h3><X size={22} onClick={() => setShowLangModal(false)} style={{cursor:'pointer', color:'#999'}} /></div>
            <div className="lang-list">
              <div className={`lang-item ${globalLang === 'en' ? 'active' : ''}`} onClick={() => handleLangChange('en')}><span>English</span>{globalLang === 'en' && <Check size={18} color="#7b2cbf" />}</div>
              <div className={`lang-item ${globalLang === 'zh' ? 'active' : ''}`} onClick={() => handleLangChange('zh')}><span>简体中文</span>{globalLang === 'zh' && <Check size={18} color="#7b2cbf" />}</div>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="modal-overlay" onClick={closeAndShowCoupons}>
          <div className="redeem-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-icon-container"><div className="success-circle"><Check size={40} color="white" strokeWidth={3} /></div></div>
            <h2 className="success-title">Redeem Successfully!</h2>
            <p className="success-subtitle">Enjoy your <span className="highlight-text">{symbol} {redeemedAmount || 31} off</span>.</p>
            <button className="success-action-btn" onClick={closeAndShowCoupons}>View Wallet</button>
            <X className="modal-close-icon" size={20} onClick={closeAndShowCoupons} />
          </div>
        </div>
      )}
    </div>
  );
};
