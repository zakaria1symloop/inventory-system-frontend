'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { saleReturnsApi, clientsApi, warehousesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface SaleReturnItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  reason?: string;
  product?: { id: number; name: string };
}

interface SaleReturn {
  id: number;
  reference: string;
  sale_id: number;
  client_id?: number;
  warehouse_id: number;
  date: string;
  total_amount: number;
  status: string;
  note?: string;
  sale?: { id: number; reference: string };
  client?: { id: number; name: string };
  warehouse?: { id: number; name: string };
  user?: { id: number; name: string };
  items?: SaleReturnItem[];
}

interface Client { id: number; name: string; }
interface Warehouse { id: number; name: string; }

export default function SaleReturnsPage() {
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedReturn, setSelectedReturn] = useState<SaleReturn | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [clientFilter, warehouseFilter, fromDate, toDate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Insert key or Alt+N: show info toast (no add modal exists)
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        toast('مرتجعات المبيعات تتم من صفحة فاتورة البيع', { icon: 'ℹ️' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, warehousesRes] = await Promise.all([
        clientsApi.getAll(),
        warehousesApi.getAll(),
      ]);
      setClients(clientsRes.data.data || clientsRes.data);
      setWarehouses(warehousesRes.data.data || warehousesRes.data);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const fetchReturns = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, unknown> = {};
      if (searchTerm) params.search = searchTerm;
      if (clientFilter) params.client_id = clientFilter;
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const response = await saleReturnsApi.getAll(params);
      setReturns(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل المرتجعات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchReturns();
  };

  const viewDetails = async (id: number) => {
    try {
      const response = await saleReturnsApi.getOne(id);
      setSelectedReturn(response.data);
    } catch (error) {
      toast.error('خطأ في تحميل التفاصيل');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-DZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredReturns = returns.filter((r) => {
    if (!searchTerm) return true;
    return r.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (isLoading && returns.length === 0) {
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
        <h1 className="text-2xl font-bold">مرتجعات المبيعات</h1>
      </div>

      <div className="card">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <input
            type="text"
            placeholder="بحث بالمرجع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="input"
          />
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="select"
          >
            <option value="">كل العملاء</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="select"
          >
            <option value="">كل المستودعات</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="input"
            placeholder="من تاريخ"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="input"
            placeholder="إلى تاريخ"
          />
        </div>

        {/* Table */}
        <table>
          <thead>
            <tr>
              <th>المرجع</th>
              <th>فاتورة البيع</th>
              <th>العميل</th>
              <th>المستودع</th>
              <th>التاريخ</th>
              <th>المبلغ</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  لا توجد مرتجعات
                </td>
              </tr>
            ) : (
              filteredReturns.map((ret) => (
                <tr key={ret.id}>
                  <td className="font-mono text-sm">{ret.reference}</td>
                  <td>
                    <Link href={`/dashboard/sales/${ret.sale_id}`} className="text-blue-600 hover:underline">
                      {ret.sale?.reference}
                    </Link>
                  </td>
                  <td>{ret.client?.name || 'عميل نقدي'}</td>
                  <td>{ret.warehouse?.name}</td>
                  <td>{formatDate(ret.date)}</td>
                  <td className="text-purple-600 font-medium">{formatCurrency(ret.total_amount)}</td>
                  <td>
                    <span className="badge bg-green-100 text-green-800">{ret.status}</span>
                  </td>
                  <td>
                    <button
                      onClick={() => viewDetails(ret.id)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">تفاصيل مرتجع المبيعات #{selectedReturn.reference}</h2>
              <button onClick={() => setSelectedReturn(null)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span className="text-gray-500">فاتورة البيع:</span>
                <span className="mr-2 font-medium">{selectedReturn.sale?.reference}</span>
              </div>
              <div>
                <span className="text-gray-500">العميل:</span>
                <span className="mr-2 font-medium">{selectedReturn.client?.name || 'عميل نقدي'}</span>
              </div>
              <div>
                <span className="text-gray-500">المستودع:</span>
                <span className="mr-2 font-medium">{selectedReturn.warehouse?.name}</span>
              </div>
              <div>
                <span className="text-gray-500">التاريخ:</span>
                <span className="mr-2 font-medium">{formatDate(selectedReturn.date)}</span>
              </div>
              <div>
                <span className="text-gray-500">المبلغ:</span>
                <span className="mr-2 font-medium text-purple-600">{formatCurrency(selectedReturn.total_amount)}</span>
              </div>
              <div>
                <span className="text-gray-500">المستخدم:</span>
                <span className="mr-2 font-medium">{selectedReturn.user?.name}</span>
              </div>
            </div>

            {selectedReturn.note && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <span className="text-gray-500">ملاحظات:</span>
                <p className="mt-1">{selectedReturn.note}</p>
              </div>
            )}

            <h3 className="font-semibold mb-2">المنتجات</h3>
            <table>
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الكمية</th>
                  <th>سعر الوحدة</th>
                  <th>الإجمالي</th>
                  <th>السبب</th>
                </tr>
              </thead>
              <tbody>
                {selectedReturn.items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product?.name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td>{formatCurrency(item.quantity * item.unit_price)}</td>
                    <td>{item.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <button onClick={() => setSelectedReturn(null)} className="btn btn-secondary">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
