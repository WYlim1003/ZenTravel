import { ArrowLeft, Globe, ShieldCheck, Zap } from 'lucide-react';
import '../styles/AboutUs.css';

interface Props { setView: (view: string) => void; }

export const AboutUs = ({ setView }: Props) => {
  return (
    <div className="about-container">
      <header className="about-header">
        <ArrowLeft className="clickable" onClick={() => setView('profile')} />
        <h1>About ZenTravel</h1>
        <div style={{ width: 24 }}></div>
      </header>

      <div className="about-content">
        <div className="about-logo-section">
          <div className="app-icon-placeholder">Zen</div>
          <h2>ZenTravel v1.0.4</h2>
          <p>Your Ultimate Travel Companion</p>
        </div>

        <div className="info-card">
          <h3>Our Mission</h3>
          <p>ZenTravel is designed to simplify your journey. Whether it's flights, hotels, or local transport, we bring everything into one seamless interface to ensure you travel with a "Zen" state of mind.</p>
        </div>

        <div className="features-grid">
          <div className="feature-item">
            <Globe color="#8a2be2" />
            <span>Global Reach</span>
          </div>
          <div className="feature-item">
            <ShieldCheck color="#8a2be2" />
            <span>Secure Booking</span>
          </div>
          <div className="feature-item">
            <Zap color="#8a2be2" />
            <span>Real-time Updates</span>
          </div>
        </div>

        <footer className="about-footer">
          <p>© 2026 ZenTravel Inc.</p>
          <p>Terms of Service | Privacy Policy</p>
        </footer>
      </div>
    </div>
  );
};
