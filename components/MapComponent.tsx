import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Location, POI, TransportMode } from '../types';
import { reverseGeocode } from '../services/osmService';
import { Locate, Globe, Map as MapIcon, Search, ExternalLink, Clock, Ruler, Car, Bike, Footprints } from 'lucide-react';

// Fix: Use CDN URLs instead of importing PNGs directly which crashes in browser-only environments
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const poiIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface RouteSummary {
  totalDistance: number;
  totalTime: number;
}

interface MapComponentProps {
  start: Location | null;
  end: Location | null;
  pois: POI[];
  focusedPoi: POI | null;
  setStart: (loc: Location) => void;
  setEnd: (loc: Location) => void;
  selectionMode: 'start' | 'end';
  setSelectionMode: (mode: 'start' | 'end') => void;
  transportMode: TransportMode;
  setTransportMode: (mode: TransportMode) => void;
}

// Sub-component to handle map clicks
const MapClickHandler: React.FC<{
  setStart: (loc: Location) => void;
  setEnd: (loc: Location) => void;
  selectionMode: 'start' | 'end';
  setSelectionMode: (mode: 'start' | 'end') => void;
}> = ({ setStart, setEnd, selectionMode, setSelectionMode }) => {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      const name = await reverseGeocode(lat, lng);
      const newLoc = { lat, lng, name };

      if (selectionMode === 'start') {
        setStart(newLoc);
        setSelectionMode('end'); // Auto-switch to next step
      } else {
        setEnd(newLoc);
      }
    },
  });
  return null;
};

// Sub-component to handle Leaflet Routing Machine
const RoutingMachine: React.FC<{ 
    start: Location | null; 
    end: Location | null;
    transportMode: TransportMode;
    onRouteFound: (summary: RouteSummary | null) => void;
}> = ({ start, end, transportMode, onRouteFound }) => {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    // Reset summary when start/end changes
    onRouteFound(null);

    // Clean up previous control
    if (routingControlRef.current) {
      try {
        map.removeControl(routingControlRef.current);
      } catch (e) {
        console.warn("Error removing routing control", e);
      }
      routingControlRef.current = null;
    }

    if (start && end) {
        // Access global L instance where leaflet-routing-machine is attached
        const globalL = (window as any).L;

        if (!globalL || !globalL.Routing) {
            console.error("Leaflet Routing Machine is not loaded correctly.");
            return;
        }

        // Map TransportMode to OSRM profiles
        // standard profiles: 'driving', 'cycling', 'walking'
        let profile = 'driving'; // default
        if (transportMode === 'bike') profile = 'cycling';
        if (transportMode === 'foot') profile = 'walking';

        try {
            const control = globalL.Routing.control({
              waypoints: [
                globalL.latLng(start.lat, start.lng),
                globalL.latLng(end.lat, end.lng)
              ],
              router: globalL.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: profile
              }),
              routeWhileDragging: false,
              showAlternatives: true, // Enable alternatives
              show: false, // Keep textual details hidden
              lineOptions: {
                styles: [{ color: transportMode === 'foot' ? '#10b981' : transportMode === 'bike' ? '#f59e0b' : '#3b82f6', opacity: 0.8, weight: 6 }]
              },
              addWaypoints: false,
              draggableWaypoints: false,
              fitSelectedRoutes: false,
              createMarker: function() { return null; }
            });

            control.on('routesfound', function(e: any) {
                const routes = e.routes;
                if (routes && routes.length > 0) {
                    const summary = routes[0].summary;
                    onRouteFound(summary);
                }
            });

            routingControlRef.current = control.addTo(map);
        } catch (error) {
            console.error("Error creating routing control:", error);
        }
    }

    return () => {
      if (routingControlRef.current && map) {
        try {
            map.removeControl(routingControlRef.current);
        } catch(e) {
            console.warn("Cleanup error", e);
        }
      }
    };
  }, [map, start, end, transportMode]);

  return null;
};

