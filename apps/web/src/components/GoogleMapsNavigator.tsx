import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMapView,
  Pin,
  useAdvancedMarkerRef,
  useApiIsLoaded,
  useApiLoadingStatus,
  APILoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Bike,
  Car,
  Crosshair,
  ExternalLink,
  Footprints,
  Landmark,
  MapPin,
  Navigation,
  Sparkles,
  Train,
} from 'lucide-react';
import {
  CityTheme,
  LandmarkPlace,
  LatLngLiteral,
  RoommateProfile,
  TravelMode,
} from '../types';
import {ResilientImage} from './ResilientImage';

const MAPS_API_KEY: string =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '') ||
  '';

interface RouteStats {
  distanceKm: number;
  durationMins: number;
  steps: string[];
}

interface RouteLayerProps {
  origin: LatLngLiteral | null;
  destination: LatLngLiteral | null;
  travelMode: TravelMode;
  onRouteCalculated: (stats: RouteStats | null, errorMsg: string | null) => void;
}

const RouteLayer: React.FC<RouteLayerProps> = ({
  origin,
  destination,
  travelMode,
  onRouteCalculated,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    // Cleanup old polylines whenever dependencies change
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!origin || !destination) {
      onRouteCalculated(null, null);
      return;
    }

    if (!map || !routesLib) {
      onRouteCalculated(null, 'Live route calculation is not available right now.');
      return;
    }

    let cancelled = false;

    const compute = async () => {
      try {
        const RouteClass = (routesLib as unknown as {Route?: unknown}).Route as
          | {
              computeRoutes?: (req: unknown) => Promise<{routes?: unknown[]}>;
              new (): {computeRoutes: (req: unknown) => Promise<{routes?: unknown[]}>};
            }
          | undefined;

        const request = {
          origin,
          destination,
          travelMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
        };

        let response: {routes?: unknown[]} | null = null;
        if (RouteClass && typeof RouteClass.computeRoutes === 'function') {
          response = await RouteClass.computeRoutes(request);
        } else if (RouteClass) {
          const instance = new RouteClass();
          response = await instance.computeRoutes(request);
        }

        if (cancelled) return;

        const primaryRoute = response?.routes?.[0] as
          | {
              createPolylines?: () => google.maps.Polyline[];
              polyline?: {encodedPolyline?: string};
              distanceMeters?: number;
              durationMillis?: number;
              viewport?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral;
              legs?: Array<{
                steps?: Array<{
                  navigationInstruction?: {instructions?: string};
                }>;
              }>;
            }
          | undefined;

        if (!primaryRoute) {
          throw new Error('No route found between your location and this flat.');
        }

        if (typeof primaryRoute.createPolylines === 'function') {
          const created = primaryRoute.createPolylines();
          created.forEach((polyline) => {
            polyline.setOptions({
              strokeColor: '#F05A4A',
              strokeWeight: 5,
              strokeOpacity: 0.92,
            });
            polyline.setMap(map);
          });
          polylinesRef.current = created;
        }

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        } else {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(origin);
          bounds.extend(destination);
          map.fitBounds(bounds);
        }

        if (
          typeof primaryRoute.distanceMeters !== 'number' ||
          typeof primaryRoute.durationMillis !== 'number'
        ) {
          throw new Error('The routing provider did not return route distance and duration.');
        }
        const distanceMeters = primaryRoute.distanceMeters;
        const durationMillis = primaryRoute.durationMillis;

        const stepList: string[] = [];
        primaryRoute.legs?.[0]?.steps?.forEach((st) => {
          if (st.navigationInstruction?.instructions) {
            stepList.push(st.navigationInstruction.instructions);
          }
        });

        onRouteCalculated(
          {
            distanceKm: distanceMeters / 1000,
            durationMins: Math.max(1, Math.round(durationMillis / 60000)),
            steps: stepList.slice(0, 5),
          },
          null
        );
      } catch (err) {
        if (cancelled) return;
        const providerMessage = err instanceof Error ? err.message : String(err);
        const quotaError = /RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|429/i.test(providerMessage);
        onRouteCalculated(
          null,
          quotaError
            ? 'Live route service is temporarily unavailable. Try again later or open directions in Google Maps.'
            : 'Could not calculate a live route. Try again or open directions in Google Maps.'
        );
      }
    };

    compute();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, origin, destination, travelMode, onRouteCalculated]);

  return null;
};

interface MapCameraSyncProps {
  center: LatLngLiteral;
  focusPoint?: LatLngLiteral | null;
}

