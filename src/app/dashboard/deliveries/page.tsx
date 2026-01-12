'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { deliveriesApi, ordersApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Delivery {
  id: number;
  reference: string;
  livreur_id: number;
  vehicle_id?: number;
  date: string;
  start_time?: string;
  end_time?: string;
  status: 'preparing' | 'in_progress' | 'completed' | 'cancelled';
  total_orders: number;
  delivered_count: number;
  failed_count: number;
  notes?: string;
  livreur?: { id: number; name: string };
  vehicle?: { id: number; name: string };
}

interface Order {
  id: number;
  reference: string;
  client_id: number;
  grand_total: number;
  status: string;
  client?: { id: number; name: string; address?: string; phone?: string };
}

export default function DeliveriesPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Insert key or Alt+N: Navigate to new delivery
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        router.push('/dashboard/deliveries/new');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const fetchData = async () => {
    try {
      const [deliveriesRes, ordersRes] = await Promise.all([
        deliveriesApi.getAll(),
        ordersApi.getUnassigned(),
      ]);
      setDeliveries(deliveriesRes.data.data || deliveriesRes.data);
      setConfirmedOrders(ordersRes.data || []);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('ar-DZ');

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      preparing: { class: 'badge-warning', text: 'قيد التحضير' },
      in_progress: { class: 'badge-info', text: 'جاري التوصيل' },
      completed: { class: 'badge-success', text: 'مكتمل' },
      cancelled: { class: 'badge-danger', text: 'ملغي' },
    };
    return badges[status] || { class: 'badge-secondary', text: status };
  };

  const filteredDeliveries = deliveries.filter(d => !statusFilter || d.status === statusFilter);

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
        <h1 className="text-2xl font-bold">إدارة التوصيل</h1>
        <Link href="/dashboard/deliveries/new" className="btn btn-primary flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          إنشاء توصيل جديد
          <kbd className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs mr-1">Insert</kbd>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-yellow-50 border border-yellow-200">
          <div className="text-yellow-600 text-sm">قيد التحضير</div>
          <div className="text-2xl font-bold text-yellow-700">
            {deliveries.filter(d => d.status === 'preparing').length}
          </div>
        </div>
        <div className="card bg-blue-50 border border-blue-200">
          <div className="text-blue-600 text-sm">جاري التوصيل</div>
          <div className="text-2xl font-bold text-blue-700">
            {deliveries.filter(d => d.status === 'in_progress').length}
          </div>
        </div>
        <div className="card bg-green-50 border border-green-200">
          <div className="text-green-600 text-sm">مكتمل</div>
          <div className="text-2xl font-bold text-green-700">
            {deliveries.filter(d => d.status === 'completed').length}
          </div>
        </div>
        <div className="card bg-orange-50 border border-orange-200">
          <div className="text-orange-600 text-sm">طلبات جاهزة للتوصيل</div>
          <div className="text-2xl font-bold text-orange-700">{confirmedOrders.length}</div>
        </div>
      </div>

      {/* Deliveries List */}
      <div className="card">
        <div className="flex gap-4 mb-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select max-w-xs">
            <option value="">كل الحالات</option>
            <option value="preparing">قيد التحضير</option>
            <option value="in_progress">جاري التوصيل</option>
            <option value="completed">مكتمل</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>المرجع</th>
              <th>السائق</th>
              <th>المركبة</th>
              <th>التاريخ</th>
              <th>الطلبات</th>
              <th>تم التسليم</th>
              <th>فشل/مرجع</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliveries.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-500">لا توجد توصيلات</td></tr>
            ) : (
              filteredDeliveries.map((delivery) => {
                const statusBadge = getStatusBadge(delivery.status);
                const pendingCount = delivery.total_orders - delivery.delivered_count - delivery.failed_count;
                return (
                  <tr key={delivery.id}>
                    <td className="font-medium">{delivery.reference}</td>
                    <td>{delivery.livreur?.name || '-'}</td>
                    <td>{delivery.vehicle?.name || '-'}</td>
                    <td>{formatDate(delivery.date)}</td>
                    <td>{delivery.total_orders}</td>
                    <td className="text-green-600 font-medium">{delivery.delivered_count}</td>
                    <td className="text-red-600">{delivery.failed_count}</td>
                    <td><span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span></td>
                    <td>
                      <Link
                        href={`/dashboard/deliveries/${delivery.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
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
