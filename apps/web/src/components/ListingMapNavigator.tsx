import {useCallback, useEffect, useMemo, useState} from 'react';
import {AdvancedMarker, APIProvider, InfoWindow, Map as GoogleMapView, useMap, useMapsLibrary} from '@vis.gl/react-google-maps';
import {ArrowUpRight, LocateFixed, MapPin, Navigation, RefreshCw} from 'lucide-react';
import type {ListingDto} from '@other-half/contracts';
import {CITY_THEMES} from '../data/indiaData';
import {getListings} from '../services/listings';
import type {CityId, LatLngLiteral, TravelMode} from '../types';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '');
const PAGE_SIZE = 50;
type RouteSummary = {distanceKm: number; durationMinutes: number};
type ComputedRoute = {
  distanceMeters?: number;
  durationMillis?: number;
  viewport?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral;
  createPolylines?: () => google.maps.Polyline[];
};

function RouteOverlay({origin, destination, mode, onResult}: {
  origin: LatLngLiteral; destination: LatLngLiteral | null; mode: TravelMode;
  onResult: (summary: RouteSummary | null, error: string) => void;
}) {
  const map = useMap();
  const routes = useMapsLibrary('routes');
  useEffect(() => {
    let cancelled = false;
    let lines: google.maps.Polyline[] = [];
    const calculate = async () => {
      if (!destination) { onResult(null, ''); return; }
      if (!map || !routes) { onResult(null, 'Route service is not available.'); return; }
      try {
        const Route = (routes as unknown as {Route?: {computeRoutes?: (request: unknown) => Promise<{routes?: ComputedRoute[]}>}}).Route;
        if (!Route?.computeRoutes) throw new Error('Route service is unavailable.');
        const result = await Route.computeRoutes({origin, destination, travelMode: mode, fields: ['path', 'distanceMeters', 'durationMillis', 'viewport']});
        if (cancelled) return;
        const route = result.routes?.[0];
        if (!route || typeof route.distanceMeters !== 'number' || typeof route.durationMillis !== 'number') throw new Error('No route is available for this origin and listing.');
        lines = typeof route.createPolylines === 'function' ? route.createPolylines() : [];
        lines.forEach((line) => {line.setOptions({strokeColor: '#F05A4A', strokeWeight: 5, strokeOpacity: 0.9}); line.setMap(map);});
        if (route.viewport) map.fitBounds(route.viewport);
        else {const bounds = new google.maps.LatLngBounds(); bounds.extend(origin); bounds.extend(destination); map.fitBounds(bounds);}
        onResult({distanceKm: route.distanceMeters / 1000, durationMinutes: Math.max(1, Math.round(route.durationMillis / 60000))}, '');
      } catch (error) {
        if (!cancelled) {
          const details = String(error);
          const message = /RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|429/i.test(details)
            ? 'Live routing is temporarily at capacity. You can still open directions in Google Maps.'
            : /No route is available/i.test(details)
              ? 'Google Maps could not find this travel mode for the selected route. Try another mode or open directions in Google Maps.'
              : 'Could not calculate this route. Try again or open directions in Google Maps.';
          onResult(null, message);
        }
      }
    };
    void calculate();
    return () => {cancelled = true; lines.forEach((line) => line.setMap(null));};
  }, [destination?.lat, destination?.lng, map, mode, onResult, origin.lat, origin.lng, routes]);
  return null;
}

