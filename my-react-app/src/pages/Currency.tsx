import { useState } from 'react';
import { ChevronLeft, Check, Search } from 'lucide-react';
import '../styles/Currency.css';

interface CurrencyProps {
  setLocalView: (v: string) => void;
  currentCurrency: string;
  setCurrentCurrency: (curr: { name: string; code: string }) => void;
}

export const Currency = ({ setLocalView, currentCurrency, setCurrentCurrency }: CurrencyProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const allCurrencies = [
    { name: 'Malaysian Ringgit', code: 'RM | MYR' },
    { name: 'US Dollar', code: '$ | USD' },
    { name: 'Chinese Yuan', code: '¥ | RMB' },
    { name: 'British Pound', code: '£ | GBP' },
    { name: 'Australian Dollar', code: 'AUD | AUD' },
  ];

  const filtered = allCurrencies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (curr: { name: string; code: string }) => {
    setCurrentCurrency(curr);
    
    localStorage.setItem('userCurrency', JSON.stringify(curr));
    
    setLocalView('main');
  };

  return (
    <div className="currency-page fade-in">
      {/* 头部导航 */}
      <div className="currency-header">
        <ChevronLeft onClick={() => setLocalView('main')} className="back-icon" />
        <span>Select your currency</span>
      </div>

      {/* 搜索栏 */}
      <div className="search-container">
        <div className="search-bar">
          <Search size={18} />
          <input
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="currency-list-container">
        <p className="list-section-label">Choose a currency</p>
        
        {filtered.length > 0 ? (
          filtered.map((curr, i) => {
            const isSelected = currentCurrency === curr.code;

            return (
              <div 
                key={i} 
                className="currency-row" 
                onClick={() => handleSelect(curr)}
              >
                <div className="row-left">
                  {isSelected ? (
                    <Check size={18} color="#1a73e8" />
                  ) : (
                    <div style={{ width: 18 }} />
                  )}
                  <span style={{ 
                    color: isSelected ? '#1a73e8' : '#333',
                    fontWeight: isSelected ? '600' : 'normal' 
                  }}>
                    {curr.name}
                  </span>
                </div>
                <span className="currency-code-text">{curr.code}</span>
              </div>
            );
          })
        ) : (
          <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            <p>No results found</p>
          </div>
        )}
      </div>
    </div>
  );
};