// Sub-component to automatically adjust map bounds to include Start, End, and POIs
const MapBoundsController: React.FC<{ start: Location | null; end: Location | null; pois: POI[] }> = ({ start, end, pois }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const bounds = L.latLngBounds([]);
    let hasPoints = false;

    if (start) {
      bounds.extend([start.lat, start.lng]);
      hasPoints = true;
    }
    if (end) {
      bounds.extend([end.lat, end.lng]);
      hasPoints = true;
    }
    
    // Add POIs to bounds
    pois.forEach(poi => {
      bounds.extend([poi.lat, poi.lng]);
      hasPoints = true;
    });

    // If we have points (especially POIs or a complete route), fit the bounds
    if (hasPoints && (start || end || pois.length > 0)) {
       // Only fit bounds if we actually have a meaningful set of points
       if ((start && end) || pois.length > 0) {
          try {
             if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
             }
          } catch(e) {
             console.warn("Could not fit bounds", e);
          }
       } else if (start) {
          map.setView([start.lat, start.lng], 13);
       }
    }
  }, [map, start, end, pois]); 

  return null;
};

// Sub-component for the Locate Me button
const LocateControl = () => {
  const map = useMap();

  const handleLocate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    map.locate().once("locationfound", function (evt) {
      map.flyTo(evt.latlng, 13);
    });
  };

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={handleLocate}
        className="bg-white p-2 rounded-lg shadow-md border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors flex items-center justify-center w-10 h-10"
        aria-label="Localiser ma position"
        title="Localiser ma position"
      >
        <Locate className="w-6 h-6" />
      </button>
    </div>
  );
};

// Sub-component for Transport Mode Control
const TransportControl: React.FC<{
  mode: TransportMode;
  setMode: (mode: TransportMode) => void;
}> = ({ mode, setMode }) => {
  return (
    <div className="absolute top-16 right-4 z-[1000] flex flex-col bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden">
        {/* Car */}
        <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMode('car'); }}
            className={`p-2 w-10 h-10 flex items-center justify-center transition-colors border-b border-gray-100 ${mode === 'car' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            title="Voiture"
            aria-label="Mode Voiture"
        >
            <Car className="w-5 h-5" />
        </button>
        {/* Bike */}
        <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMode('bike'); }}
            className={`p-2 w-10 h-10 flex items-center justify-center transition-colors border-b border-gray-100 ${mode === 'bike' ? 'bg-orange-50 text-orange-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            title="Vélo"
            aria-label="Mode Vélo"
        >
            <Bike className="w-5 h-5" />
        </button>
        {/* Foot */}
        <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMode('foot'); }}
            className={`p-2 w-10 h-10 flex items-center justify-center transition-colors ${mode === 'foot' ? 'bg-green-50 text-green-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            title="Marche"
            aria-label="Mode Marche"
        >
            <Footprints className="w-5 h-5" />
        </button>
    </div>
  );
};

// Sub-component for displaying route info
const RouteInfoOverlay: React.FC<{ summary: RouteSummary | null }> = ({ summary }) => {
    if (!summary) return null;
  
    const formatDistance = (m: number) => {
      if (m >= 1000) return (m / 1000).toFixed(1) + ' km';
      return Math.round(m) + ' m';
    };
  
    const formatTime = (s: number) => {
      const minutes = Math.round(s / 60);
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins > 0 ? mins + 'min' : ''}`;
      }
      return `${minutes} min`;
    };
  
    return (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg z-[1000] flex gap-4 text-sm font-semibold text-gray-700 border border-gray-200 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="flex items-center gap-1.5 text-blue-600">
          <Ruler className="w-4 h-4" />
          <span>{formatDistance(summary.totalDistance)}</span>
        </div>
        <div className="w-px h-4 bg-gray-300 self-center"></div>
        <div className="flex items-center gap-1.5 text-orange-600">
          <Clock className="w-4 h-4" />
          <span>{formatTime(summary.totalTime)}</span>
        </div>
      </div>
    );
};