export function ListingMapNavigator({cityId, neighborhood, onBrowseHomes}: {
  cityId: CityId; neighborhood: string; onBrowseHomes: () => void;
}) {
  const city = CITY_THEMES[cityId];
  const [listings, setListings] = useState<ListingDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<LatLngLiteral>(city.defaultOrigin.position);
  const [originLabel, setOriginLabel] = useState(city.defaultOrigin.label);
  const [mode, setMode] = useState<TravelMode>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeError, setRouteError] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const selected = listings.find((item) => item.id === selectedId) ?? null;
  const positioned = useMemo(() => listings.filter((item) => item.approximateLocation), [listings]);
  const selectedPoint = selected?.approximateLocation ? {lat: selected.approximateLocation.latitude, lng: selected.approximateLocation.longitude} : null;

  useEffect(() => {
    setOrigin(city.defaultOrigin.position);
    setOriginLabel(city.defaultOrigin.label);
  }, [city]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setListings([]); setCursor(null); setSelectedId(null);
    void getListings({cityId, ...(neighborhood !== 'All Areas' ? {neighborhood} : {}), limit: PAGE_SIZE}, controller.signal)
      .then((page) => {if (!controller.signal.aborted) {setListings(page.items); setCursor(page.nextCursor);}})
      .catch((cause: unknown) => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load map listings.');})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [cityId, neighborhood]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true); setError('');
    try {
      const page = await getListings({cityId, ...(neighborhood !== 'All Areas' ? {neighborhood} : {}), cursor, limit: PAGE_SIZE});
      setListings((current) => [...current, ...page.items]); setCursor(page.nextCursor);
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not load more listings.');}
    finally {setLoadingMore(false);}
  };

  const useLocation = () => {
    if (!navigator.geolocation) {setLocationStatus('Location is not supported by this browser. Routing from the city hub.'); return;}
    setLocationStatus('Waiting for location permission…');
    navigator.geolocation.getCurrentPosition(({coords}) => {
      setOrigin({lat: coords.latitude, lng: coords.longitude}); setOriginLabel('Your current location'); setLocationStatus('');
    }, () => setLocationStatus('Location was unavailable or permission was declined. You can keep using the city hub origin.'), {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000});
  };

  const handleRouteResult = useCallback((summary: RouteSummary | null, message: string) => {setRouteSummary(summary); setRouteError(message);}, []);
  const mapsUrl = selectedPoint ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${selectedPoint.lat},${selectedPoint.lng}&travelmode=${mode === 'WALKING' ? 'walking' : mode === 'TRANSIT' ? 'transit' : mode === 'TWO_WHEELER' ? 'two-wheeler' : 'driving'}` : '';
  const money = (amount: number) => new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(amount);

  return <section className="overflow-hidden rounded-3xl bg-white shadow-kinship-1" aria-label="Housing listings map and commute planner">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-900/5 p-5">
      <div><h1 className="flex items-center gap-2 text-xl font-extrabold"><Navigation className="h-5 w-5 text-[#F05A4A]"/> Homes &amp; commute map</h1>
        <p className="mt-1 text-sm text-[#64748B]">Browse active homes in {city.name} and estimate travel to an owner-approved approximate area.</p></div>
      <button type="button" onClick={onBrowseHomes} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50">Browse homes</button>
    </header>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="p-3 sm:p-4">
        {!MAPS_API_KEY ? <div role="status" className="grid min-h-[420px] place-content-center rounded-2xl bg-[#F4F2EE] p-6 text-center"><MapPin className="mx-auto h-8 w-8 text-[#F05A4A]"/><h2 className="mt-3 font-bold">Map view needs a Google Maps key</h2><p className="mx-auto mt-2 max-w-lg text-sm text-[#64748B]">Set a browser-restricted <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>apps/web/.env.local</code>. You can still browse homes as cards.</p><button onClick={onBrowseHomes} className="mx-auto mt-4 rounded-full bg-[#1E293B] px-4 py-2 text-sm font-bold text-white">Browse homes</button></div> : <div className="h-[420px] overflow-hidden rounded-2xl sm:h-[560px]">
          <APIProvider apiKey={MAPS_API_KEY} libraries={['marker', 'routes']} language="en" region="IN">
            <GoogleMapView key={cityId} mapId="DEMO_MAP_ID" defaultCenter={city.center} defaultZoom={12} gestureHandling="greedy" streetViewControl={false} mapTypeControl={false} className="h-full w-full">
              <AdvancedMarker position={origin} title={originLabel}><div className="rounded-full border-2 border-white bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow">You</div></AdvancedMarker>
              {positioned.map((listing) => <AdvancedMarker key={listing.id} position={{lat: listing.approximateLocation!.latitude, lng: listing.approximateLocation!.longitude}} title={`${listing.title}, ${money(listing.monthlyRent)}/month`} onClick={() => setSelectedId(listing.id)}>
                <button type="button" aria-label={`Show ${listing.title}`} className={`rounded-full border-2 border-white px-3 py-1.5 text-xs font-extrabold text-white shadow-lg ${listing.id === selectedId ? 'bg-[#F05A4A]' : 'bg-[#1E293B]'}`}>{money(listing.monthlyRent)}</button>
              </AdvancedMarker>)}
              {selectedPoint && selected && <InfoWindow position={selectedPoint} onCloseClick={() => setSelectedId(null)}><div className="max-w-64 p-1"><p className="font-bold text-slate-900">{selected.title}</p><p className="mt-1 text-xs text-slate-600">{selected.neighborhood} · {money(selected.monthlyRent)}/month</p><p className="mt-1 text-[11px] text-slate-500">Approximate area only</p></div></InfoWindow>}
              <RouteOverlay origin={origin} destination={selectedPoint} mode={mode} onResult={handleRouteResult}/>
            </GoogleMapView>
          </APIProvider>
        </div>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#64748B]"><span>{positioned.length} approximate pins · {listings.length} listings loaded</span><span>Pin locations are rounded for privacy.</span></div>
      </div>
      <aside className="border-t border-slate-900/5 p-4 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between gap-2"><div><h2 className="font-extrabold">Commute planner</h2><p className="mt-0.5 text-xs text-[#64748B]">From {originLabel}</p></div><button type="button" onClick={useLocation} aria-label="Use current location" title="Use current location" className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"><LocateFixed className="h-4 w-4"/></button></div>
        <p className="mt-2 text-[11px] leading-4 text-slate-500">Optional location is shared with Google Maps to calculate routes. Other Half does not send it to its API or save it.</p>
        {locationStatus && <p role="status" className="mt-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900">{locationStatus}</p>}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">{([['DRIVING','Drive'],['TWO_WHEELER','2-wheeler'],['TRANSIT','Transit'],['WALKING','Walk']] as const).map(([id,label]) => <button key={id} onClick={() => setMode(id)} className={`rounded-lg px-2 py-2 text-xs font-bold ${mode === id ? 'bg-white text-[#1E293B] shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div>
        {selected && <div className="mt-3 rounded-2xl bg-[#FFF6F3] p-3"><p className="text-sm font-extrabold">{selected.title}</p><p className="mt-1 text-xs text-[#64748B]">{selected.neighborhood} · {money(selected.monthlyRent)}/month</p>{routeSummary && <p className="mt-2 text-sm font-bold text-[#AD2A20]">Estimated: {routeSummary.distanceKm.toFixed(1)} km · ~{routeSummary.durationMinutes} min</p>}{routeError && <p role="status" className="mt-2 text-xs text-amber-900">{routeError}</p>}{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#AD2A20]">Open directions <ArrowUpRight className="h-3.5 w-3.5"/></a>}</div>}
        <h3 className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-500">Homes on this map</h3>
        <div className="max-h-[300px] space-y-2 overflow-y-auto lg:max-h-[380px]">
          {loading && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading active listings…</p>}
          {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-800">{error}<button onClick={() => setReloadKey((key) => key + 1)} className="ml-2 inline-flex items-center gap-1 font-bold"><RefreshCw className="h-3 w-3"/>Retry</button></div>}
          {!loading && !error && listings.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No active homes match this area yet.</p>}
          {listings.map((listing) => <button key={listing.id} onClick={() => setSelectedId(listing.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === listing.id ? 'border-[#F05A4A] bg-[#FFF6F3]' : 'border-slate-100 hover:bg-slate-50'}`}><span className="block truncate text-sm font-bold">{listing.title}</span><span className="mt-1 block text-xs text-[#64748B]">{listing.neighborhood} · {money(listing.monthlyRent)}/mo{!listing.approximateLocation && ' · no map pin'}</span></button>)}
        </div>
        {cursor && <button disabled={loadingMore} onClick={() => void loadMore()} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more homes'}</button>}
      </aside>
    </div>
  </section>;
}
