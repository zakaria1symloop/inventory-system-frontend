'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Driver {
  id: number;
  name: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  last_location_at: string | null;
  is_online: boolean;
  has_active_delivery: boolean;
  delivery_reference: string | null;
  vehicle_name: string | null;
}

interface DriverMapProps {
  drivers: Driver[];
}

// Fix for default marker icons in Leaflet with webpack
const createIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

const onlineIcon = createIcon('#22c55e'); // green-500
const offlineIcon = createIcon('#9ca3af'); // gray-400
const activeDeliveryIcon = createIcon('#3b82f6'); // blue-500

export default function DriverMap({ drivers }: DriverMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Default center on Biskra, Algeria
    const defaultCenter: [number, number] = [34.8416, 5.7289];

    mapRef.current = L.map(mapContainerRef.current).setView(defaultCenter, 12);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when drivers change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const validDrivers = drivers.filter(d => d.latitude && d.longitude);

    if (validDrivers.length === 0) return;

    // Add new markers
    validDrivers.forEach(driver => {
      const icon = driver.has_active_delivery
        ? activeDeliveryIcon
        : driver.is_online
        ? onlineIcon
        : offlineIcon;

      const marker = L.marker([driver.latitude!, driver.longitude!], { icon })
        .addTo(mapRef.current!);

      // Create popup content
      const popupContent = `
        <div style="direction: rtl; text-align: right; min-width: 150px;">
          <div style="font-weight: bold; margin-bottom: 5px;">${driver.name}</div>
          ${driver.phone ? `<div style="font-size: 12px; color: #666;">${driver.phone}</div>` : ''}
          ${driver.has_active_delivery ? `
            <div style="margin-top: 5px; padding: 3px 6px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-size: 11px; display: inline-block;">
              ${driver.delivery_reference}
            </div>
          ` : ''}
          ${driver.vehicle_name ? `<div style="font-size: 11px; color: #888; margin-top: 3px;">${driver.vehicle_name}</div>` : ''}
          <div style="font-size: 10px; color: ${driver.is_online ? '#16a34a' : '#9ca3af'}; margin-top: 5px;">
            ${driver.is_online ? 'متصل' : 'غير متصل'}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (validDrivers.length > 0) {
      const bounds = L.latLngBounds(
        validDrivers.map(d => [d.latitude!, d.longitude!] as [number, number])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [drivers]);

  return (
    <div className="relative">
      <div ref={mapContainerRef} className="h-[600px] rounded-lg z-0" />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <div className="text-sm font-semibold mb-2">الدليل</div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow"></div>
            <span>متصل</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow"></div>
            <span>في توصيل</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-400 border-2 border-white shadow"></div>
            <span>غير متصل</span>
          </div>
        </div>
      </div>
    </div>
  );
}
