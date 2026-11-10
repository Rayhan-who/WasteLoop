"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { DHAKA_CENTRE, type LatLng } from "@/lib/geo/bounds";

/**
 * Pick the exact pickup point (private until a request is accepted):
 * tap the map or drag the pin. OpenStreetMap tiles, no API key.
 * The pin is a CSS div icon, so no marker images need bundling.
 */
const pinIcon = L.divIcon({
  className: "",
  html: '<span class="block size-7 -translate-y-3 rotate-45 rounded-[50%_50%_50%_0] border-2 border-white bg-black shadow-lg"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Re-centre when the value changes from outside (search result, "use my location"). */
function FollowValue({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [map, value]);
  return null;
}

export default function LocationPicker({
  value,
  onChange,
  label,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  /** Accessible name for the map region. */
  label: string;
}) {
  const centre = value ?? DHAKA_CENTRE;
  const handlers = useMemo(
    () => ({
      dragend(e: L.LeafletEvent) {
        const p = (e.target as L.Marker).getLatLng();
        onChange({ lat: p.lat, lng: p.lng });
      },
    }),
    [onChange],
  );

  return (
    <div role="region" aria-label={label} className="relative z-0 h-72 overflow-hidden rounded-2xl border border-wl-border sm:h-80">
      <MapContainer center={[centre.lat, centre.lng]} zoom={value ? 16 : 12} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPlace onPick={onChange} />
        <FollowValue value={value} />
        {value ? <Marker position={[value.lat, value.lng]} icon={pinIcon} draggable eventHandlers={handlers} /> : null}
      </MapContainer>
    </div>
  );
}
