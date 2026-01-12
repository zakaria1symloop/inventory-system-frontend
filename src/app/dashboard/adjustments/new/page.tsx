'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adjustmentsApi, productsApi, warehousesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  cost_price: number;
  selling_price: number;
  unit?: { id: number; name: string };
}

interface Warehouse {
  id: number;
  name: string;
}

interface AdjustmentItem {
  product_id: number;
  product: Product;
  quantity: number;
  unit_price: number;
}

export default function NewAdjustmentPage() {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Form data
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'addition' | 'subtraction'>('addition');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<AdjustmentItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [warehousesRes, productsRes] = await Promise.all([
        warehousesApi.getAll(),
        productsApi.getAll({ per_page: 1000 })
      ]);
      setWarehouses(warehousesRes.data.data || warehousesRes.data);
      setProducts(productsRes.data.data || productsRes.data);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const product = products.find(
        p => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim()
      );
      if (product) {
        addProduct(product);
        setBarcodeInput('');
      } else {
        toast.error('المنتج غير موجود');
      }
    }
  };

  const addProduct = (product: Product) => {
    const existingIndex = items.findIndex(item => item.product_id === product.id);
    if (existingIndex > -1) {
      // Increase quantity if already exists
      const newItems = [...items];
      newItems[existingIndex].quantity += 1;
      setItems(newItems);
    } else {
      // Add new product
      setItems([...items, {
        product_id: product.id,
        product: product,
        quantity: 1,
        unit_price: product.cost_price
      }]);
    }
    setShowProductSearch(false);
    setSearchTerm('');
    barcodeInputRef.current?.focus();
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    const newItems = [...items];
    newItems[index].quantity = quantity;
    setItems(newItems);
  };

  const updateItemPrice = (index: number, price: number) => {
    if (price < 0) return;
    const newItems = [...items];
    newItems[index].unit_price = price;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const getTotalAmount = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const handleSubmit = async () => {
    if (!warehouseId) {
      toast.error('يرجى اختيار المستودع');
      return;
    }
    if (items.length === 0) {
      toast.error('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    setIsSaving(true);
    try {
      const adjustmentData = {
        warehouse_id: warehouseId,
        date: date,
        type: type,
        reason: reason || null,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      };

      await adjustmentsApi.create(adjustmentData);
      toast.success('تم إنشاء التعديل بنجاح');
      router.push('/dashboard/adjustments');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'خطأ في إنشاء التعديل');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إضافة تعديل مخزون</h1>
        <button
          onClick={() => router.push('/dashboard/adjustments')}
          className="btn btn-secondary"
        >
          رجوع
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">معلومات التعديل</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">المستودع *</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(Number(e.target.value))}
                  className="select"
                >
                  <option value="">اختر المستودع</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">التاريخ *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع التعديل *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'addition' | 'subtraction')}
                  className="select"
                >
                  <option value="addition">إضافة (زيادة المخزون)</option>
                  <option value="subtraction">خصم (تقليل المخزون)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">السبب</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="سبب التعديل..."
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Products Card */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">المنتجات</h2>

            {/* Barcode Scanner Input */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeSearch}
                  placeholder="امسح الباركود أو أدخل SKU..."
                  className="input"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowProductSearch(true)}
                className="btn btn-primary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                بحث عن منتج
              </button>
            </div>

            {/* Product Search Modal */}
            {showProductSearch && (
              <div className="modal-overlay" onClick={() => setShowProductSearch(false)}>
                <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold mb-4">بحث عن منتج</h3>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث بالاسم أو SKU أو الباركود..."
                    className="input mb-4"
                    autoFocus
                  />
                  <div className="max-h-64 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">لا توجد نتائج</p>
                    ) : (
                      filteredProducts.slice(0, 20).map(product => (
                        <div
                          key={product.id}
                          onClick={() => addProduct(product)}
                          className="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-gray-500">{product.sku}</p>
                          </div>
                          <span className="text-sm text-gray-500">{formatCurrency(product.cost_price)}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setShowProductSearch(false)}
                      className="btn btn-secondary"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items Table */}
            {items.length > 0 ? (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>SKU</th>
                      <th>الوحدة</th>
                      <th>الكمية</th>
                      <th>سعر الوحدة</th>
                      <th>الإجمالي</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.product_id}>
                        <td className="font-medium">{item.product.name}</td>
                        <td className="text-gray-500">{item.product.sku}</td>
                        <td>{item.product.unit?.name || '-'}</td>
                        <td>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                            min="1"
                            className="input w-20 text-center"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="input w-28 text-center"
                          />
                        </td>
                        <td className="font-medium">{formatCurrency(item.quantity * item.unit_price)}</td>
                        <td>
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p>لم تتم إضافة أي منتجات بعد</p>
                <p className="text-sm">امسح الباركود أو ابحث عن منتج لإضافته</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Section */}
        <div className="lg:col-span-1">
          <div className="card sticky top-4">
            <h2 className="text-lg font-semibold mb-4">ملخص التعديل</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">نوع التعديل:</span>
                <span className={`font-medium ${type === 'addition' ? 'text-green-600' : 'text-red-600'}`}>
                  {type === 'addition' ? 'إضافة' : 'خصم'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">عدد المنتجات:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">إجمالي الكمية:</span>
                <span className="font-medium">{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">القيمة الإجمالية:</span>
                <span className="font-bold text-primary">{formatCurrency(getTotalAmount())}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSubmit}
                disabled={isSaving || items.length === 0}
                className="btn btn-primary w-full"
              >
                {isSaving ? (
                  <>
                    <div className="spinner w-4 h-4 border-2"></div>
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    إنشاء التعديل
                  </>
                )}
              </button>
              <button
                onClick={() => router.push('/dashboard/adjustments')}
                className="btn btn-secondary w-full"
              >
                إلغاء
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-4 text-center">
              سيتم إنشاء التعديل بحالة &quot;معلق&quot; ويحتاج للموافقة
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
