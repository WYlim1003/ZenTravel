import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import '../styles/HelpCenter.css';

// 导入新的透明背景图片
import mascotImg from '../assets/MASCOT-removebg-preview.png'; 

interface Props { setView: (view: string) => void; }

export const HelpCenter = ({ setView }: Props) => {
  const [tab, setTab] = useState<'hotel' | 'flight'>('hotel');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = {
    hotel: [
      { q: "How do I create an account?", a: "Go to the profile tab and click on 'Sign Up'. You can use your email or Google account." },
      { q: "How do I check my hotel booking details?", a: "Click on the 'My Bookings' tab on the home screen to view all active and past hotel stays." },
      { q: "Can I change my check-in date?", a: "Yes, you can request a date change through the booking details page, subject to hotel availability." }
    ],
    flight: [
      { q: "Where can I check my flight booking details?", a: "All flight e-tickets are stored in the 'My Bookings' section under the Flights category." },
      { q: "Can you resend the flight confirmation to me?", a: "You can click 'Resend Email' inside your flight booking details to get a new copy of your itinerary." },
      { q: "How do I request a refund for my flight?", a: "Go to your booking, click on the flight, and select the 'Refund' button to submit your request." }
    ]
  };

  return (
    <div className="help-container">
      <header className="help-header">
        <ArrowLeft className="clickable" onClick={() => setView('profile')} />
        <h1>Contact us</h1>
        <div style={{ width: 24 }}></div>
      </header>

      {/* 背景颜色已通过内联样式或 CSS 修改为紫色 #8600E0 */}
      <div className="help-banner" style={{ backgroundColor: '#8600E0' }}>
        <div className="banner-text">
          <h2>Need help? We're here for you!</h2>
          <p>Get quick answers from ZenTravel customer care.</p>
          <button className="contact-btn" style={{ color: '#8600E0' }}>Contact Customer Service</button>
        </div>
        <img src={mascotImg} alt="Mascot" className="help-mascot" />
      </div>

      <div className="tab-switcher">
        <button 
          className={tab === 'hotel' ? 'active' : ''} 
          onClick={() => { setTab('hotel'); setOpenIndex(null); }}
        >
          Accommodation
        </button>
        <button 
          className={tab === 'flight' ? 'active' : ''} 
          onClick={() => { setTab('flight'); setOpenIndex(null); }}
        >
          Flights
        </button>
      </div>

      <div className="faq-section">
        <h3>{tab === 'hotel' ? 'Account & Booking' : 'Travel Guides & Booking'}</h3>
        {faqs[tab].map((item, i) => (
          <div 
            key={i} 
            className="faq-item" 
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <div className="faq-question">
              <span>{item.q}</span>
              {openIndex === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
            {openIndex === i && <div className="faq-answer">{item.a}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};
