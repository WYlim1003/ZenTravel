import { lazy, Suspense, useState, useEffect } from 'react';
import { auth, db } from './services/firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import mascotImg from './assets/MASCOT-removebg-preview.png';
import { FloatingChatWidget } from './components/FloatingChatWidget';

// Services
import { loginWithGoogle, registerUser } from './services/authService';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

// Pages
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const ChatbotPage = lazy(() => import('./pages/ChatbotPage').then((m) => ({ default: m.ChatbotPage })));
const BookingPage = lazy(() => import('./pages/BookingPage').then((m) => ({ default: m.BookingPage })));
const NotificationPage = lazy(() => import('./pages/NotificationPage').then((m) => ({ default: m.NotificationPage })));
const ViewTicket = lazy(() => import('./pages/ViewTicket').then((m) => ({ default: m.ViewTicket })));
const RefundPage = lazy(() => import('./pages/RefundPage').then((m) => ({ default: m.RefundPage })));
const AboutUs = lazy(() => import('./pages/AboutUs').then((m) => ({ default: m.AboutUs })));
const HelpCenter = lazy(() => import('./pages/HelpCenter').then((m) => ({ default: m.HelpCenter })));
const EditProfile = lazy(() => import('./pages/EditProfile').then((m) => ({ default: m.EditProfile })));
const SavedPage = lazy(() => import('./pages/SavedPage').then((m) => ({ default: m.SavedPage })));
const MyReviews = lazy(() => import('./pages/MyReviews').then((m) => ({ default: m.MyReviews })));

// Category pages
const HotelsPage = lazy(() => import('./pages/HotelsPage').then((m) => ({ default: m.HotelsPage })));
const FlightsPage = lazy(() => import('./pages/FlightsPage').then((m) => ({ default: m.FlightsPage })));
const InsurancePage = lazy(() => import('./pages/InsurancePage').then((m) => ({ default: m.InsurancePage })));
const TripPlannerPage = lazy(() => import('./pages/TripPlannerPage').then((m) => ({ default: m.TripPlannerPage })));
const CarRentalPage = lazy(() => import('./pages/CarRentalPage').then((m) => ({ default: m.CarRentalPage })));
const ManualPlannerPage = lazy(() => import('./pages/ManualPlannerPage').then((m) => ({ default: m.ManualPlannerPage })));

// Components
import { BottomNav } from './components/BottomNav';
import './App.css';

type ViewState = 
  | 'landing' | 'auth' | 'register' | 'login' | 'home' | 'profile' 
  | 'chatbot' | 'booking' | 'notification' | 'view-ticket' 
  | 'refund' | 'about' | 'help' 
  | 'edit-profile' | 'saved' | 'my-reviews'
  | 'hotels' | 'flights' | 'insurance' 
  | 'tripplanner' | 'carrental'| 'manual-planner';

const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;

