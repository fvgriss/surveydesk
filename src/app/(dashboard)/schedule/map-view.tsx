"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, MapPin, Loader2 } from "lucide-react";
import { type Visit } from "./visit-card";

type LatLng = { lat: number; lng: number };

type MapViewProps = {
  days: string[];
  visits: Visit[];
  crews: { id: string; name: string; chiefName: string | null }[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

const crewPalette = [
  { color: "#3b82f6", name: "blue" },
  { color: "#10b981", name: "emerald" },
  { color: "#a855f7", name: "purple" },
  { color: "#f59e0b", name: "amber" },
  { color: "#ec4899", name: "pink" },
  { color: "#06b6d4", name: "cyan" },
];

function formatDayShort(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
}

export function MapView({ days, visits, crews, selectedDate, onSelectDate }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const [locations, setLocations] = useState<Record<string, LatLng>>({});
  const [loading, setLoading] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const LRef = useRef<typeof import("leaflet") | null>(null);

  const activeDate = selectedDate || days[0] || "";
  const dayVisits = visits.filter((v) => v.scheduledDate === activeDate);

  // Dynamically import Leaflet (needs window)
  useEffect(() => {
    import("leaflet").then((L) => {
      // Fix default marker icons
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
      LRef.current = L;
      setLeafletReady(true);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstance.current) return;
    const L = LRef.current!;

    // Import the CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);

    mapInstance.current = L.map(mapRef.current).setView([30.27, -97.74], 10); // Austin, TX default

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [leafletReady]);

  // Geocode addresses when day changes
  const geocode = useCallback(async (addresses: string[]) => {
    const missing = addresses.filter((a) => !locations[a]);
    if (missing.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/schedule/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: missing }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocations((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
    }
    setLoading(false);
  }, [locations]);

  useEffect(() => {
    if (dayVisits.length > 0) {
      const addresses = [...new Set(dayVisits.map((v) => v.projectAddress))];
      geocode(addresses);
    }
  }, [activeDate, dayVisits.length]);

  // Update markers and routes
  useEffect(() => {
    if (!mapInstance.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapInstance.current;

    // Clear old markers/lines
    markersRef.current.forEach((layer) => map.removeLayer(layer));
    markersRef.current = [];

    // Build crew color map
    const crewColorMap = new Map<string, string>();
    crews.forEach((c, i) => {
      crewColorMap.set(c.id, crewPalette[i % crewPalette.length].color);
    });

    // Group visits by crew (use "unassigned" key for null crewId)
    const crewVisits = new Map<string, Visit[]>();
    dayVisits.forEach((v) => {
      const key = v.crewId || "unassigned";
      if (!crewVisits.has(key)) crewVisits.set(key, []);
      crewVisits.get(key)!.push(v);
    });

    const allLatLngs: [number, number][] = [];

    crewVisits.forEach((cvs, crewId) => {
      const color = crewColorMap.get(crewId) || "#6b7280";
      const routePoints: [number, number][] = [];

      cvs.forEach((visit) => {
        const loc = locations[visit.projectAddress];
        if (!loc) return;

        const point: [number, number] = [loc.lat, loc.lng];
        routePoints.push(point);
        allLatLngs.push(point);

        // Create colored circle marker
        const marker = L.circleMarker(point, {
          radius: 10,
          fillColor: color,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        }).addTo(map);

        // Popup with visit info
        marker.bindPopup(
          `<div style="font-size:13px">
            <strong>${visit.projectAddress}</strong><br/>
            <span style="color:${color}">●</span> ${visit.crewName}<br/>
            ${visit.surveyType.replace("_", " ")} · ${visit.timeWindow.replace("_", " ")}<br/>
            <em>${visit.contactName}</em>
          </div>`
        );

        markersRef.current.push(marker);
      });

      // Draw route line between a crew's stops
      if (routePoints.length > 1) {
        const polyline = L.polyline(routePoints, {
          color,
          weight: 3,
          opacity: 0.6,
          dashArray: "8, 6",
        }).addTo(map);
        markersRef.current.push(polyline);
      }
    });

    // Fit bounds
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [dayVisits, locations, crews, leafletReady]);

  // Build crew legend entries
  const crewLegend = crews
    .filter((c) => dayVisits.some((v) => v.crewId === c.id))
    .map((c, i) => ({
      name: c.name,
      color: crewPalette[i % crewPalette.length].color,
    }));

  return (
    <div>
      {/* Day selector */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
        {days.map((day) => {
          const count = visits.filter((v) => v.scheduledDate === day).length;
          const isActive = day === activeDate;
          return (
            <button
              key={day}
              onClick={() => onSelectDate(day)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {formatDayShort(day)}
              {count > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Map container */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200">
        <div ref={mapRef} style={{ height: "500px", width: "100%" }} />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute top-3 right-3 bg-white rounded-lg shadow px-3 py-1.5 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            Geocoding...
          </div>
        )}

        {/* Empty state */}
        {!loading && dayVisits.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="text-center text-gray-400">
              <MapPin size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No visits scheduled for this day</p>
            </div>
          </div>
        )}

        {/* Crew legend */}
        {crewLegend.length > 0 && (
          <div className="absolute bottom-3 left-3 bg-white rounded-lg shadow px-3 py-2">
            <div className="text-[10px] text-gray-400 mb-1 font-medium">CREWS</div>
            {crewLegend.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visit list below map */}
      {dayVisits.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs font-medium text-gray-500 mb-1">
            {dayVisits.length} visit{dayVisits.length !== 1 ? "s" : ""} on {formatDayShort(activeDate)}
          </div>
          {dayVisits.map((v) => (
            <div key={v.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    crewPalette[crews.findIndex((c) => c.id === v.crewId) % crewPalette.length]?.color || "#6b7280",
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-700 truncate">{v.projectAddress}</div>
                <div className="text-gray-400">
                  {v.crewName} · {v.surveyType.replace("_", " ")} · {v.contactName}
                </div>
              </div>
              <div className="text-gray-400 capitalize whitespace-nowrap">
                {v.timeWindow.replace("_", " ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
