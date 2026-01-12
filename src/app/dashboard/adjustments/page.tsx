'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { adjustmentsApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Adjustment {
  id: number;
  reference: string;
  warehouse_id: number;
  user_id: number;
  date: string;
  type: 'addition' | 'subtraction';
  reason?: string;
  total_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  warehouse?: { id: number; name: string };
  user?: { id: number; name: string };
}

export default function AdjustmentsPage() {
  const router = useRouter();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchAdjustments();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Insert key or Alt+N: navigate to new adjustment
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        router.push('/dashboard/adjustments/new');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const fetchAdjustments = async () => {
    try {
      const response = await adjustmentsApi.getAll();
      setAdjustments(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل التعديلات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (!confirm('هل أنت متأكد من الموافقة على هذا التعديل؟')) return;
    try {
      await adjustmentsApi.approve(id);
      toast.success('تمت الموافقة بنجاح');
      fetchAdjustments();
    } catch (error) {
      toast.error('خطأ في الموافقة');
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('هل أنت متأكد من رفض هذا التعديل؟')) return;
    try {
      await adjustmentsApi.reject(id);
      toast.success('تم الرفض بنجاح');
      fetchAdjustments();
    } catch (error) {
      toast.error('خطأ في الرفض');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-DZ');
  };

  const getTypeBadge = (type: string) => {
    return type === 'addition'
      ? { class: 'badge-success', text: 'إضافة' }
      : { class: 'badge-danger', text: 'خصم' };
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      pending: { class: 'badge-warning', text: 'معلق' },
      approved: { class: 'badge-success', text: 'موافق عليه' },
      rejected: { class: 'badge-danger', text: 'مرفوض' },
    };
    return badges[status] || { class: 'badge-secondary', text: status };
  };

  const filteredAdjustments = adjustments.filter(a => {
    const matchesSearch = a.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || a.status === statusFilter;
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
        <h1 className="text-2xl font-bold">تعديلات المخزون</h1>
        <button onClick={() => router.push('/dashboard/adjustments/new')} className="btn btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          إضافة تعديل
          <kbd className="bg-blue-700 px-1.5 py-0.5 rounded text-xs mr-2">Insert</kbd>
        </button>
      </div>

      <div className="card">
        <div className="flex gap-4 mb-4">
          <input type="text" placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input max-w-xs" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select max-w-xs">
            <option value="">كل الحالات</option>
            <option value="pending">معلق</option>
            <option value="approved">موافق عليه</option>
            <option value="rejected">مرفوض</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>المرجع</th>
              <th>المستودع</th>
              <th>المستخدم</th>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>القيمة</th>
              <th>السبب</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredAdjustments.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-500">لا توجد تعديلات</td></tr>
            ) : (
              filteredAdjustments.map((adj) => {
                const typeBadge = getTypeBadge(adj.type);
                const statusBadge = getStatusBadge(adj.status);
                return (
                  <tr key={adj.id}>
                    <td className="font-medium">{adj.reference}</td>
                    <td>{adj.warehouse?.name || '-'}</td>
                    <td>{adj.user?.name || '-'}</td>
                    <td>{formatDate(adj.date)}</td>
                    <td><span className={`badge ${typeBadge.class}`}>{typeBadge.text}</span></td>
                    <td>{formatCurrency(adj.total_amount)}</td>
                    <td>{adj.reason || '-'}</td>
                    <td><span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => router.push(`/dashboard/adjustments/${adj.id}`)} className="text-blue-600 hover:text-blue-800" title="عرض التفاصيل">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {adj.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(adj.id)} className="text-green-600 hover:text-green-800" title="موافقة">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button onClick={() => handleReject(adj.id)} className="text-red-600 hover:text-red-800" title="رفض">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
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
