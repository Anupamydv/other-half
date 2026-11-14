import {APIProvider, AdvancedMarker, Map as GoogleMapView} from '@vis.gl/react-google-maps';
import {MapPin, X} from 'lucide-react';
import type {CityId} from '../types';
import {CITY_THEMES} from '../data/indiaData';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '');

interface Props {
  cityId: CityId;
  value: {latitude: number; longitude: number} | null;
  onChange: (value: {latitude: number; longitude: number} | null) => void;
}

export function ApproximateMapPicker({cityId, value, onChange}: Props) {
  const center = CITY_THEMES[cityId].center;
  return <fieldset className="space-y-2">
    <legend className="text-xs font-bold text-[#1E293B]">Approximate neighborhood pin <span className="font-medium text-[#64748B]">(optional)</span></legend>
    <p className="text-xs leading-5 text-[#64748B]">Click near the home to show its general area. The server rounds coordinates to about 1 km before saving; an exact address or exact pin is never shared.</p>
    {MAPS_API_KEY ? <div className="h-64 overflow-hidden rounded-xl border border-slate-200">
      <APIProvider apiKey={MAPS_API_KEY}>
        <GoogleMapView
          mapId="DEMO_MAP_ID"
          defaultCenter={value ? {lat: value.latitude, lng: value.longitude} : center}
          defaultZoom={value ? 13 : 11}
          gestureHandling="cooperative"
          streetViewControl={false}
          mapTypeControl={false}
          onClick={(event) => {
            const point = event.detail.latLng;
            if (point) onChange({latitude: point.lat, longitude: point.lng});
          }}
          className="h-full w-full"
        >
          {value && <AdvancedMarker position={{lat: value.latitude, lng: value.longitude}} title="Approximate neighborhood location"><MapPin className="h-8 w-8 fill-[#F05A4A] text-white drop-shadow" /></AdvancedMarker>}
        </GoogleMapView>
      </APIProvider>
    </div> : <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Map selection is unavailable because a restricted Google Maps browser key is not configured. You can still publish the listing without a map pin.</p>}
    {value && <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600"><X className="h-3.5 w-3.5" /> Clear map pin</button>}
  </fieldset>;
}
