import { Home, Bell, Calendar, User } from 'lucide-react';
import '../App.css';
import mascotImg from '../assets/MASCOT-removebg-preview.png';

interface NavProps {
  currentView: string;
  setView: (view: string) => void;
}

export const BottomNav = ({ currentView, setView }: NavProps) => {
  return (
    <nav className="bottom-nav">
      <div className={`nav-item ${currentView === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
        <Home className="nav-icon" />
      </div>

      <div className={`nav-item ${currentView === 'notification' ? 'active' : ''}`} onClick={() => setView('notification')}>
        <Bell className="nav-icon" />
      </div>

      <div className="ai-floating-container" onClick={() => setView('chatbot')}>
        <div className={`ai-floating-btn ${currentView === 'chatbot' ? 'active-ai' : ''}`}>
          <img src={mascotImg} alt="AI Assistant" className="ai-floating-mascot" />
        </div>
      </div>

      <div className={`nav-item ${currentView === 'booking' ? 'active' : ''}`} onClick={() => setView('booking')}>
        <Calendar className="nav-icon" />
      </div>

      <div className={`nav-item ${currentView === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>
        <User className="nav-icon" />
      </div>
    </nav>
  );
};