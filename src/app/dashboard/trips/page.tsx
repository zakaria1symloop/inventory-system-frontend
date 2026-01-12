'use client';

import { useState, useEffect } from 'react';
import { tripsApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Trip {
  id: number;
  seller_id: number;
  vehicle_id?: number;
  start_time: string;
  end_time?: string;
  status: 'active' | 'completed' | 'cancelled';
  notes?: string;
  seller?: { id: number; name: string };
  vehicle?: { id: number; name: string };
  stores_count?: number;
  orders_count?: number;
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchTrips();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Insert key or Alt+N: Add new trip
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        toast('قريباً - إضافة جولة جديدة');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchTrips = async () => {
    try {
      const response = await tripsApi.getAll();
      setTrips(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل الجولات');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('ar-DZ');
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      active: { class: 'badge-success', text: 'نشطة' },
      completed: { class: 'badge-info', text: 'مكتملة' },
      cancelled: { class: 'badge-danger', text: 'ملغية' },
    };
    return badges[status] || { class: 'badge-secondary', text: status };
  };

  const filteredTrips = trips.filter(t => {
    const matchesSearch = t.seller?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div>
      {/* Shortcuts hint */}
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg mb-4 flex items-center gap-6 text-sm">
        <span className="font-medium">اختصارات:</span>
        <span><kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">Insert</kbd> إضافة جديد</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">الجولات</h1>
      </div>

      <div className="card">
        <div className="flex gap-4 mb-4">
          <input type="text" placeholder="بحث بالبائع..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input max-w-xs" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select max-w-xs">
            <option value="">كل الحالات</option>
            <option value="active">نشطة</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغية</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>البائع</th>
              <th>المركبة</th>
              <th>وقت البدء</th>
              <th>وقت الانتهاء</th>
              <th>المتاجر</th>
              <th>الطلبات</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrips.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-500">لا توجد جولات</td></tr>
            ) : (
              filteredTrips.map((trip, index) => {
                const statusBadge = getStatusBadge(trip.status);
                return (
                  <tr key={trip.id}>
                    <td>{index + 1}</td>
                    <td className="font-medium">{trip.seller?.name || '-'}</td>
                    <td>{trip.vehicle?.name || '-'}</td>
                    <td>{formatDateTime(trip.start_time)}</td>
                    <td>{trip.end_time ? formatDateTime(trip.end_time) : '-'}</td>
                    <td>{trip.stores_count || 0}</td>
                    <td>{trip.orders_count || 0}</td>
                    <td><span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span></td>
                    <td>
                      <button onClick={() => toast('قريباً - عرض التفاصيل')} className="text-gray-600 hover:text-gray-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
