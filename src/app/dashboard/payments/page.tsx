'use client';

import { useState, useEffect } from 'react';
import { paymentsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth';
import toast from 'react-hot-toast';

interface Payment {
  id: number;
  reference: string;
  payable_type: string;
  payable_id: number;
  amount: number;
  payment_method: 'cash' | 'bank' | 'check' | 'other';
  date: string;
  notes?: string;
  user_id: number;
  user?: { id: number; name: string };
}

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await paymentsApi.getAll();
      setPayments(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل المدفوعات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟')) return;
    try {
      await paymentsApi.delete(id);
      toast.success('تم حذف الدفعة بنجاح');
      fetchPayments();
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في حذف الدفعة';
      toast.error(message);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-DZ');
  };

  const getMethodBadge = (method: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      cash: { class: 'badge-success', text: 'نقدي' },
      bank: { class: 'badge-info', text: 'تحويل بنكي' },
      check: { class: 'badge-warning', text: 'شيك' },
      other: { class: 'badge-secondary', text: 'أخرى' },
    };
    return badges[method] || { class: 'badge-secondary', text: method };
  };

  const getPayableType = (type: string) => {
    if (type.includes('Purchase')) return 'شراء';
    if (type.includes('Sale')) return 'بيع';
    return type;
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = !methodFilter || p.payment_method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Insert or Alt+N: Open add modal (if it exists)
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        // Add modal functionality can be added here when implemented
        toast('وظيفة الإضافة غير متوفرة في هذه الصفحة', { icon: 'ℹ️' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        <h1 className="text-2xl font-bold">المدفوعات</h1>
      </div>

      <div className="card">
        <div className="flex gap-4 mb-4">
          <input type="text" placeholder="بحث بالمرجع..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input max-w-xs" />
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="select max-w-xs">
            <option value="">كل طرق الدفع</option>
            <option value="cash">نقدي</option>
            <option value="bank">تحويل بنكي</option>
            <option value="check">شيك</option>
            <option value="other">أخرى</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>المرجع</th>
              <th>النوع</th>
              <th>المبلغ</th>
              <th>طريقة الدفع</th>
              <th>التاريخ</th>
              <th>المستخدم</th>
              <th>ملاحظات</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">لا توجد مدفوعات</td></tr>
            ) : (
              filteredPayments.map((payment) => {
                const methodBadge = getMethodBadge(payment.payment_method);
                return (
                  <tr key={payment.id}>
                    <td className="font-medium">{payment.reference}</td>
                    <td>{getPayableType(payment.payable_type)}</td>
                    <td className="text-green-600 font-medium">{formatCurrency(payment.amount)}</td>
                    <td><span className={`badge ${methodBadge.class}`}>{methodBadge.text}</span></td>
                    <td>{formatDate(payment.date)}</td>
                    <td>{payment.user?.name || '-'}</td>
                    <td>{payment.notes || '-'}</td>
                    <td>
                      {isAdmin && (
                        <button onClick={() => handleDelete(payment.id)} className="text-red-600 hover:text-red-800" title="حذف (للمدير فقط)">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
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