const MapCameraSync: React.FC<MapCameraSyncProps> = ({center, focusPoint}) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (focusPoint) {
      map.panTo(focusPoint);
      map.setZoom(14);
    } else {
      map.panTo(center);
      map.setZoom(12);
    }
  }, [map, center, focusPoint]);

  return null;
};

interface FlatMarkerWithRefProps {
  flat: RoommateProfile;
  isSelected: boolean;
  onSelect: (
    flat: RoommateProfile,
    marker: google.maps.marker.AdvancedMarkerElement
  ) => void;
}

const FlatMarkerWithRef: React.FC<FlatMarkerWithRefProps> = ({
  flat,
  isSelected,
  onSelect,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const rentK = Math.round((flat.roomRent || flat.rentBudget) / 1000);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={flat.flatPosition}
      zIndex={isSelected ? 1000 : 500}
      onClick={() => {
        if (marker) {
          onSelect(flat, marker);
        }
      }}
    >
      <div
        className={`px-2.5 py-1 rounded-full text-xs font-bold tabular-nums shadow-md border transition-transform cursor-pointer ${
          isSelected
            ? 'bg-[#F05A4A] text-white border-white scale-110'
            : 'bg-white text-[#1E293B] border-slate-900/10 hover:scale-105'
        }`}
      >
        ₹{rentK}k
      </div>
    </AdvancedMarker>
  );
};

interface GoogleMapsNavigatorProps {
  city: CityTheme;
  flats: RoommateProfile[];
  selectedFlatId: string | null;
  onSelectFlat: (flat: RoommateProfile) => void;
  onOpenFlatDetail: (flat: RoommateProfile) => void;
  focusedLandmark?: LandmarkPlace | null;
  compact?: boolean;
}

const InnerMapCanvas: React.FC<
  GoogleMapsNavigatorProps & {
    origin: LatLngLiteral;
    travelMode: TravelMode;
    onRouteCalculated: (stats: RouteStats | null, errorMsg: string | null) => void;
  }
> = ({
  city,
  flats,
  selectedFlatId,
  onSelectFlat,
  onOpenFlatDetail,
  focusedLandmark,
  origin,
  travelMode,
  onRouteCalculated,
}) => {
  const isLoaded = useApiIsLoaded();
  const status = useApiLoadingStatus();
  const [infoAnchor, setInfoAnchor] = useState<{
    flat: RoommateProfile;
    marker: google.maps.marker.AdvancedMarkerElement;
  } | null>(null);

  const selectedFlat = useMemo(
    () => flats.find((f) => f.id === selectedFlatId) || null,
    [flats, selectedFlatId]
  );

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-full min-h-[380px] rounded-2xl bg-[#F4F2EE] flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="w-8 h-8 text-[#F05A4A] mb-2" />
        <p className="text-sm font-bold text-[#1E293B]">
          Google Maps could not initialize in this preview
        </p>
        <p className="text-xs text-[#64748B] mt-1 max-w-sm">
          You can still launch live turn-by-turn directions directly in Google Maps using the navigation button below.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-2xl overflow-hidden bg-[#F4F2EE]">
      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FAF9F6]/80 backdrop-blur-sm">
          <span className="text-xs font-semibold text-[#59413D]">
            Loading {city.name} map...
          </span>
        </div>
      )}
      <GoogleMapView
        mapId="DEMO_MAP_ID"
        defaultCenter={city.center}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI={false}
        streetViewControl={false}
        mapTypeControl={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="w-full h-full"
      >
        <MapCameraSync
          center={city.center}
          focusPoint={focusedLandmark?.position || null}
        />

        {/* User Exact / Selected Origin Marker */}
        <AdvancedMarker position={origin} title="Your Starting Location" zIndex={900}>
          <div className="flex items-center gap-1.5 bg-[#1E293B] text-white px-2.5 py-1 rounded-full shadow-md border-2 border-white text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>You</span>
          </div>
        </AdvancedMarker>

        {/* Flat Listing Pins */}
        {flats.map((flat) => (
          <FlatMarkerWithRef
            key={flat.id}
            flat={flat}
            isSelected={flat.id === selectedFlatId}
            onSelect={(f, marker) => {
              onSelectFlat(f);
              setInfoAnchor({flat: f, marker});
            }}
          />
        ))}

        {/* City Famous & New Landmark Pins */}
        {city.landmarks.map((place) => (
          <AdvancedMarker key={place.id} position={place.position} title={place.name} zIndex={200}>
            <Pin
              background={place.category === 'famous' ? '#E08738' : '#10B981'}
              borderColor="#FFFFFF"
              glyphColor="#FFFFFF"
              scale={0.85}
            />
          </AdvancedMarker>
        ))}

        {infoAnchor && selectedFlat && infoAnchor.flat.id === selectedFlat.id && (
          <InfoWindow
            anchor={infoAnchor.marker}
            onCloseClick={() => setInfoAnchor(null)}
          >
            <div className="p-1 max-w-[200px]">
              <p className="text-xs font-bold text-[#1E293B]">
                {selectedFlat.flatTitle || selectedFlat.name}
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                {selectedFlat.neighborhood} · ₹
                {(selectedFlat.roomRent || selectedFlat.rentBudget).toLocaleString('en-IN')}/mo
              </p>
              <button
                type="button"
                onClick={() => onOpenFlatDetail(selectedFlat)}
                className="mt-1.5 text-[11px] font-bold text-[#F05A4A] hover:underline"
              >
                View Flat &amp; Split Rent
              </button>
            </div>
          </InfoWindow>
        )}

        <RouteLayer
          origin={origin}
          destination={selectedFlat ? selectedFlat.flatPosition : null}
          travelMode={travelMode}
          onRouteCalculated={onRouteCalculated}
        />
      </GoogleMapView>
    </div>
  );
};

