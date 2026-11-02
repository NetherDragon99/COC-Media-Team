import React from 'react';
import { AppSettings, Language } from '../types.ts';
import { translations } from '../i18n.ts';

interface FooterProps {
  settings: AppSettings;
  language: Language;
}

export const Footer: React.FC<FooterProps> = ({ settings, language }) => {
  const t = translations[language];

  return (
    <footer className="py-6 border-t border-white/[0.08] backdrop-blur-md bg-[#000000]/75 text-xs text-neutral-400 relative z-10 mb-16 md:mb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        
        {/* Brand Name & Version Badge */}
        <div className="flex items-center gap-2.5">
          <span className="font-extrabold text-white text-sm tracking-tight">
            {settings.appName || 'COC Media Team'}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.08] text-neutral-300 border border-white/10">
            {settings.version || 'v1.0.0'}
          </span>
        </div>

        {/* Developer Credit ONLY */}
        <div className="text-neutral-400 text-xs">
          {t.designedAndDevelopedBy}
        </div>

      </div>
    </footer>
  );
};
