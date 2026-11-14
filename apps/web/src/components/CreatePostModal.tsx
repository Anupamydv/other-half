import React, {useState} from 'react';
import {Film, ImagePlus, MapPin, X} from 'lucide-react';
import {CITY_THEMES} from '../data/indiaData';
import {CityId} from '../types';

interface CreatePostModalProps {
  defaultCity: CityId;
  onClose: () => void;
  onPublish: (input: {
    cityId: CityId;
    neighborhood: string;
    postType: 'Room Available' | 'Looking for Flatmate' | 'City Reel';
    caption: string;
    rentPerMonth?: number;
    flatTitle?: string;
    flatPosition: {lat: number; lng: number};
    tags: string[];
    files: Array<{file: File; kind: 'image' | 'video'}>;
  }) => Promise<unknown>;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  defaultCity,
  onClose,
  onPublish,
}) => {
  const [cityId, setCityId] = useState<CityId>(defaultCity);
  const city = CITY_THEMES[cityId];
  const [neighborhood, setNeighborhood] = useState(
    city.neighborhoods.find((n) => n !== 'All Areas') || 'Indiranagar'
  );
  const [postType, setPostType] = useState<
    'Room Available' | 'Looking for Flatmate' | 'City Reel'
  >('Room Available');
  const [flatTitle, setFlatTitle] = useState('');
  const [rentStr, setRentStr] = useState('24000');
  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('Sunlit, Metro Walk, Verified');
  const [files, setFiles] = useState<
    Array<{file: File; kind: 'image' | 'video'; previewUrl: string}>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCityChange = (nextCity: CityId) => {
    setCityId(nextCity);
    const firstArea = CITY_THEMES[nextCity].neighborhoods.find(
      (n) => n !== 'All Areas'
    );
    if (firstArea) setNeighborhood(firstArea);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    const mapped = selected.map((file) => ({
      file,
      kind: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
      previewUrl: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...mapped].slice(0, 5));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim()) {
      setError('Add a short caption describing the room, flatmate vibe, or reel.');
      return;
    }
    if (files.length === 0) {
      setError('Upload at least one photo or video walkthrough to publish.');
      return;
    }

    setSubmitting(true);
    try {
      const parsedRent = Number(rentStr.replace(/[^0-9]/g, ''));
      // Place pin near the selected city's center/landmark with slight deterministic offset
      const matchingLandmark =
        city.landmarks.find((l) =>
          l.area.toLowerCase().includes(neighborhood.toLowerCase())
        ) || city.landmarks[0];
      const flatPosition = matchingLandmark
        ? {
            lat: matchingLandmark.position.lat + 0.004,
            lng: matchingLandmark.position.lng - 0.003,
          }
        : city.center;

      await onPublish({
        cityId,
        neighborhood,
        postType,
        caption,
        rentPerMonth: parsedRent > 0 ? parsedRent : undefined,
        flatTitle: flatTitle.trim() || `${neighborhood} Sunlit Flat`,
        flatPosition,
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 4),
        files: files.map(({file, kind}) => ({file, kind})),
      });
      onClose();
    } catch {
      setError('Could not publish post. Please try smaller files.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create photo or video post"
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-kinship-3 max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#1E293B]">
              Post Photo or Video Reel
            </h2>
            <p className="text-xs text-[#64748B]">
              Share a flat tour, room photo, or locality reel to the feed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-full bg-[#F4F2EE] flex items-center justify-center text-[#1E293B] hover:bg-[#EAE6DF]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Media Picker */}
          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-2">
              Photos or Walkthrough Video
            </label>
            <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#E1BFBA] bg-[#FFF8F0] hover:bg-[#FFEBE7]/60 p-5 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 text-[#F05A4A]">
                <ImagePlus className="w-5 h-5" />
                <Film className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-[#1E293B]">
                Tap to select Photos or MP4 / MOV Video
              </span>
              <span className="text-[11px] text-[#64748B]">
                Up to 5 media items · Stored locally for instant playback
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </label>

            {files.length > 0 && (
              <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
                {files.map((item, idx) => (
                  <div
                    key={idx}
                    className="relative w-24 h-24 rounded-xl overflow-hidden bg-[#F4F2EE] shrink-0 border border-slate-900/10"
                  >
                    {item.kind === 'video' ? (
                      <video
                        src={item.previewUrl}
                        muted
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={item.previewUrl}
                        alt={`Upload preview ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Remove item"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Post Type */}
          <div className="flex flex-wrap gap-2">
            {(['Room Available', 'Looking for Flatmate', 'City Reel'] as const).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPostType(type)}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors ${
                    postType === type
                      ? 'bg-[#F05A4A] text-white'
                      : 'bg-[#F4F2EE] text-[#1E293B]'
                  }`}
                >
                  {type}
                </button>
              )
            )}
          </div>

          {/* City & Neighborhood */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1">
                Metro City
              </label>
              <select
                value={cityId}
                onChange={(e) => handleCityChange(e.target.value as CityId)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4F2EE] text-xs font-semibold text-[#1E293B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
              >
                {Object.values(CITY_THEMES).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1">
                Locality
              </label>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F4F2EE] text-xs font-semibold text-[#1E293B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
              >
                {city.neighborhoods
                  .filter((n) => n !== 'All Areas')
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Flat Title & Monthly Rent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1">
                Headline / Flat Name
              </label>
              <input
                type="text"
                value={flatTitle}
                onChange={(e) => setFlatTitle(e.target.value)}
                placeholder="e.g., Bright 2BHK Balcony Room"
                className="w-full h-11 px-4 rounded-xl bg-[#F4F2EE] text-xs text-[#1E293B] placeholder-[#64748B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1">
                Monthly Rent (₹)
              </label>
              <input
                type="number"
                value={rentStr}
                onChange={(e) => setRentStr(e.target.value)}
                placeholder="24000"
                className="w-full h-11 px-4 rounded-xl bg-[#F4F2EE] text-xs text-[#1E293B] tabular-nums focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
              />
            </div>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-1">
              Caption
            </label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Share the sunlight, flatmate vibe, metro distance, or famous cafes nearby..."
              className="w-full p-3.5 rounded-2xl bg-[#F4F2EE] text-xs text-[#1E293B] placeholder-[#64748B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-[#F4F2EE] text-xs text-[#1E293B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
            <MapPin className="w-3.5 h-3.5 text-[#F05A4A] shrink-0" />
            <span>
              Automatically pins near {neighborhood}, {city.name} for live map navigation.
            </span>
          </div>

          {error && (
            <div className="text-xs font-semibold text-[#BA1A1A] bg-[#FFDAD6] px-3.5 py-2 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-full bg-[#F05A4A] text-white text-sm font-bold hover:bg-[#e04c3c] disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {submitting ? 'Publishing...' : 'Publish to Other Half Feed'}
          </button>
        </form>
      </div>
    </div>
  );
};