// Sub-component for rendering POIs and handling focus
const PoiMarkers: React.FC<{ pois: POI[]; focusedPoi: POI | null }> = ({ pois, focusedPoi }) => {
  const map = useMap();
  const markerRefs = useRef<{ [key: number]: L.Marker | null }>({});

  useEffect(() => {
    if (focusedPoi && markerRefs.current[focusedPoi.id]) {
      const marker = markerRefs.current[focusedPoi.id];
      if (marker) {
        map.flyTo([focusedPoi.lat, focusedPoi.lng], 16, { duration: 1.5 });
        marker.openPopup();
      }
    }
  }, [focusedPoi, map]);

  return (
    <>
      {pois.map((poi) => (
        <Marker 
          key={poi.id} 
          position={[poi.lat, poi.lng]} 
          icon={poiIcon}
          ref={(el) => {
            if (el) markerRefs.current[poi.id] = el;
            else delete markerRefs.current[poi.id];
          }}
        >
          <Popup>
            <div className="text-sm max-w-[220px]">
                <h3 className="font-bold text-base text-gray-800 leading-tight mb-1">{poi.name}</h3>
                
                <div className="flex flex-wrap gap-1 mb-2">
                    <span className="inline-block bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold">
                        {poi.type.replace(/_/g, ' ')}
                    </span>
                </div>

                {poi.description && (
                    <div className="text-gray-600 text-xs mb-2 p-2 bg-gray-50 rounded border-l-2 border-purple-300 italic">
                        {poi.description.length > 100 ? poi.description.substring(0, 100) + '...' : poi.description}
                    </div>
                )}

                {poi.address && (
                    <div className="text-gray-500 text-xs mb-2 flex items-start gap-1.5">
                        <MapIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{poi.address}</span>
                    </div>
                )}

                <div className="mt-3 pt-2 border-t border-gray-100 flex flex-col gap-1.5">
                    {poi.website && (
                        <a
                            href={poi.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 text-xs font-medium"
                        >
                            <Globe className="w-3 h-3" />
                            <span>Site Officiel</span>
                            <ExternalLink className="w-2.5 h-2.5 ml-auto" />
                        </a>
                    )}
                    
                    <a
                        href={`https://www.openstreetmap.org/node/${poi.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1.5 text-xs font-medium"
                    >
                        <MapIcon className="w-3 h-3" />
                        <span>Voir sur OpenStreetMap</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-auto" />
                    </a>

                    <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(poi.name + ' ' + (poi.address || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 hover:text-gray-800 hover:underline flex items-center gap-1.5 text-xs"
                    >
                        <Search className="w-3 h-3" />
                        <span>Recherche Google</span>
                    </a>
                </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};


const MapComponent: React.FC<MapComponentProps> = (props) => {
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={[48.8566, 2.3522]} // Paris default
        zoom={6}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Logic Handlers */}
        <MapClickHandler
            setStart={props.setStart}
            setEnd={props.setEnd}
            selectionMode={props.selectionMode}
            setSelectionMode={props.setSelectionMode}
        />
        <MapBoundsController 
            start={props.start} 
            end={props.end} 
            pois={props.pois} 
        />
        <RoutingMachine 
            start={props.start} 
            end={props.end} 
            transportMode={props.transportMode}
            onRouteFound={setRouteSummary}
        />
        
        {/* Controls */}
        <LocateControl />
        <TransportControl mode={props.transportMode} setMode={props.setTransportMode} />
        <RouteInfoOverlay summary={routeSummary} />

        {/* Markers */}
        {props.start && (
          <Marker position={[props.start.lat, props.start.lng]} icon={startIcon}>
            <Popup>
              <strong>Départ:</strong> {props.start.name}
            </Popup>
          </Marker>
        )}

        {props.end && (
          <Marker position={[props.end.lat, props.end.lng]} icon={endIcon}>
            <Popup>
              <strong>Arrivée:</strong> {props.end.name}
            </Popup>
          </Marker>
        )}

        <PoiMarkers pois={props.pois} focusedPoi={props.focusedPoi} />

      </MapContainer>
      
      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg z-[1000] text-sm hidden md:block opacity-90">
        <div className="flex items-center gap-2 mb-1">
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" className="h-4" alt="Start" />
            <span>Départ</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png" className="h-4" alt="End" />
            <span>Arrivée</span>
        </div>
        <div className="flex items-center gap-2">
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png" className="h-4" alt="POI" />
            <span>Point d'Intérêt</span>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;