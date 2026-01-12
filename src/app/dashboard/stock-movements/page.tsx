'use client';

import { useState, useEffect, useRef } from 'react';
import { stockMovementsApi, productsApi, warehousesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface StockMovement {
  id: number;
  product_id: number;
  warehouse_id: number;
  user_id: number;
  type: string;
  reference: string;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  unit_cost: number;
  note: string;
  created_at: string;
  product?: { id: number; name: string; barcode: string };
  warehouse?: { id: number; name: string };
  user?: { id: number; name: string };
}

interface Summary {
  total_purchases: number;
  total_purchase_returns: number;
  total_sales: number;
  total_sale_returns: number;
  total_adjustments: number;
  total_deliveries: number;
  total_delivery_returns: number;
  net_movement: number;
}

interface Product {
  id: number;
  name: string;
}

interface Warehouse {
  id: number;
  name: string;
}

interface PaginatedResponse {
  data: StockMovement[];
  current_page: number;
  last_page: number;
  total: number;
}

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchWarehouses();
  }, []);

  useEffect(() => {
    fetchMovements();
    fetchSummary();
  }, [productFilter, warehouseFilter, typeFilter, directionFilter, fromDate, toDate, pagination.currentPage]);

  const fetchProducts = async () => {
    try {
      const response = await productsApi.getAll({ per_page: 1000 });
      setProducts(response.data.data || response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await warehousesApi.getAll();
      setWarehouses(response.data.data || response.data);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchMovements = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, unknown> = {
        page: pagination.currentPage,
        per_page: 20,
      };
      if (searchTerm) params.search = searchTerm;
      if (productFilter) params.product_id = productFilter;
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      if (typeFilter) params.type = typeFilter;
      if (directionFilter) params.direction = directionFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const response = await stockMovementsApi.getAll(params);
      const data = response.data as PaginatedResponse;
      setMovements(data.data || []);
      setPagination({
        currentPage: data.current_page,
        lastPage: data.last_page,
        total: data.total,
      });
    } catch (error) {
      toast.error('خطأ في تحميل حركات المخزون');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const response = await stockMovementsApi.getSummary(params);
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    fetchMovements();
  };

  const resetFilters = () => {
    setSearchTerm('');
    setProductFilter('');
    setWarehouseFilter('');
    setTypeFilter('');
    setDirectionFilter('');
    setFromDate('');
    setToDate('');
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleRefresh = () => {
    fetchMovements();
    fetchSummary();
    toast.success('تم تحديث البيانات');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // Allow Escape to work even in inputs
      if (e.key === 'Escape') {
        e.preventDefault();
        resetFilters();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // Focus search with / or Ctrl+K
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isInput) return;

      // Refresh with R
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRefresh();
        return;
      }

      // Previous page with [ or ArrowLeft
      if (e.key === '[' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (pagination.currentPage > 1) {
          setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
        }
        return;
      }

      // Next page with ] or ArrowRight
      if (e.key === ']' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (pagination.currentPage < pagination.lastPage) {
          setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pagination.currentPage, pagination.lastPage]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-DZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ar-DZ').format(value);
  };

  const getTypeBadge = (type: string) => {
    const types: Record<string, { class: string; text: string; icon: string }> = {
      purchase: { class: 'bg-green-100 text-green-800', text: 'شراء', icon: '↓' },
      purchase_return: { class: 'bg-red-100 text-red-800', text: 'مرتجع شراء', icon: '↑' },
      sale: { class: 'bg-blue-100 text-blue-800', text: 'بيع', icon: '↑' },
      sale_return: { class: 'bg-purple-100 text-purple-800', text: 'مرتجع بيع', icon: '↓' },
      adjustment: { class: 'bg-yellow-100 text-yellow-800', text: 'تسوية', icon: '⇄' },
      transfer: { class: 'bg-gray-100 text-gray-800', text: 'نقل', icon: '⇆' },
      delivery: { class: 'bg-orange-100 text-orange-800', text: 'تسليم', icon: '↑' },
      delivery_return: { class: 'bg-pink-100 text-pink-800', text: 'مرتجع تسليم', icon: '↓' },
      opening: { class: 'bg-indigo-100 text-indigo-800', text: 'رصيد افتتاحي', icon: '◉' },
    };
    return types[type] || { class: 'bg-gray-100 text-gray-800', text: type, icon: '?' };
  };

  const getQuantityColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (isLoading && movements.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div>
      {/* Keyboard Shortcuts Hint Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 mb-4 flex items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <kbd className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-xs font-mono">/</kbd>
          <span>بحث</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-xs font-mono">R</kbd>
          <span>تحديث</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-xs font-mono">Esc</kbd>
          <span>مسح الفلاتر</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-xs font-mono">[</kbd>
          <kbd className="px-2 py-0.5 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-xs font-mono">]</kbd>
          <span>تصفح الصفحات</span>
        </span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">حركات المخزون</h1>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div className="card p-4 text-center">
            <div className="text-sm text-gray-500">المشتريات</div>
            <div className="text-lg font-bold text-green-600">+{formatNumber(summary.total_purchases)}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-sm text-gray-500">مرتجع الشراء</div>
            <div className="text-lg font-bold text-red-600">-{formatNumber(summary.total_purchase_returns)}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-sm text-gray-500">المبيعات</div>
            <div className="text-lg font-bold text-blue-600">-{formatNumber(summary.total_sales)}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-sm text-gray-500">مرتجع المبيعات</div>
            <div className="text-lg font-bold text-purple-600">+{formatNumber(summary.total_sale_returns)}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-sm text-gray-500">التسويات</div>
            <div className="text-lg font-bold text-yellow-600">{formatNumber(summary.total_adjustments)}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-sm text-gray-500">التسليمات</div>
            <div className="text-lg font-bold text-orange-600">-{formatNumber(summary.total_deliveries)}</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-sm text-gray-500">مرتجع التسليم</div>
            <div className="text-lg font-bold text-pink-600">+{formatNumber(summary.total_delivery_returns)}</div>
          </div>
          <div className="card p-4 text-center bg-gray-50">
            <div className="text-sm text-gray-500">صافي الحركة</div>
            <div className={`text-lg font-bold ${summary.net_movement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.net_movement >= 0 ? '+' : ''}{formatNumber(summary.net_movement)}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="بحث بالمرجع أو المنتج..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="input"
          />
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="select"
          >
            <option value="">كل المنتجات</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
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
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="select"
          >
            <option value="">كل الأنواع</option>
            <option value="purchase">شراء</option>
            <option value="purchase_return">مرتجع شراء</option>
            <option value="sale">بيع</option>
            <option value="sale_return">مرتجع بيع</option>
            <option value="adjustment">تسوية</option>
            <option value="delivery">تسليم</option>
            <option value="delivery_return">مرتجع تسليم</option>
          </select>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="select"
          >
            <option value="">كل الاتجاهات</option>
            <option value="incoming">وارد</option>
            <option value="outgoing">صادر</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input flex-1"
              placeholder="من تاريخ"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input flex-1"
              placeholder="إلى تاريخ"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المنتج</th>
                <th>المستودع</th>
                <th>النوع</th>
                <th>المرجع</th>
                <th>قبل</th>
                <th>التغيير</th>
                <th>بعد</th>
                <th>سعر الوحدة</th>
                <th>المستخدم</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-500">
                    لا توجد حركات مخزون
                  </td>
                </tr>
              ) : (
                movements.map((movement) => {
                  const typeBadge = getTypeBadge(movement.type);
                  return (
                    <tr key={movement.id}>
                      <td className="whitespace-nowrap text-sm">
                        {formatDate(movement.created_at)}
                      </td>
                      <td>
                        <div className="font-medium">{movement.product?.name}</div>
                        <div className="text-xs text-gray-500">{movement.product?.barcode}</div>
                      </td>
                      <td>{movement.warehouse?.name}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${typeBadge.class}`}>
                          <span>{typeBadge.icon}</span>
                          {typeBadge.text}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{movement.reference || '-'}</td>
                      <td className="text-gray-600">{formatNumber(movement.quantity_before)}</td>
                      <td className={`font-bold ${getQuantityColor(movement.quantity_change)}`}>
                        {movement.quantity_change > 0 ? '+' : ''}{formatNumber(movement.quantity_change)}
                      </td>
                      <td className="font-medium">{formatNumber(movement.quantity_after)}</td>
                      <td>{movement.unit_cost ? formatCurrency(movement.unit_cost) : '-'}</td>
                      <td>{movement.user?.name || '-'}</td>
                      <td className="max-w-xs truncate" title={movement.note}>
                        {movement.note || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.lastPage > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-gray-500">
              إجمالي {formatNumber(pagination.total)} حركة
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                disabled={pagination.currentPage === 1}
                className="btn btn-secondary"
              >
                السابق
              </button>
              <span className="flex items-center px-4">
                صفحة {pagination.currentPage} من {pagination.lastPage}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                disabled={pagination.currentPage === pagination.lastPage}
                className="btn btn-secondary"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
