import React from 'react';

export const BrandMark: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => {
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  return (
    <div
      className={`${dim} rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm shrink-0`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="13" r="7" strokeOpacity="0.9" />
        <path d="M12 6c0-2.5 2.2-4 4.5-4 0 2.5-1.7 4-4.5 4Z" fill="currentColor" stroke="none" />
        <path d="M9.5 13l1.8 1.8 3.5-3.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
