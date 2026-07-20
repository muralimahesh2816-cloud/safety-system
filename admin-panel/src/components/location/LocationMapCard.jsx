import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Crosshair, ExternalLink, LocateFixed, Map, Minus, Plus, RotateCcw, Search } from "lucide-react";
import useDeviceLocation from "../../hooks/useDeviceLocation";
import { locationService } from "../../api/services";
import { GOOGLE_MAP_ID, loadGoogleMaps } from "../../utils/googleMapsLoader";
import { DEFAULT_LOCATION, googleMapsUrl, normalizeRecordLocation, validCoordinates } from "../../utils/location";

const sourceLabel = (source = "") => ({ device_gps: "Device GPS", browser_geolocation: "Device GPS", map_adjusted: "Map adjusted", coordinate_entry: "Coordinate entry", place_search: "Address search", legacy: "Legacy record" }[source] || "Not recorded");
const statusLabel = (location, resolving) => resolving ? "Resolving address" : !validCoordinates(location.latitude, location.longitude) ? "Location required" : location.reverseGeocodeStatus === "completed" ? "Address resolved" : location.locationSource === "map_adjusted" || location.locationSource === "coordinate_entry" ? "Location edited" : "GPS captured";

const LocationMapCard = ({ value, onChange, readOnly = false, title = "Location Details", markerTitle = "Selected site location", defaultAddress = "", required = false }) => {
  const initial = useMemo(() => ({ ...DEFAULT_LOCATION, ...normalizeRecordLocation({ geoLocation: value }), formattedAddress: value?.formattedAddress || defaultAddress || "" }), [defaultAddress, value]);
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [expanded, setExpanded] = useState(true);
  const [mapError, setMapError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [resolving, setResolving] = useState(false);
  const [search, setSearch] = useState("");
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const draftRef = useRef(initial);
  const listenersRef = useRef([]);
  const geocodeTimer = useRef(null);
  const { status: gpsStatus, captureLocation } = useDeviceLocation();

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const resolveAddress = useCallback(async (location, source) => {
    if (!validCoordinates(location.latitude, location.longitude)) return;
    setResolving(true);
    try {
      const response = await locationService.reverseGeocode(location);
      const resolved = { ...location, ...(response.data || response.location || {}), locationSource: source, updatedAt: new Date().toISOString() };
      setDraft(resolved);
      onChange?.(resolved);
    } catch (_error) {
      const fallback = { ...location, formattedAddress: location.formattedAddress || "Address unavailable", reverseGeocodeStatus: "failed", locationSource: source, updatedAt: new Date().toISOString() };
      setDraft(fallback);
      onChange?.(fallback);
    } finally { setResolving(false); }
  }, [onChange]);

  const updateCoordinates = useCallback((latitude, longitude, source, immediate = false) => {
    const current = draftRef.current;
    const next = { ...current, latitude: Number(latitude), longitude: Number(longitude), locationSource: source, capturedAt: current.capturedAt || new Date().toISOString() };
    setDraft(next);
    setValidationError("");
    onChange?.(next);
    if (mapRef.current) mapRef.current.panTo({ lat: next.latitude, lng: next.longitude });
    if (markerRef.current) markerRef.current.position = { lat: next.latitude, lng: next.longitude };
    window.clearTimeout(geocodeTimer.current);
    geocodeTimer.current = window.setTimeout(() => resolveAddress(next, source), immediate ? 0 : 650);
  }, [onChange, resolveAddress]);

  useEffect(() => {
    setDraft(initial);
    setSaved(initial);
  }, [initial]);

  useEffect(() => {
    if (!expanded || !mapNode.current || mapRef.current) return undefined;
    let cancelled = false;
    loadGoogleMaps().then(async (maps) => {
      if (cancelled) return;
      const { Map: GoogleMap } = await maps.importLibrary("maps");
      const { AdvancedMarkerElement } = await maps.importLibrary("marker");
      const current = draftRef.current;
      const center = validCoordinates(current.latitude, current.longitude) ? { lat: Number(current.latitude), lng: Number(current.longitude) } : { lat: DEFAULT_LOCATION.latitude, lng: DEFAULT_LOCATION.longitude };
      const map = new GoogleMap(mapNode.current, { center, zoom: Number(current.zoom || DEFAULT_LOCATION.zoom), mapId: GOOGLE_MAP_ID, mapTypeId: current.mapType || "roadmap", fullscreenControl: true, streetViewControl: false, mapTypeControl: false, gestureHandling: "greedy" });
      const marker = new AdvancedMarkerElement({ map, position: center, title: markerTitle, gmpDraggable: !readOnly });
      mapRef.current = map; markerRef.current = marker;
      if (!readOnly) listenersRef.current.push(marker.addListener("dragend", () => {
        const position = marker.position;
        updateCoordinates(position.lat, position.lng, "map_adjusted", true);
      }));
      setMapError("");
    }).catch((error) => setMapError(error.message === "MAPS_NOT_CONFIGURED" || error.message === "MAP_ID_NOT_CONFIGURED" ? "Google Maps is not configured. Address and coordinates remain available." : "The map could not be loaded. You can still use coordinates or open Google Maps."));
    return () => { cancelled = true; };
  }, [expanded, markerTitle, readOnly, updateCoordinates]);

  useEffect(() => () => { window.clearTimeout(geocodeTimer.current); listenersRef.current.forEach((listener) => listener?.remove?.()); if (markerRef.current) markerRef.current.map = null; }, []);

  const applyCoordinates = () => {
    if (!validCoordinates(draft.latitude, draft.longitude)) { setValidationError("Enter a latitude from -90 to 90 and longitude from -180 to 180."); return; }
    updateCoordinates(draft.latitude, draft.longitude, "coordinate_entry", true);
  };
  const useCurrent = async () => { const result = await captureLocation(); if (result.location) updateCoordinates(result.location.latitude, result.location.longitude, "device_gps", true); };
  const reset = () => { setDraft(saved); onChange?.(saved); if (validCoordinates(saved.latitude, saved.longitude)) { mapRef.current?.panTo({lat:saved.latitude,lng:saved.longitude}); if(markerRef.current) markerRef.current.position={lat:saved.latitude,lng:saved.longitude}; } };
  const searchLocation = async () => {
    if (!search.trim()) return;
    try { const maps = await loadGoogleMaps(); const geocoder = new maps.Geocoder(); const results = await geocoder.geocode({ address: search.trim() }); const first = results.results?.[0]; if (!first) throw new Error(); updateCoordinates(first.geometry.location.lat(), first.geometry.location.lng(), "place_search", true); setDraft((current) => ({...current,formattedAddress:first.formatted_address,placeId:first.place_id})); }
    catch (_error) { setMapError("Location search is unavailable. Enter coordinates or use the current-location button."); }
  };
  const externalUrl = googleMapsUrl(draft);

  return <section className="location-map-card" aria-labelledby={`${title.replace(/\s/g,"-")}-heading`}>
    <header className="location-map-card__header"><div><h3 id={`${title.replace(/\s/g,"-")}-heading`}>{title}</h3><p>Select, verify or adjust the exact site location.</p></div><div className="location-map-card__header-actions"><span className="location-map-card__status">{statusLabel(draft,resolving)}</span><button type="button" onClick={()=>setExpanded((v)=>!v)} aria-expanded={expanded}>{expanded?<><ChevronUp size={16}/>Minimize</>:<><ChevronDown size={16}/>Expand Map</>}</button></div></header>
    <div className="location-map-card__address"><strong>{draft.formattedAddress || (validCoordinates(draft.latitude,draft.longitude)?"Address not resolved":"Location coordinates not recorded")}</strong>{validCoordinates(draft.latitude,draft.longitude)?<span>{Number(draft.latitude).toFixed(6)}, {Number(draft.longitude).toFixed(6)}</span>:null}</div>
    {!readOnly?<><div className="location-map-card__search"><label htmlFor="location-search">Search location or address</label><div><input id="location-search" value={search} onChange={(e)=>setSearch(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();searchLocation();}}}/><button type="button" onClick={searchLocation}><Search size={16}/>Search</button></div></div><div className="location-map-card__coordinates"><label>Latitude<input type="number" step="any" min="-90" max="90" required={required} value={draft.latitude ?? ""} onChange={(e)=>setDraft((v)=>({...v,latitude:e.target.value}))}/></label><label>Longitude<input type="number" step="any" min="-180" max="180" required={required} value={draft.longitude ?? ""} onChange={(e)=>setDraft((v)=>({...v,longitude:e.target.value}))}/></label></div><div className="location-map-card__actions"><button type="button" onClick={applyCoordinates}><Map size={16}/>Apply Coordinates</button><button type="button" onClick={useCurrent} disabled={gpsStatus==="requesting"}><LocateFixed size={16}/>{gpsStatus==="requesting"?"Locating...":"Use Current Location"}</button><button type="button" onClick={reset}><RotateCcw size={16}/>Reset</button></div></>:null}
    {validationError?<p className="location-map-card__error" role="alert">{validationError}</p>:null}
    {expanded?<div className="location-map-card__map-shell"><div ref={mapNode} className="location-map-card__map" role="application" aria-label={`${title} interactive map`}/>{mapError?<div className="location-map-card__fallback" role="status"><Map size={28}/><p>{mapError}</p></div>:null}<div className="location-map-card__toolbar"><button type="button" onClick={()=>mapRef.current?.setMapTypeId("roadmap")}>Map</button><button type="button" onClick={()=>mapRef.current?.setMapTypeId("satellite")}>Satellite</button><button type="button" aria-label="Zoom in" onClick={()=>mapRef.current?.setZoom((mapRef.current?.getZoom()||18)+1)}><Plus size={16}/></button><button type="button" aria-label="Zoom out" onClick={()=>mapRef.current?.setZoom((mapRef.current?.getZoom()||18)-1)}><Minus size={16}/></button><button type="button" aria-label="Re-centre map" onClick={()=>validCoordinates(draft.latitude,draft.longitude)&&mapRef.current?.panTo({lat:Number(draft.latitude),lng:Number(draft.longitude)})}><Crosshair size={16}/></button></div></div>:null}
    <footer className="location-map-card__meta"><span>Accuracy: {draft.accuracyMeters?`±${Math.round(draft.accuracyMeters)} m`:"Not available"}</span><span>Source: {sourceLabel(draft.locationSource)}</span><span>Updated: {draft.updatedAt||draft.capturedAt?new Date(draft.updatedAt||draft.capturedAt).toLocaleString():"Not recorded"}</span>{externalUrl?<a href={externalUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps <ExternalLink size={13}/></a>:null}</footer>
  </section>;
};

export default LocationMapCard;
