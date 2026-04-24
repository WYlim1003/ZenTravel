import { useEffect } from 'react'; 
import { auth } from '../services/firebase';
import { onAuthStateChanged } from "firebase/auth"; 
import logo from '../assets/zentravel_logo.png'

interface AuthProps {
  onGoogle: () => void;
  onEmailClick: () => void;
  onRegister: (e: any) => void;
  view: 'landing' | 'auth' | 'register' | 'home' | 'profile';
  setView: (v: any) => void;
  setEmail: (e: string) => void;
  setPassword: (p: string) => void;
}

export const AuthPage = ({ onGoogle, onEmailClick, onRegister, view, setView, setEmail, setPassword }: AuthProps) => {
  
  // --- ADD THIS SECTION ---
  useEffect(() => {
    // This listener ignores the "missing state" error and just checks: 
    // "Is the user logged in now?"
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User detected, navigating to home...");
        setView('home'); 
      }
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [setView]);
  // -------------------------

  return (
    <div className="landing-container fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0
    }}>
      <div className="content-wrapper" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%'
      }}>
        
        <div className="logo-circle" style={{ 
            width: '220px', 
            height: '220px', 
            backgroundColor: 'white', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginBottom: '40px', 
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        }}>
            <img src={logo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        
        {view === 'auth' ? (
          <div className="auth-button-group" style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
            <button className="auth-btn google-btn" onClick={onGoogle} style={{ padding: '14px', borderRadius: '50px', cursor: 'pointer' }}>
              <span className="btn-icon">G</span> Continue with Google
            </button>
            <button className="auth-btn email-btn" onClick={onEmailClick} style={{ padding: '14px', borderRadius: '50px', cursor: 'pointer', backgroundColor: '#333', color: 'white' }}>
              Continue with Email
            </button>
          </div>
        ) : (
          <div style={{ width: '300px' }}>
            <h2 className="register-title" style={{ color: 'white', textAlign: 'center', marginBottom: '20px' }}>Create Account</h2>
            <form className="register-form" onSubmit={onRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input 
                type="email" 
                placeholder="Email" 
                className="auth-input" 
                style={{ padding: '12px', borderRadius: '8px' }}
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
              <input 
                type="password" 
                placeholder="Password" 
                className="auth-input" 
                style={{ padding: '12px', borderRadius: '8px' }}
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
              <button type="submit" className="auth-btn email-btn" style={{ padding: '14px', borderRadius: '50px', backgroundColor: '#333', color: 'white', cursor: 'pointer', marginTop: '10px' }}>
                Sign Up
              </button>
              <p className="back-link" onClick={() => setView('auth')} style={{ color: 'white', textAlign: 'center', cursor: 'pointer', marginTop: '15px', textDecoration: 'underline' }}>
                ← Back
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}