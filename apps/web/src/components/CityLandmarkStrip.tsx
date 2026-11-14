import React from 'react';
import {Compass, Landmark, Sparkles, Train} from 'lucide-react';
import {CityTheme, LandmarkPlace} from '../types';

interface CityLandmarkStripProps {
  city: CityTheme;
  onFocusLandmark?: (landmark: LandmarkPlace) => void;
}

export const CityLandmarkStrip: React.FC<CityLandmarkStripProps> = ({
  city,
  onFocusLandmark,
}) => {
  return (
    <section
      aria-label={`${city.name} famous and new places`}
      className="bg-white rounded-[24px] p-4 md:p-5 shadow-kinship-1 border border-slate-900/5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-[#1E293B] tracking-tight">
              {city.name} Pulse — Famous &amp; New Places
            </h2>
          </div>
          <p className="text-xs md:text-sm text-[#64748B] mt-0.5">{city.tagline}</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-[#59413D] bg-[#F4F2EE] px-3 py-1.5 rounded-full whitespace-nowrap shrink-0">
          <Train className="w-3.5 h-3.5 text-[#F05A4A]" />
          <span>{city.metroLine}</span>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {city.landmarks.map((place) => {
          const isFamous = place.category === 'famous';
          return (
            <button
              key={place.id}
              type="button"
              onClick={() => onFocusLandmark?.(place)}
              className="group text-left min-w-[215px] max-w-[235px] shrink-0 rounded-2xl bg-[#FAF9F6] hover:bg-[#FFF8F0] border border-slate-900/5 hover:border-[#F05A4A]/30 p-3.5 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isFamous
                      ? 'bg-[#E08738]/12 text-[#914C00]'
                      : 'bg-[#10B981]/12 text-[#006947]'
                  }`}
                >
                  {isFamous ? (
                    <Landmark className="w-3 h-3" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isFamous ? 'Famous Landmark' : 'New Spot'}
                </span>
                <Compass className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#F05A4A] transition-colors" />
              </div>
              <div className="text-sm font-bold text-[#1E293B] truncate">
                {place.name}
              </div>
              <div className="text-xs text-[#64748B] mt-0.5 truncate">{place.area}</div>
              <p className="text-xs text-[#59413D] mt-1.5 line-clamp-2 leading-relaxed">
                {place.tagline}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
};