export const GoogleMapsNavigator: React.FC<GoogleMapsNavigatorProps> = ({
  city,
  flats,
  selectedFlatId,
  onSelectFlat,
  onOpenFlatDetail,
  focusedLandmark,
  compact = false,
}) => {
  const [origin, setOrigin] = useState<LatLngLiteral>(city.defaultOrigin.position);
  const [originLabel, setOriginLabel] = useState<string>(city.defaultOrigin.label);
  const [isUsingGps, setIsUsingGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // When city switches and user hasn't locked real GPS inside that city, update default hub origin
  useEffect(() => {
    if (!isUsingGps) {
      setOrigin(city.defaultOrigin.position);
      setOriginLabel(city.defaultOrigin.label);
    }
  }, [city, isUsingGps]);

  const selectedFlat = useMemo(
    () => flats.find((f) => f.id === selectedFlatId) || flats[0] || null,
    [flats, selectedFlatId]
  );

  const requestExactGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation is unavailable in this browser. Using city hub origin.');
      return;
    }
    setGpsStatus('Locating your exact GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setOriginLabel('Your Exact GPS Location');
        setIsUsingGps(true);
        setGpsStatus(null);
      },
      () => {
        setIsUsingGps(false);
        setOrigin(city.defaultOrigin.position);
        setOriginLabel(city.defaultOrigin.label);
        setGpsStatus(
          `Location permission declined — routing from ${city.defaultOrigin.label}.`
        );
      },
      {enableHighAccuracy: true, timeout: 8000}
    );
  }, [city]);

  const handleRouteCalculated = useCallback(
    (stats: RouteStats | null, errorMsg: string | null) => {
      setRouteStats(stats);
      setRouteError(errorMsg);
    },
    []
  );

  const googleMapsExternalUrl = useMemo(() => {
    if (!selectedFlat) return '#';
    const gmMode =
      travelMode === 'WALKING'
        ? 'walking'
        : travelMode === 'TRANSIT'
          ? 'transit'
          : travelMode === 'TWO_WHEELER'
            ? 'two-wheeler'
            : 'driving';
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${selectedFlat.flatPosition.lat},${selectedFlat.flatPosition.lng}&travelmode=${gmMode}`;
  }, [origin, selectedFlat, travelMode]);

  return (
    <div className="bg-white rounded-[28px] p-4 md:p-5 shadow-kinship-1 border border-slate-900/5 flex flex-col gap-3.5 h-full">
      {/* Header & Live Origin Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base md:text-lg font-bold text-[#1E293B] tracking-tight flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#F05A4A]" />
            <span>Live Flat Navigation</span>
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            From <span className="font-semibold text-[#1E293B]">{originLabel}</span>
            {selectedFlat ? (
              <>
                {' '}
                to <span className="font-semibold text-[#F05A4A]">{selectedFlat.neighborhood}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={requestExactGps}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap shrink-0 active:scale-[0.98] ${
              isUsingGps
                ? 'bg-[#10B981]/12 text-[#006947] border border-[#10B981]/30'
                : 'bg-[#F4F2EE] text-[#1E293B] hover:bg-[#EAE6DF]'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isUsingGps ? 'Live GPS Active' : 'Use My Exact Location'}</span>
          </button>

          {isUsingGps && (
            <button
              type="button"
              onClick={() => {
                setIsUsingGps(false);
                setOrigin(city.defaultOrigin.position);
                setOriginLabel(city.defaultOrigin.label);
                setGpsStatus(null);
              }}
              className="text-xs font-semibold text-[#64748B] hover:text-[#1E293B] px-2 py-1"
            >
              Reset Hub
            </button>
          )}
        </div>
      </div>

      {gpsStatus && (
        <div className="text-xs text-[#59413D] bg-[#FFF8F0] px-3 py-2 rounded-xl border border-[#E08738]/20">
          {gpsStatus}
        </div>
      )}

      {/* Travel Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#F4F2EE]">
          {(
            [
              {id: 'DRIVING', label: 'Car', icon: Car},
              {id: 'TWO_WHEELER', label: '2-Wheeler', icon: Bike},
              {id: 'TRANSIT', label: 'Metro', icon: Train},
              {id: 'WALKING', label: 'Walk', icon: Footprints},
            ] as const
          ).map((mode) => {
            const Icon = mode.icon;
            const active = travelMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTravelMode(mode.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-[#1E293B] shadow-sm'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#F05A4A]' : ''}`} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Map Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-[#64748B]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F05A4A]" /> Flats
          </span>
          <span className="inline-flex items-center gap-1">
            <Landmark className="w-3 h-3 text-[#E08738]" /> Famous
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#10B981]" /> New Spots
          </span>
        </div>
      </div>

      {/* Interactive Map Container */}
      <div className={compact ? 'h-[360px]' : 'h-[440px] lg:h-[500px]'}>
        {MAPS_API_KEY ? (
          <APIProvider
            apiKey={MAPS_API_KEY}
            libraries={['marker', 'routes']}
            language="en"
            region="IN"
          >
            <InnerMapCanvas
              city={city}
              flats={flats}
              selectedFlatId={selectedFlat?.id || null}
              onSelectFlat={onSelectFlat}
              onOpenFlatDetail={onOpenFlatDetail}
              focusedLandmark={focusedLandmark}
              origin={origin}
              travelMode={travelMode}
              onRouteCalculated={handleRouteCalculated}
            />
          </APIProvider>
        ) : (
          <div className="w-full h-full rounded-2xl bg-[#F4F2EE] flex flex-col items-center justify-center p-6 text-center">
            <MapPin className="w-8 h-8 text-[#F05A4A] mb-2" />
            <p className="text-sm font-bold text-[#1E293B]">
              Maps API Key Not Configured
            </p>
            <p className="text-xs text-[#64748B] mt-1 max-w-sm">
              Set a browser-restricted Google Maps key in apps/web/.env.local to use live maps and routing. Directions remain available through the Google Maps link.
            </p>
          </div>
        )}
      </div>

      {/* Active Route Summary & Selected Flat Bar */}
      {selectedFlat && (
        <div className="rounded-2xl bg-[#FAF9F6] border border-slate-900/5 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ResilientImage
                src={selectedFlat.photos[0] || selectedFlat.avatar}
                alt={selectedFlat.flatTitle || selectedFlat.name}
                className="w-12 h-12 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1E293B] truncate">
                  {selectedFlat.flatTitle || `${selectedFlat.name}'s Flat`}
                </p>
                <p className="text-xs text-[#64748B] truncate">
                  {selectedFlat.flatAddress || `${selectedFlat.neighborhood}, ${city.name}`}
                </p>
              </div>
            </div>

            {routeStats && (
              <div className="text-right shrink-0">
                <div className="text-base font-extrabold text-[#F05A4A] tabular-nums">
                  {routeStats.durationMins} min
                </div>
                <div className="text-xs font-semibold text-[#64748B] tabular-nums">
                  {routeStats.distanceKm.toFixed(1)} km
                </div>
              </div>
            )}
          </div>

          {routeError && (
            <p className="text-xs text-[#BA1A1A]">{routeError}</p>
          )}

          {routeStats && routeStats.steps.length > 0 && (
            <div className="text-xs text-[#59413D] bg-white rounded-xl p-2.5 border border-slate-900/5 space-y-1">
              <div className="font-semibold text-[#1E293B]">Route Highlights</div>
              {routeStats.steps.map((step, i) => (
                <div key={i} className="truncate">
                  {i + 1}. {step}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={googleMapsExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#F05A4A] text-white text-xs font-bold hover:bg-[#e04c3c] transition-all active:scale-[0.98]"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Turn-by-Turn in Google Maps</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
            <button
              type="button"
              onClick={() => onOpenFlatDetail(selectedFlat)}
              className="px-4 py-2.5 rounded-full bg-white border border-slate-900/10 text-xs font-bold text-[#1E293B] hover:bg-[#F4F2EE] transition-colors whitespace-nowrap shrink-0"
            >
              Split Rent &amp; Book Tour
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
