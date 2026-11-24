import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GeoPoint } from '../../types/platform';

export interface MapMarkerItem {
  id: string;
  label: string;
  sublabel?: string;
  badgeText?: string;
  type: 'donor' | 'ngo' | 'volunteer';
  point: GeoPoint;
  selected?: boolean;
}

export interface MapRouteLine {
  id: string;
  from: GeoPoint;
  to: GeoPoint;
  label?: string;
  active?: boolean;
  dashed?: boolean;
  color?: string;
}

interface RouteMapProps {
  markers: MapMarkerItem[];
  routes?: MapRouteLine[];
  heightClass?: string;
  focusedMarkerId?: string | null;
  onSelectMarker?: (id: string) => void;
  onPickLocation?: (lat: number, lng: number) => void;
  showGpsButton?: boolean;
  hideLegend?: boolean;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  markers,
  routes = [],
  heightClass = 'h-80',
  focusedMarkerId,
  onSelectMarker,
  onPickLocation,
  showGpsButton = false,
  hideLegend = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const lastBoundsKeyRef = useRef<string>('');

  // Keep latest callbacks in refs so inline arrows don't force Leaflet layer rebuilds
  const onSelectMarkerRef = useRef(onSelectMarker);
  const onPickLocationRef = useRef(onPickLocation);
  onSelectMarkerRef.current = onSelectMarker;
  onPickLocationRef.current = onPickLocation;

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'error'>('idle');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [12.96, 77.62],
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (onPickLocationRef.current) {
        const lat = Math.round(e.latlng.lat * 10000) / 10000;
        const lng = Math.round(e.latlng.lng * 10000) / 10000;
        onPickLocationRef.current(lat, lng);
      }
    };
    map.on('click', handleClick);

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(containerRef.current);

    return () => {
      map.off('click', handleClick);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    const containerEl = containerRef.current;
    if (containerEl) {
      containerEl.style.cursor = onPickLocation ? 'crosshair' : '';
    }

    group.clearLayers();
    const boundsPoints: L.LatLngExpression[] = [];

    routes.forEach((route) => {
      const coords: L.LatLngExpression[] = [
        [route.from.lat, route.from.lng],
        [route.to.lat, route.to.lng],
      ];
      const polyline = L.polyline(coords, {
        color: route.color ?? (route.active ? '#006b2c' : '#6e7b6c'),
        weight: route.active ? 4.5 : 2.5,
        opacity: route.active ? 0.95 : 0.65,
        dashArray: route.dashed ? '7 7' : undefined,
      }).addTo(group);

      if (route.label) {
        polyline.bindTooltip(route.label, { sticky: true });
      }
      boundsPoints.push([route.from.lat, route.from.lng], [route.to.lat, route.to.lng]);
    });

    // Offset stacked markers cleanly without mutating route geometry
    const coordCounts = new Map<string, number>();

    markers.forEach((item) => {
      const key = `${item.point.lat.toFixed(4)},${item.point.lng.toFixed(4)}`;
      const seen = coordCounts.get(key) ?? 0;
      coordCounts.set(key, seen + 1);
      const displayLat = item.point.lat + seen * 0.00025;
      const displayLng = item.point.lng + seen * 0.00025;

      const bgColor =
        item.type === 'donor'
          ? '#006b2c'
          : item.type === 'ngo'
            ? '#0b1c30'
            : '#a36700';

      const defaultLetter =
        item.badgeText ?? (item.type === 'donor' ? 'P' : item.type === 'ngo' ? 'D' : 'S');
      const ringColor = item.selected ? '#7ffc97' : '#ffffff';
      const baseSize = defaultLetter.length > 1 ? 30 : 24;
      const size = item.selected ? baseSize + 4 : baseSize;

      const icon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bgColor};color:#ffffff;font-family:'Inter',sans-serif;font-weight:700;font-size:${defaultLetter.length > 1 ? '10px' : '11px'};display:flex;align-items:center;justify-content:center;border:2.5px solid ${ringColor};box-shadow:0 3px 8px rgba(11,28,48,0.35);">${defaultLetter}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([displayLat, displayLng], { icon }).addTo(group);
      marker.bindPopup(
        `<div style="font-family:'Inter',sans-serif;min-width:175px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${bgColor};margin-bottom:2px;">
            ${item.type === 'donor' ? 'Pickup Location (Donor)' : item.type === 'ngo' ? 'Drop-off Location (NGO)' : 'Shipper / Fleet Hub'}
          </div>
          <div style="font-weight:700;font-size:13px;color:#0b1c30;">${item.label}</div>
          ${item.sublabel ? `<div style="font-size:12px;color:#3e4a3d;margin-top:2px;">${item.sublabel}</div>` : ''}
          <div style="font-size:11px;color:#6e7b6c;margin-top:4px;">${item.point.address}</div>
        </div>`
      );

      if (focusedMarkerId && item.id === focusedMarkerId) {
        marker.openPopup();
      }

      marker.on('click', () => {
        if (onSelectMarkerRef.current) {
          onSelectMarkerRef.current(item.id);
        }
      });

      boundsPoints.push([displayLat, displayLng]);
    });

    const nextBoundsKey = boundsPoints
      .map((pt) => {
        const pair = pt as [number, number];
        return `${pair[0].toFixed(4)},${pair[1].toFixed(4)}`;
      })
      .join('|');

    if (boundsPoints.length > 1) {
      const latLngBounds = L.latLngBounds(boundsPoints);
      boundsRef.current = latLngBounds;
      if (lastBoundsKeyRef.current !== nextBoundsKey) {
        map.fitBounds(latLngBounds, { padding: [40, 40], maxZoom: 14 });
        lastBoundsKeyRef.current = nextBoundsKey;
      }
    } else if (boundsPoints.length === 1) {
      boundsRef.current = null;
      if (lastBoundsKeyRef.current !== nextBoundsKey) {
        map.setView(boundsPoints[0], 14);
        lastBoundsKeyRef.current = nextBoundsKey;
      }
    }
  }, [markers, routes, focusedMarkerId, onPickLocation]);

  const handleFitBounds = () => {
    const map = mapRef.current;
    if (!map) return;
    if (boundsRef.current) {
      map.fitBounds(boundsRef.current, { padding: [40, 40], maxZoom: 14 });
    } else if (markers.length === 1) {
      map.setView([markers[0].point.lat, markers[0].point.lng], 14);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation || !onPickLocationRef.current) {
      setGpsStatus('error');
      return;
    }
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lng = Math.round(pos.coords.longitude * 10000) / 10000;
        setGpsStatus('idle');
        onPickLocationRef.current?.(lat, lng);
        mapRef.current?.setView([lat, lng], 15);
      },
      () => {
        setGpsStatus('error');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-surface-container-low">
      <div ref={containerRef} className={`w-full ${heightClass}`} />
      <div className="bg-surface-container-low px-3.5 py-2 flex flex-wrap items-center justify-between gap-2.5 text-[11px] font-semibold text-on-surface-variant">
        {!hideLegend ? (
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[9px] font-bold inline-flex items-center justify-center">
                P
              </span>
              Donor Pickup
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-on-surface text-white text-[9px] font-bold inline-flex items-center justify-center">
                D
              </span>
              NGO Drop-off
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-tertiary-container text-on-tertiary text-[9px] font-bold inline-flex items-center justify-center">
                S
              </span>
              Shipper Hub
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-on-surface-variant">
            {onPickLocation
              ? 'Click anywhere on map to pin exact location'
              : 'OpenStreetMap live coordinates'}
          </span>
        )}

        <div className="flex items-center gap-3 ml-auto">
          {(showGpsButton || onPickLocation) && (
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={gpsStatus === 'locating'}
              className="inline-flex items-center gap-1 text-primary hover:underline font-bold disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[14px]">my_location</span>
              <span>
                {gpsStatus === 'locating'
                  ? 'Locating…'
                  : gpsStatus === 'error'
                    ? 'GPS Unavailable'
                    : 'Use GPS'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handleFitBounds}
            className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
          >
            <span className="material-symbols-outlined text-[14px]">fit_screen</span>
            <span>Fit Map</span>
          </button>
        </div>
      </div>
    </div>
  );
};
