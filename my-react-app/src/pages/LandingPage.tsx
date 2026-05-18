/* src/pages/LandingPage.tsx */
import logo from '../assets/zentravel_logo.png'

export const LandingPage = () => (
  <div className="landing-container fade-in" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh'
  }}>
    <div className="content-wrapper" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center', // This is the "magic" line for alignment
      textAlign: 'center'
    }}>
      
      {/* Logo Circle */}
      <div className="logo-circle" style={{
        width: '220px', 
        height: '220px', 
        backgroundColor: 'white', 
        borderRadius: '50%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: '60px', // Reduced slightly for better visual balance
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)'
      }}>
        <img 
          src={logo} 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover' 
          }} 
          alt="Logo" 
        />
      </div>

      {/* Text Elements */}
      <h1 style={{ 
        fontSize: '5rem', 
        fontWeight: 500, 
        margin: '0 0 20px 0', 
        letterSpacing: '2px', 
        color: 'black',
        width: '100%' // Ensures the text block spans the width to center properly
      }}>
        ZenTravel
      </h1>

      <p style={{ 
        fontSize: '1.8rem', 
        color: 'white', 
        margin: 0, 
        fontStyle: 'italic',
        opacity: 0.9 
      }}>
        Peaceful journeys, powered by AI.
      </p>
      
    </div>
  </div>
);
