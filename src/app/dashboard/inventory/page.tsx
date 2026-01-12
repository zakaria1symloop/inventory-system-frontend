'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { inventoryApi, warehousesApi, categoriesApi, stockMovementsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  ChartBarIcon,
  ArrowPathIcon,
  PlusIcon,
  MinusIcon,
  CheckCircleIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface Product {
  id: number;
  name: string;
  barcode: string;
  cost_price: number;
  retail_price: number;
  stock_alert: number;
  pieces_per_package: number;
  total_stock: number;
  available_stock?: number;
  category?: { id: number; name: string };
  brand?: { id: number; name: string };
  unit_sale?: { id: number; name: string; short_name: string };
  stock?: Array<{ warehouse_id: number; quantity: number; warehouse?: { id: number; name: string } }>;
}

interface Warehouse {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

interface EditingProduct {
  productId: number;
  warehouseId: number;
  currentQty: number;
  newQty: string;
  mode: 'adjust' | 'transfer';
  toWarehouseId?: string;
  reason?: string;
  isLoss?: boolean;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Inline editing state
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    totalValue: 0,
  });

  // Ref for search input
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedWarehouse, selectedCategory, stockFilter, searchTerm, currentPage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (except Escape)
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // Escape - cancel editing or clear filters
      if (e.key === 'Escape') {
        if (editingProduct) {
          cancelEditing();
        } else if (isInputFocused) {
          (target as HTMLInputElement).blur();
        } else if (searchTerm || selectedWarehouse || selectedCategory || stockFilter) {
          setSearchTerm('');
          setSelectedWarehouse('');
          setSelectedCategory('');
          setStockFilter('');
          setCurrentPage(1);
        }
        return;
      }

      // Skip other shortcuts if typing in an input
      if (isInputFocused) return;

      // Ctrl+K or / - Focus search
      if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // R - Refresh data
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        fetchProducts();
        return;
      }

      // 1 - Filter: In stock
      if (e.key === '1') {
        e.preventDefault();
        setStockFilter(stockFilter === 'in_stock' ? '' : 'in_stock');
        setCurrentPage(1);
        return;
      }

      // 2 - Filter: Low stock
      if (e.key === '2') {
        e.preventDefault();
        setStockFilter(stockFilter === 'low_stock' ? '' : 'low_stock');
        setCurrentPage(1);
        return;
      }

      // 3 - Filter: Out of stock
      if (e.key === '3') {
        e.preventDefault();
        setStockFilter(stockFilter === 'out_of_stock' ? '' : 'out_of_stock');
        setCurrentPage(1);
        return;
      }

      // Arrow Left - Previous page
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        e.preventDefault();
        setCurrentPage(p => p - 1);
        return;
      }

      // Arrow Right - Next page
      if (e.key === 'ArrowRight' && currentPage < totalPages) {
        e.preventDefault();
        setCurrentPage(p => p + 1);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingProduct, searchTerm, selectedWarehouse, selectedCategory, stockFilter, currentPage, totalPages]);

  const fetchInitialData = async () => {
    try {
      const [warehousesRes, categoriesRes] = await Promise.all([
        warehousesApi.getAll(),
        categoriesApi.getAll(),
      ]);
      setWarehouses(warehousesRes.data.data || warehousesRes.data);
      setCategories(categoriesRes.data.data || categoriesRes.data);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: currentPage,
        per_page: 30,
      };
      if (searchTerm) params.search = searchTerm;
      if (selectedWarehouse) params.warehouse_id = selectedWarehouse;
      if (selectedCategory) params.category_id = selectedCategory;
      if (stockFilter) params.stock_status = stockFilter;

      const response = await inventoryApi.getAll(params);
      const data = response.data;
      setProducts(data.data || []);
      setTotalPages(data.last_page || 1);

      // Calculate stats
      const allProducts = data.data || [];
      const inStock = allProducts.filter((p: Product) => p.total_stock > p.stock_alert).length;
      const lowStock = allProducts.filter((p: Product) => p.total_stock > 0 && p.total_stock <= p.stock_alert).length;
      const outOfStock = allProducts.filter((p: Product) => p.total_stock <= 0).length;
      const totalValue = allProducts.reduce((sum: number, p: Product) => sum + (p.total_stock * p.cost_price), 0);

      setStats({
        totalProducts: data.total || allProducts.length,
        inStock,
        lowStock,
        outOfStock,
        totalValue,
      });
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (product: Product, warehouseId: number, currentQty: number, mode: 'adjust' | 'transfer') => {
    setEditingProduct({
      productId: product.id,
      warehouseId,
      currentQty,
      newQty: currentQty.toString(),
      mode,
      toWarehouseId: '',
      reason: '',
    });
  };

  const cancelEditing = () => {
    setEditingProduct(null);
  };

  const handleQuickAdjust = async (type: 'add' | 'remove', amount: number = 1) => {
    if (!editingProduct) return;

    const newQty = type === 'add'
      ? editingProduct.currentQty + amount
      : Math.max(0, editingProduct.currentQty - amount);

    setEditingProduct({
      ...editingProduct,
      newQty: newQty.toString(),
    });
  };

  const saveAdjustment = async () => {
    if (!editingProduct) return;

    const newQty = parseFloat(editingProduct.newQty);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('الكمية غير صالحة');
      return;
    }

    if (newQty === editingProduct.currentQty) {
      cancelEditing();
      return;
    }

    const isReducing = newQty < editingProduct.currentQty;

    setIsProcessing(true);
    try {
      await inventoryApi.adjust({
        product_id: editingProduct.productId,
        warehouse_id: editingProduct.warehouseId,
        quantity: newQty,
        type: 'set',
        reason: editingProduct.reason || (editingProduct.isLoss ? 'خسارة مخزون' : 'تعديل مباشر'),
        is_loss: isReducing && editingProduct.isLoss,
      });
      toast.success(editingProduct.isLoss ? 'تم تسجيل الخسارة' : 'تم تعديل المخزون');
      cancelEditing();
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'خطأ في التعديل');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveTransfer = async () => {
    if (!editingProduct || !editingProduct.toWarehouseId) {
      toast.error('اختر المستودع الهدف');
      return;
    }

    const qty = parseFloat(editingProduct.newQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('الكمية غير صالحة');
      return;
    }

    if (qty > editingProduct.currentQty) {
      toast.error('الكمية أكبر من المتوفر');
      return;
    }

    setIsProcessing(true);
    try {
      await inventoryApi.transfer({
        product_id: editingProduct.productId,
        from_warehouse_id: editingProduct.warehouseId,
        to_warehouse_id: parseInt(editingProduct.toWarehouseId),
        quantity: qty,
        notes: editingProduct.reason,
      });
      toast.success('تم التحويل بنجاح');
      cancelEditing();
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'خطأ في التحويل');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const getStockStatusBadge = (product: Product) => {
    if (product.total_stock <= 0) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">نفذ</span>;
    }
    if (product.total_stock <= product.stock_alert) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">منخفض</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">متوفر</span>;
  };

  const getDefaultWarehouse = () => {
    if (selectedWarehouse) return parseInt(selectedWarehouse);
    return warehouses.length > 0 ? warehouses[0].id : 0;
  };

  const getProductStockForWarehouse = (product: Product, warehouseId: number) => {
    const stock = product.stock?.find(s => s.warehouse_id === warehouseId);
    return stock?.quantity || 0;
  };

  if (isLoading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Keyboard Shortcuts Hint Bar */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">اختصارات لوحة المفاتيح:</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">/</kbd> بحث</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">R</kbd> تحديث</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">1</kbd> متوفر</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">2</kbd> منخفض</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">3</kbd> نفذ</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">&#8592;</kbd><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono mr-0.5">&#8594;</kbd> الصفحات</span>
          <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">Esc</kbd> إلغاء/مسح</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">إدارة المخزون</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">تتبع ومراقبة مخزون المنتجات</p>
        </div>
        <button
          onClick={() => fetchProducts()}
          className="btn btn-secondary"
        >
          <ArrowPathIcon className="w-5 h-5" />
          تحديث
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <CubeIcon className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-xs text-gray-500">المنتجات</p>
              <p className="text-lg font-bold">{stats.totalProducts}</p>
            </div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-gray-500">متوفر</p>
              <p className="text-lg font-bold text-green-600">{stats.inStock}</p>
            </div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-xs text-gray-500">منخفض</p>
              <p className="text-lg font-bold text-yellow-600">{stats.lowStock}</p>
            </div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <XMarkIcon className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-xs text-gray-500">نفذ</p>
              <p className="text-lg font-bold text-red-600">{stats.outOfStock}</p>
            </div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-xs text-gray-500">القيمة</p>
              <p className="text-sm font-bold text-purple-600">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pr-9 text-sm"
            />
          </div>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="select text-sm"
          >
            <option value="">كل المستودعات</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="select text-sm"
          >
            <option value="">كل الفئات</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="select text-sm"
          >
            <option value="">كل الحالات</option>
            <option value="in_stock">متوفر</option>
            <option value="low_stock">منخفض</option>
            <option value="out_of_stock">نفذ</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-right px-4 py-3 text-sm">المنتج</th>
                <th className="text-right px-4 py-3 text-sm">الفئة</th>
                <th className="text-center px-4 py-3 text-sm">الوحدة</th>
                {selectedWarehouse ? (
                  <th className="text-center px-4 py-3 text-sm">الكمية</th>
                ) : (
                  warehouses.slice(0, 3).map(wh => (
                    <th key={wh.id} className="text-center px-4 py-3 text-sm">{wh.name}</th>
                  ))
                )}
                <th className="text-center px-4 py-3 text-sm">الإجمالي</th>
                <th className="text-center px-4 py-3 text-sm">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={selectedWarehouse ? 6 : 5 + Math.min(3, warehouses.length)} className="text-center py-8 text-gray-500">
                    لا توجد منتجات
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const isEditing = editingProduct?.productId === product.id;

                  return (
                    <tr key={product.id} className={isEditing ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-sm">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.barcode}</div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{product.category?.name || '-'}</td>
                      <td className="px-4 py-2 text-center text-sm">
                        {product.unit_sale?.short_name || '-'}
                        {product.pieces_per_package > 1 && (
                          <span className="text-xs text-blue-600 block">({product.pieces_per_package})</span>
                        )}
                      </td>

                      {selectedWarehouse ? (
                        <td className="px-4 py-2 text-center">
                          {isEditing && editingProduct?.warehouseId === parseInt(selectedWarehouse) ? (
                            <div className="flex items-center justify-center gap-1">
                              {editingProduct.mode === 'adjust' ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleQuickAdjust('remove')}
                                      className="p-1 bg-red-100 hover:bg-red-200 rounded"
                                      disabled={isProcessing}
                                    >
                                      <MinusIcon className="w-4 h-4 text-red-600" />
                                    </button>
                                    <input
                                      type="number"
                                      value={editingProduct.newQty}
                                      onChange={(e) => setEditingProduct({ ...editingProduct, newQty: e.target.value })}
                                      className="w-16 text-center border rounded px-1 py-0.5 text-sm"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleQuickAdjust('add')}
                                      className="p-1 bg-green-100 hover:bg-green-200 rounded"
                                      disabled={isProcessing}
                                    >
                                      <PlusIcon className="w-4 h-4 text-green-600" />
                                    </button>
                                    <button
                                      onClick={saveAdjustment}
                                      className="p-1 bg-blue-500 hover:bg-blue-600 rounded ml-1"
                                      disabled={isProcessing}
                                    >
                                      <CheckIcon className="w-4 h-4 text-white" />
                                    </button>
                                    <button
                                      onClick={cancelEditing}
                                      className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                                      disabled={isProcessing}
                                    >
                                      <XMarkIcon className="w-4 h-4 text-gray-600" />
                                    </button>
                                  </div>
                                  {parseFloat(editingProduct.newQty) < editingProduct.currentQty && (
                                    <label className="flex items-center gap-1 text-xs text-red-600 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={editingProduct.isLoss || false}
                                        onChange={(e) => setEditingProduct({ ...editingProduct, isLoss: e.target.checked })}
                                        className="w-3 h-3"
                                      />
                                      خسارة (للتقارير)
                                    </label>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <input
                                    type="number"
                                    value={editingProduct.newQty}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, newQty: e.target.value })}
                                    className="w-16 text-center border rounded px-1 py-0.5 text-sm"
                                    placeholder="الكمية"
                                  />
                                  <select
                                    value={editingProduct.toWarehouseId}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, toWarehouseId: e.target.value })}
                                    className="text-xs border rounded px-1 py-0.5"
                                  >
                                    <option value="">إلى...</option>
                                    {warehouses.filter(w => w.id !== parseInt(selectedWarehouse)).map(w => (
                                      <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={saveTransfer}
                                    className="p-1 bg-purple-500 hover:bg-purple-600 rounded"
                                    disabled={isProcessing}
                                  >
                                    <CheckIcon className="w-4 h-4 text-white" />
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                                  >
                                    <XMarkIcon className="w-4 h-4 text-gray-600" />
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <span
                                className="font-bold cursor-pointer hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50"
                                onClick={() => startEditing(product, parseInt(selectedWarehouse), getProductStockForWarehouse(product, parseInt(selectedWarehouse)), 'adjust')}
                                title="انقر للتعديل"
                              >
                                {getProductStockForWarehouse(product, parseInt(selectedWarehouse))}
                              </span>
                              {warehouses.length > 1 && (
                                <button
                                  onClick={() => startEditing(product, parseInt(selectedWarehouse), getProductStockForWarehouse(product, parseInt(selectedWarehouse)), 'transfer')}
                                  className="text-xs text-purple-600 hover:text-purple-800 px-1"
                                  title="تحويل"
                                >
                                  ⇄
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      ) : (
                        warehouses.slice(0, 3).map(wh => {
                          const qty = getProductStockForWarehouse(product, wh.id);
                          const isEditingThis = isEditing && editingProduct?.warehouseId === wh.id;

                          return (
                            <td key={wh.id} className="px-4 py-2 text-center">
                              {isEditingThis ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleQuickAdjust('remove')}
                                      className="p-0.5 bg-red-100 hover:bg-red-200 rounded"
                                      disabled={isProcessing}
                                    >
                                      <MinusIcon className="w-3 h-3 text-red-600" />
                                    </button>
                                    <input
                                      type="number"
                                      value={editingProduct?.newQty}
                                      onChange={(e) => setEditingProduct({ ...editingProduct!, newQty: e.target.value })}
                                      className="w-12 text-center border rounded px-1 py-0.5 text-xs"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleQuickAdjust('add')}
                                      className="p-0.5 bg-green-100 hover:bg-green-200 rounded"
                                      disabled={isProcessing}
                                    >
                                      <PlusIcon className="w-3 h-3 text-green-600" />
                                    </button>
                                    <button
                                      onClick={saveAdjustment}
                                      className="p-0.5 bg-blue-500 hover:bg-blue-600 rounded"
                                      disabled={isProcessing}
                                    >
                                      <CheckIcon className="w-3 h-3 text-white" />
                                    </button>
                                    <button
                                      onClick={cancelEditing}
                                      className="p-0.5 bg-gray-200 hover:bg-gray-300 rounded"
                                    >
                                      <XMarkIcon className="w-3 h-3 text-gray-600" />
                                    </button>
                                  </div>
                                  {editingProduct && parseFloat(editingProduct.newQty) < editingProduct.currentQty && (
                                    <label className="flex items-center gap-1 text-xs text-red-600 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={editingProduct.isLoss || false}
                                        onChange={(e) => setEditingProduct({ ...editingProduct, isLoss: e.target.checked })}
                                        className="w-3 h-3"
                                      />
                                      خسارة
                                    </label>
                                  )}
                                </div>
                              ) : (
                                <span
                                  className={`cursor-pointer hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 ${qty > 0 ? 'font-medium' : 'text-gray-400'}`}
                                  onClick={() => startEditing(product, wh.id, qty, 'adjust')}
                                  title="انقر للتعديل"
                                >
                                  {qty}
                                </span>
                              )}
                            </td>
                          );
                        })
                      )}

                      <td className="px-4 py-2 text-center font-bold text-lg">{product.total_stock || 0}</td>
                      <td className="px-4 py-2 text-center">{getStockStatusBadge(product)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary text-sm py-1 px-3"
            >
              السابق
            </button>
            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-secondary text-sm py-1 px-3"
            >
              التالي
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        💡 انقر على أي كمية لتعديلها مباشرة | استخدم ⇄ للتحويل بين المستودعات
      </div>
    </div>
  );
}
