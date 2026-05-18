/*import React, { Suspense } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '../styles/Language.css';

interface LanguagePageProps {
  onBack: () => void;
}

const LanguageContent: React.FC<LanguagePageProps> = ({ onBack }) => {
  const { t, i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ms', name: 'Bahasa Malaysia', flag: '🇲🇾' },
    { code: 'zh', name: '简体中文', flag: '🇨🇳' },
  ];

  return (
    <div className="language-container fade-in">
      <div className="lang-header">
        <ChevronLeft onClick={onBack} className="back-icon" size={24} style={{ cursor: 'pointer' }} />
        <span>{t('select_language')}</span>
      </div>

      <div className="lang-content">
        <div className="lang-section-title">Suggested languages</div>
        <div className="lang-list">
          {languages.map((lang) => (
            <div 
              key={lang.code} 
              className="lang-row" 
              onClick={() => i18n.changeLanguage(lang.code)}
            >
              <span className="lang-flag">{lang.flag}</span>
              <span className={`lang-name ${i18n.language === lang.code ? 'active' : ''}`}>
                {lang.name}
              </span>
              {i18n.language === lang.code && <Check className="lang-check" size={18} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 导出时包裹 Suspense
const LanguagePage: React.FC<LanguagePageProps> = (props) => (
  <Suspense fallback={<div style={{ padding: '20px' }}>Loading...</div>}>
    <LanguageContent {...props} />
  </Suspense>
);

export default LanguagePage;*/
