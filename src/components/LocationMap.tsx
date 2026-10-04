"use client";

import { useCallback, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// A map to put the school on: OpenStreetMap's, through Leaflet. Tapping the
// map puts the pin there, and the pin can be dragged; around it, the circle
// a teacher has to be inside to sign in. Loaded only in the browser
// (next/dynamic with ssr: false), since Leaflet reaches for the window as
// soon as it loads.

export interface MapPoint {
  lat: number;
  lng: number;
}

/** A pin drawn here rather than Leaflet's own, whose image doesn't survive the bundler. */
const PIN = L.divIcon({
  className: "",
  html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.6 15 41 15 41s14-15.4 14-26.1C29 7.2 22.7 1 15 1Z" fill="#1e3a8a" stroke="#ffffff" stroke-width="2"/>
    <circle cx="15" cy="15" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 41],
});

/** A spot as the form keeps it: to six places, about ten centimetres. */
const spot = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

export default function LocationMap({
  point,
  radius,
  view,
  onPick,
}: {
  /** Where the pin is, if anywhere yet. */
  point: MapPoint | null;
  /** How close counts as on the premises, in metres: the circle round the pin. */
  radius: number;
  /** Somewhere to look, and how closely: a search result, or the school's town. */
  view: { center: MapPoint; zoom: number } | null;
  onPick: (point: MapPoint) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const ring = useRef<L.Circle | null>(null);
  // The handler and radius as they are now, not as they were when the map was made.
  const pick = useRef(onPick);
  pick.current = onPick;
  const size = useRef(radius);
  size.current = radius;
  // The last spot chosen on the map itself, which the map is already showing.
  const picked = useRef<string | null>(null);
  const choose = useCallback((at: L.LatLng) => {
    picked.current = spot(at.lat, at.lng);
    pick.current({ lat: at.lat, lng: at.lng });
  }, []);

  useEffect(() => {
    if (!box.current) return;
    const start: L.LatLngTuple = point ? [point.lat, point.lng] : view ? [view.center.lat, view.center.lng] : [20, 0];
    const m = L.map(box.current, { scrollWheelZoom: false }).setView(start, point ? 17 : (view?.zoom ?? 2));
    m.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => choose(e.latlng));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      pin.current = null;
      ring.current = null;
    };
    // The map is made once; the effects below keep it up to date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The pin, and the circle round it.
  const lat = point?.lat;
  const lng = point?.lng;
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (lat === undefined || lng === undefined) {
      pin.current?.remove();
      ring.current?.remove();
      pin.current = null;
      ring.current = null;
      return;
    }
    const at: L.LatLngTuple = [lat, lng];
    if (!ring.current) {
      ring.current = L.circle(at, {
        radius: size.current,
        color: "#1e3a8a",
        weight: 2,
        fillColor: "#1e3a8a",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(m);
    } else {
      ring.current.setLatLng(at);
    }
    if (!pin.current) {
      const marker = L.marker(at, { icon: PIN, draggable: true, title: "The school", keyboard: false }).addTo(m);
      marker.on("dragend", () => choose(marker.getLatLng()));
      pin.current = marker;
    } else {
      pin.current.setLatLng(at);
    }
    // Typed in, or found by the phone: go and look, once the typing stops.
    if (spot(lat, lng) === picked.current) return;
    const follow = setTimeout(() => m.setView(at, Math.max(m.getZoom(), 16)), 500);
    return () => clearTimeout(follow);
  }, [lat, lng, choose]);

  useEffect(() => {
    ring.current?.setRadius(radius);
  }, [radius]);

  // A search result, or the school's town: go there.
  useEffect(() => {
    if (view && map.current) map.current.setView([view.center.lat, view.center.lng], view.zoom);
  }, [view]);

  return (
    // isolate: Leaflet's own layers stack in their hundreds, and would
    // otherwise sit over the page's header and menus as it scrolls past.
    // ltr: a map reads the same in every language.
    <div dir="ltr" className="isolate rounded-2xl overflow-hidden border border-surface-border">
      <div ref={box} className="h-[340px] w-full" />
    </div>
  );
}
