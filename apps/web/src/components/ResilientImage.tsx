import React, {useState} from 'react';
import {Home} from 'lucide-react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF8F0] via-[#F4F2EE] to-[#FFE8E3] text-[#59413D] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center mb-2 shadow-sm">
          <Home className="w-5 h-5 text-[#F05A4A]" />
        </div>
        {fallbackTitle && (
          <span className="text-xs font-semibold text-[#1E293B] line-clamp-2 max-w-[160px]">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
