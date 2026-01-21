'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { salesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { DocumentTextIcon, TruckIcon, BanknotesIcon, ArrowDownTrayIcon, PencilIcon } from '@heroicons/react/24/outline';

interface Sale {
  id: number;
  reference: string;
  client_id?: number;
  warehouse_id: number;
  date: string;
  total_amount: number;
  discount: number;
  tax: number;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid';
  note?: string;
  client?: { id: number; name: string };
  warehouse?: { id: number; name: string };
}

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        router.push('/dashboard/sales/new');
      } else if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        router.push('/dashboard/sales/debtors');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const fetchData = async () => {
    try {
      const response = await salesApi.getAll();
      setSales(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    try {
      await salesApi.delete(id);
      toast.success('تم حذف الفاتورة بنجاح');
      fetchData();
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في حذف الفاتورة';
      toast.error(message);
    }
  };

  // Check if sale can be deleted (only unpaid with no payments)
  const canDelete = (sale: Sale) => {
    return sale.payment_status === 'unpaid' && sale.paid_amount === 0;
  };

  const handleDownloadFacture = async (id: number) => {
    try {
      const response = await salesApi.downloadFacture(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facture-${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Facture telechargee');
    } catch (error) {
      toast.error('Erreur lors du telechargement');
    }
  };

  const handleDownloadBonLivraison = async (id: number) => {
    try {
      const response = await salesApi.downloadBonLivraison(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bon-livraison-${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Bon de livraison telecharge');
    } catch (error) {
      toast.error('Erreur lors du telechargement');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-DZ');
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      pending: { class: 'badge-warning', text: 'معلق' },
      completed: { class: 'badge-success', text: 'مكتمل' },
      cancelled: { class: 'badge-danger', text: 'ملغي' },
    };
    return badges[status] || { class: 'badge-secondary', text: status };
  };

  const getPaymentBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      unpaid: { class: 'badge-danger', text: 'غير مدفوع' },
      partial: { class: 'badge-warning', text: 'جزئي' },
      paid: { class: 'badge-success', text: 'مدفوع' },
    };
    return badges[status] || { class: 'badge-secondary', text: status };
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch = s.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || s.status === statusFilter;
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
        <span><kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">Insert</kbd> فاتورة جديدة</span>
        <span><kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">Alt+D</kbd> الديون</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">المبيعات</h1>
        <div className="flex gap-3">
          <Link
            href="/dashboard/sales/debtors"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
          >
            <BanknotesIcon className="w-5 h-5" />
            الديون المستحقة
            <kbd className="bg-amber-600 px-1.5 py-0.5 rounded text-xs">Alt+D</kbd>
          </Link>
          <Link
            href="/dashboard/sales/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة فاتورة بيع
            <kbd className="bg-blue-700 px-1.5 py-0.5 rounded text-xs">Insert</kbd>
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="flex gap-4 mb-4">
          <input type="text" placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input max-w-xs" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select max-w-xs">
            <option value="">كل الحالات</option>
            <option value="pending">معلق</option>
            <option value="completed">مكتمل</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>المرجع</th>
              <th>العميل</th>
              <th>المستودع</th>
              <th>التاريخ</th>
              <th>الإجمالي</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
              <th>الحالة</th>
              <th>الدفع</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-gray-500">لا توجد فواتير بيع</td></tr>
            ) : (
              filteredSales.map((sale) => {
                const statusBadge = getStatusBadge(sale.status);
                const paymentBadge = getPaymentBadge(sale.payment_status);
                return (
                  <tr key={sale.id}>
                    <td className="font-medium">{sale.reference}</td>
                    <td>{sale.client?.name || 'عميل نقدي'}</td>
                    <td>{sale.warehouse?.name || '-'}</td>
                    <td>{formatDate(sale.date)}</td>
                    <td>{formatCurrency(sale.grand_total)}</td>
                    <td className="text-green-600">{formatCurrency(sale.paid_amount)}</td>
                    <td className="text-red-600">{formatCurrency(sale.due_amount)}</td>
                    <td><span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span></td>
                    <td><span className={`badge ${paymentBadge.class}`}>{paymentBadge.text}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <Link href={`/dashboard/sales/edit/${sale.id}`} className="text-amber-600 hover:text-amber-800" title="تعديل">
                          <PencilIcon className="w-5 h-5" />
                        </Link>
                        <Link href={`/dashboard/sales/${sale.id}`} className="text-blue-600 hover:text-blue-800" title="عرض الفاتورة">
                          <DocumentTextIcon className="w-5 h-5" />
                        </Link>
                        <button onClick={() => handleDownloadFacture(sale.id)} className="text-red-600 hover:text-red-800" title="تحميل الفاتورة PDF">
                          <ArrowDownTrayIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDownloadBonLivraison(sale.id)} className="text-green-600 hover:text-green-800" title="Bon de Livraison">
                          <TruckIcon className="w-5 h-5" />
                        </button>
                        {canDelete(sale) && (
                          <button onClick={() => handleDelete(sale.id)} className="text-red-600 hover:text-red-800" title="حذف">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
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