function App() {
  const [view, setView] = useState<ViewState>('landing');
  const [selectedTicketId, setSelectedTicketId] = useState<string>(''); 
  const [user, setUser] = useState<any>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFloatingChat, setShowFloatingChat] = useState(false);
  const [pendingSearch, setPendingSearch] = useState<{origin: string, destination: string} | null>(null);

  // ✅ FIXED: Single declaration for email and password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [globalCurrency, setGlobalCurrency] = useState(() => {
    const saved = localStorage.getItem('userCurrency');
    return saved ? JSON.parse(saved) : { name: 'Malaysian Ringgit', code: 'RM | MYR' };
  });
  const [cashbackBalance, setCashbackBalance] = useState(0.00);
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({ MYR: 1 });
  const [globalLang, setGlobalLang] = useState('en');

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/MYR`);
        const data = await res.json();
        if (data.result === "success") setExchangeRates(data.conversion_rates);
      } catch (err) { console.error("Exchange API Error:", err); }
    };
    if (API_KEY) fetchRates();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.currencyPreference) setGlobalCurrency(userData.currencyPreference);
            if (userData.languagePreference) setGlobalLang(userData.languagePreference);
            if (userData.cashbackBalance !== undefined) setCashbackBalance(userData.cashbackBalance);
          }

          if (view === 'auth' || view === 'register' || view === 'landing') {
            setView('home');
          }
        } catch (e) { console.error("Firestore sync error:", e); }
      }
      setAuthLoaded(true);
      setLoading(false); 
    });
    return () => unsubscribe();
  }, [view]);

  useEffect(() => {
    if (view === 'landing' && !loading) {
      const timer = setTimeout(() => {
        if (authLoaded) {
          user ? setView('home') : setView('auth'); 
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [view, user, authLoaded, loading]);

  const handleGoogleLogin = async () => {
    try {
      await FirebaseAuthentication.signInWithGoogle({ mode: 'popup' });
    } catch (error) {
      console.error("Google Sign-In failed:", error);
    }
  };

  const handleRegister = async (e: any) => {
    e.preventDefault();
    try {
      await registerUser(email, password);
    } catch (err: any) {
      alert("Registration failed: " + err.message);
    }
  };

  const handleSetView = (newView: ViewState | string, id: string = '') => {
    setView(newView as ViewState);
    if (id) setSelectedTicketId(id);
  };

  const authenticatedViews: ViewState[] = [
    'home', 'profile', 'chatbot', 'booking', 'notification', 
    'view-ticket', 'refund', 'about', 'help', 
    'edit-profile', 'saved', 'my-reviews',
    'hotels', 'flights', 'insurance', 'tripplanner', 'carrental', 'manual-planner'
  ];
  const showNavBar = authenticatedViews.includes(view);
  const pageLoader = <div className="loader-container" style={{ padding: '24px', textAlign: 'center' }}>Loading...</div>;

  const renderContent = () => {
    const commonProps = {
      setView: handleSetView,
      globalCurrency,
      exchangeRates,
      globalLang
    };

    switch (view) {
      case 'home': return <HomePage {...commonProps} setPendingSearch={setPendingSearch} selectedId={selectedTicketId} />;
      case 'profile': return (
        <ProfilePage 
          {...commonProps}
          setGlobalCurrency={(newCurr: any) => {
              setGlobalCurrency(newCurr);
              localStorage.setItem('userCurrency', JSON.stringify(newCurr));
          }} 
          setGlobalLang={setGlobalLang}
          cashbackBalance={cashbackBalance}
          setCashbackBalance={setCashbackBalance}
        />
      );
      case 'hotels': return <HotelsPage {...commonProps} pendingSearch={pendingSearch} clearSearch={() => setPendingSearch(null)} />;
      case 'flights': return <FlightsPage {...commonProps} pendingSearch={pendingSearch} clearSearch={() => setPendingSearch(null)} />;
      case 'insurance': return <InsurancePage {...commonProps} pendingSearch={pendingSearch} clearSearch={() => setPendingSearch(null)} />;
      case 'tripplanner': return <TripPlannerPage {...commonProps} />;
      case 'manual-planner': return <ManualPlannerPage {...commonProps} />;
      case 'carrental': return <CarRentalPage {...commonProps} />;
      case 'chatbot': return <ChatbotPage setView={handleSetView} />;
      case 'booking': return <BookingPage {...commonProps} />; 
      case 'notification': return <NotificationPage {...commonProps} />;
      case 'view-ticket': return <ViewTicket ticketId={selectedTicketId} setView={handleSetView} />;
      case 'refund': return <RefundPage bookingId={selectedTicketId} setView={handleSetView} />;
      case 'about': return <AboutUs setView={handleSetView} />;
      case 'help': return <HelpCenter setView={handleSetView} />;
      case 'edit-profile': return <EditProfile setView={handleSetView} />;
      case 'saved': return <SavedPage setView={handleSetView} globalCurrency={globalCurrency} />;
      case 'my-reviews': return <MyReviews setView={handleSetView} />;
      default: return null;
    }
  };

  return (
    <div className="app-container">
      {view === 'landing' && <LandingPage />}
      
      {(view === 'auth' || view === 'register' || view === 'login') && (
        <Suspense fallback={pageLoader}>
          <AuthPage 
            view={view} setView={setView} onGoogle={handleGoogleLogin} 
            onEmailClick={() => setView('register')}
            onRegister={handleRegister} setEmail={setEmail} setPassword={setPassword}
          />
        </Suspense>
      )}

      {showNavBar && (
        <>
          <main className="main-content-area">
            <Suspense fallback={pageLoader}>{renderContent()}</Suspense>
          </main>
          <div
            className={`persistent-chatbot-btn ${showFloatingChat ? 'persistent-chatbot-btn--active' : ''}`}
            onClick={() => setShowFloatingChat((v) => !v)}
          >
            <img src={mascotImg} alt="AI Assistant" className="persistent-chatbot-mascot" />
          </div>
          {showFloatingChat && (
            <FloatingChatWidget
              onClose={() => setShowFloatingChat(false)}
              onOpenFull={() => { setShowFloatingChat(false); setView('chatbot'); }}
            />
          )}
          <BottomNav currentView={view} setView={handleSetView} />
        </>
      )}
    </div>
  );
}

export default App;