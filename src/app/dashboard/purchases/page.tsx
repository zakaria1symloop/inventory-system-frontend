'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { purchasesApi, suppliersApi, warehousesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Purchase {
  id: number;
  reference: string;
  supplier_id: number;
  warehouse_id: number;
  date: string;
  total_amount: number;
  discount: number;
  tax: number;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  status: 'pending' | 'received' | 'partial';
  payment_status: 'unpaid' | 'partial' | 'paid';
  note?: string;
  supplier?: { id: number; name: string };
  warehouse?: { id: number; name: string };
}

interface Supplier { id: number; name: string; }
interface Warehouse { id: number; name: string; }

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        router.push('/dashboard/purchases/new');
      } else if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        router.push('/dashboard/purchases/creditors');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const fetchData = async () => {
    try {
      const [purchasesRes, suppliersRes, warehousesRes] = await Promise.all([
        purchasesApi.getAll(),
        suppliersApi.getAll(),
        warehousesApi.getAll(),
      ]);
      setPurchases(purchasesRes.data.data || purchasesRes.data);
      setSuppliers(suppliersRes.data.data || suppliersRes.data);
      setWarehouses(warehousesRes.data.data || warehousesRes.data);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    try {
      await purchasesApi.delete(id);
      toast.success('تم حذف الفاتورة بنجاح');
      fetchData();
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في حذف الفاتورة';
      toast.error(message);
    }
  };

  // Check if purchase can be deleted (only unpaid with no payments)
  const canDelete = (purchase: Purchase) => {
    return purchase.payment_status === 'unpaid' && purchase.paid_amount === 0;
  };

  const handleDownloadFacture = async (id: number, reference: string) => {
    try {
      const response = await purchasesApi.downloadFacture(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bon-achat-${reference}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('تم تحميل الفاتورة بنجاح');
    } catch (error) {
      toast.error('خطأ في تحميل الفاتورة');
    }
  };

  const handleDownloadBonCommande = async (id: number, reference: string) => {
    try {
      const response = await purchasesApi.downloadBonCommande(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bon-commande-${reference}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('تم تحميل بون الطلب بنجاح');
    } catch (error) {
      toast.error('خطأ في تحميل بون الطلب');
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
      received: { class: 'badge-success', text: 'مستلم' },
      partial: { class: 'badge-info', text: 'جزئي' },
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

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || p.status === statusFilter;
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
        <h1 className="text-2xl font-bold">المشتريات</h1>
        <div className="flex gap-3">
          <Link
            href="/dashboard/purchases/creditors"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            الديون للموردين
            <kbd className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs">Alt+D</kbd>
          </Link>
          <Link href="/dashboard/purchases/new" className="btn btn-primary inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            إضافة فاتورة شراء
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
            <option value="received">مستلم</option>
            <option value="partial">جزئي</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>المرجع</th>
              <th>المورد</th>
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
            {filteredPurchases.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-gray-500">لا توجد فواتير شراء</td></tr>
            ) : (
              filteredPurchases.map((purchase) => {
                const statusBadge = getStatusBadge(purchase.status);
                const paymentBadge = getPaymentBadge(purchase.payment_status);
                return (
                  <tr key={purchase.id}>
                    <td className="font-medium">{purchase.reference}</td>
                    <td>{purchase.supplier?.name || '-'}</td>
                    <td>{purchase.warehouse?.name || '-'}</td>
                    <td>{formatDate(purchase.date)}</td>
                    <td>{formatCurrency(purchase.grand_total)}</td>
                    <td className="text-green-600">{formatCurrency(purchase.paid_amount)}</td>
                    <td className="text-red-600">{formatCurrency(purchase.due_amount)}</td>
                    <td><span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span></td>
                    <td><span className={`badge ${paymentBadge.class}`}>{paymentBadge.text}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <Link href={`/dashboard/purchases/edit/${purchase.id}`} className="text-amber-600 hover:text-amber-800" title="تعديل">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <Link href={`/dashboard/purchases/${purchase.id}`} className="text-gray-600 hover:text-gray-800" title="عرض">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <button onClick={() => handleDownloadFacture(purchase.id, purchase.reference)} className="text-blue-600 hover:text-blue-800" title="بون الشراء">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDownloadBonCommande(purchase.id, purchase.reference)} className="text-green-600 hover:text-green-800" title="بون الطلب">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </button>
                        {canDelete(purchase) && (
                          <button onClick={() => handleDelete(purchase.id)} className="text-red-600 hover:text-red-800" title="حذف">
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
