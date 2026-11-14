import {useState} from 'react';
import {APIProvider, AdvancedMarker, InfoWindow, Map as GoogleMapView} from '@vis.gl/react-google-maps';
import {MapPin} from 'lucide-react';
import type {ListingDto} from '@other-half/contracts';
import type {CityId} from '../types';
import {CITY_THEMES} from '../data/indiaData';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '');

export function ListingsMap({cityId, listings}: {cityId: CityId; listings: ListingDto[]}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const positioned = listings.filter((listing) => listing.approximateLocation !== null);
  const selected = positioned.find((listing) => listing.id === selectedId);
  const center = CITY_THEMES[cityId].center;

  if (!MAPS_API_KEY) return <div role="status" className="rounded-3xl bg-white p-8 text-center shadow-kinship-1">
    <MapPin className="mx-auto h-8 w-8 text-[#F05A4A]" />
    <h2 className="mt-3 font-bold text-[#1E293B]">Map view needs a Google Maps key</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#64748B]">Set a browser-restricted <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>apps/web/.env.local</code>. Listings are still available as cards, and only owners who add an approximate pin appear on the map.</p>
  </div>;

  return <section className="overflow-hidden rounded-3xl bg-white p-3 shadow-kinship-1" aria-label="Map of listings with approximate locations">
    <p className="px-2 pb-3 text-xs font-semibold text-[#64748B]">Showing {positioned.length} approximate map {positioned.length === 1 ? 'pin' : 'pins'} from {listings.length} loaded listings. Owners choose whether to add a pin.</p>
    <div className="h-[520px] overflow-hidden rounded-2xl">
      <APIProvider apiKey={MAPS_API_KEY}>
        <GoogleMapView
          mapId="DEMO_MAP_ID"
          defaultCenter={selected?.approximateLocation ? {lat: selected.approximateLocation.latitude, lng: selected.approximateLocation.longitude} : center}
          defaultZoom={11}
          gestureHandling="greedy"
          streetViewControl={false}
          mapTypeControl={false}
          className="h-full w-full"
        >
          {positioned.map((listing) => {
            const location = listing.approximateLocation!;
            const rent = new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(listing.monthlyRent);
            return <AdvancedMarker
              key={listing.id}
              position={{lat: location.latitude, lng: location.longitude}}
              title={`${listing.title}, ${rent} per month`}
              onClick={() => setSelectedId(listing.id)}
            >
              <button type="button" aria-label={`Show ${listing.title}`} className="rounded-full border-2 border-white bg-[#1E293B] px-3 py-1.5 text-xs font-extrabold text-white shadow-lg">{rent}</button>
            </AdvancedMarker>;
          })}
          {selected?.approximateLocation && <InfoWindow
            position={{lat: selected.approximateLocation.latitude, lng: selected.approximateLocation.longitude}}
            onCloseClick={() => setSelectedId(null)}
          >
            <div className="max-w-64 p-1">
              <p className="font-bold text-slate-900">{selected.title}</p>
              <p className="mt-1 text-xs text-slate-600">{selected.neighborhood} · {new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(selected.monthlyRent)}/month</p>
              <a className="mt-2 inline-block text-xs font-bold text-[#AD2A20]" href={`https://www.google.com/maps/search/?api=1&query=${selected.approximateLocation.latitude},${selected.approximateLocation.longitude}`} target="_blank" rel="noreferrer">Open approximate area in Google Maps</a>
            </div>
          </InfoWindow>}
        </GoogleMapView>
      </APIProvider>
    </div>
  </section>;
}
