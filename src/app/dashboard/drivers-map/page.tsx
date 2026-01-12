'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { locationApi } from '@/lib/api';

// Dynamically import the map component to avoid SSR issues with Leaflet
const DriverMap = dynamic(() => import('./DriverMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">جاري تحميل الخريطة...</div>
    </div>
  ),
});

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

interface DriversData {
  drivers: Driver[];
  online_count: number;
  total_count: number;
  updated_at: string;
}

export default function DriversMapPage() {
  const [driversData, setDriversData] = useState<DriversData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchDrivers = useCallback(async () => {
    try {
      const response = await locationApi.getAllDrivers();
      setDriversData(response.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching drivers:', error);
      toast.error('خطأ في تحميل مواقع السائقين');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDrivers();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchDrivers]);

  const onlineDrivers = driversData?.drivers.filter(d => d.is_online) || [];
  const offlineDrivers = driversData?.drivers.filter(d => !d.is_online) || [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">خريطة السائقين</h1>
          <p className="text-gray-500 text-sm">
            تتبع مواقع السائقين في الوقت الفعلي
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">تحديث تلقائي</span>
          </label>
          <button
            onClick={fetchDrivers}
            disabled={loading}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            تحديث
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-sm text-gray-500">إجمالي السائقين</div>
          <div className="text-2xl font-bold">{driversData?.total_count || 0}</div>
        </div>
        <div className="card p-4 bg-green-50">
          <div className="text-sm text-green-700">متصلون</div>
          <div className="text-2xl font-bold text-green-600">{driversData?.online_count || 0}</div>
        </div>
        <div className="card p-4 bg-gray-50">
          <div className="text-sm text-gray-500">غير متصلين</div>
          <div className="text-2xl font-bold text-gray-400">
            {(driversData?.total_count || 0) - (driversData?.online_count || 0)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">آخر تحديث</div>
          <div className="text-lg font-medium">
            {lastUpdate ? lastUpdate.toLocaleTimeString('ar-SA') : '-'}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="card mb-6">
        <DriverMap drivers={driversData?.drivers || []} />
      </div>

      {/* Drivers List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Online Drivers */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            السائقون المتصلون ({onlineDrivers.length})
          </h3>
          {onlineDrivers.length === 0 ? (
            <div className="text-gray-500 text-center py-4">لا يوجد سائقون متصلون</div>
          ) : (
            <div className="space-y-3">
              {onlineDrivers.map((driver) => (
                <DriverCard key={driver.id} driver={driver} />
              ))}
            </div>
          )}
        </div>

        {/* Offline Drivers */}
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
            السائقون غير المتصلين ({offlineDrivers.length})
          </h3>
          {offlineDrivers.length === 0 ? (
            <div className="text-gray-500 text-center py-4">جميع السائقين متصلون</div>
          ) : (
            <div className="space-y-3">
              {offlineDrivers.map((driver) => (
                <DriverCard key={driver.id} driver={driver} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DriverCard({ driver }: { driver: Driver }) {
  const getTimeSinceUpdate = () => {
    if (!driver.last_location_at) return 'غير معروف';
    const lastUpdate = new Date(driver.last_location_at);
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return `منذ ${Math.floor(diffHours / 24)} يوم`;
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
          driver.is_online ? 'bg-green-500' : 'bg-gray-400'
        }`}>
          {driver.name.charAt(0)}
        </div>
        <div>
          <div className="font-medium">{driver.name}</div>
          <div className="text-sm text-gray-500">{driver.phone || '-'}</div>
        </div>
      </div>
      <div className="text-left">
        {driver.has_active_delivery && (
          <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mb-1">
            {driver.delivery_reference}
          </div>
        )}
        <div className="text-xs text-gray-500">{getTimeSinceUpdate()}</div>
        {driver.vehicle_name && (
          <div className="text-xs text-gray-400">{driver.vehicle_name}</div>
        )}
      </div>
    </div>
  );
}
