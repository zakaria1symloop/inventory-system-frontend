'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ordersApi, clientsApi, productsApi, warehousesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  TrashIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

interface Client {
  id: number;
  name: string;
  phone?: string;
  address?: string;
}

interface Product {
  id: number;
  name: string;
  barcode?: string;
  retail_price: number;
  wholesale_price: number;
  min_selling_price: number;
  tax_percent: number;
  tax_type: 'exclusive' | 'inclusive';
  pieces_per_package: number;
  stock?: Array<{ warehouse_id: number; quantity: number }>;
}

interface Warehouse {
  id: number;
  name: string;
  is_main: boolean;
}

interface OrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  pieces_per_package: number;
  discount: number;
  tax_percent: number;
  tax_amount: number;
  subtotal: number;
  total_with_tax: number;
  available_stock: number;
  min_price: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedClient, setSelectedClient] = useState<number>(0);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number>(0);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [globalTaxRate, setGlobalTaxRate] = useState<number>(0); // Default TVA 0% - user controls

  // Available stock state (product_id -> available quantity)
  const [availableStockMap, setAvailableStockMap] = useState<Record<number, number>>({});
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  // Search state
  const [productSearch, setProductSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch available stock when warehouse changes
  useEffect(() => {
    if (selectedWarehouse) {
      fetchAvailableStock();
    }
  }, [selectedWarehouse]);

  const fetchAvailableStock = async () => {
    if (!selectedWarehouse) return;
    setIsLoadingStock(true);
    try {
      const response = await productsApi.getAvailableStockBulk(selectedWarehouse);
      const stockData = response.data;
      const stockMap: Record<number, number> = {};
      stockData.forEach((item: { product_id: number; available_stock: number }) => {
        stockMap[item.product_id] = item.available_stock;
      });
      setAvailableStockMap(stockMap);
    } catch (error) {
      console.error('Error fetching available stock:', error);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const fetchData = async () => {
    try {
      const [clientsRes, productsRes, warehousesRes] = await Promise.all([
        clientsApi.getAll({ per_page: 1000 }),
        productsApi.getAll({ per_page: 1000 }),
        warehousesApi.getAll(),
      ]);
      setClients(clientsRes.data.data || clientsRes.data);
      setProducts(productsRes.data.data || productsRes.data);
      const warehouseData = warehousesRes.data.data || warehousesRes.data;
      setWarehouses(warehouseData);
      const mainWarehouse = warehouseData.find((w: Warehouse) => w.is_main);
      if (mainWarehouse) setSelectedWarehouse(mainWarehouse.id);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const addProductToOrder = (product: Product) => {
    if (orderItems.find(item => item.product_id === product.id)) {
      toast.error('المنتج موجود بالفعل في الطلب');
      return;
    }

    if (!selectedWarehouse) {
      toast.error('يرجى اختيار المستودع أولاً');
      return;
    }

    // Use available stock from the map (considers reserved quantities)
    const availableStock = availableStockMap[product.id] ?? 0;

    if (availableStock < 1) {
      toast.error(`المنتج "${product.name}" غير متوفر في المخزون (الكمية المتاحة: ${availableStock})`);
      return;
    }

    const unitPrice = parseFloat(String(product.wholesale_price)) || parseFloat(String(product.retail_price)) || 0;
    const taxPercent = parseFloat(String(product.tax_percent)) || 0;
    const piecesPerPkg = Number(product.pieces_per_package) || 1;
    // Price per piece × pieces_per_package × quantity
    const subtotal = unitPrice * piecesPerPkg * 1; // qty=1 initially
    const taxAmount = (subtotal * taxPercent) / 100;
    const totalWithTax = product.tax_type === 'exclusive' ? subtotal + taxAmount : subtotal;

    setOrderItems([...orderItems, {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: unitPrice,
      pieces_per_package: piecesPerPkg,
      discount: 0,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      subtotal: subtotal,
      total_with_tax: totalWithTax,
      available_stock: availableStock,
      min_price: Number(product.min_selling_price) || 0,
    }]);

    setProductSearch('');
    setShowProductDropdown(false);
  };

  const updateOrderItem = (index: number, field: string, value: number) => {
    const newItems = [...orderItems];
    const currentItem = newItems[index];

    // Check stock availability when updating quantity
    if (field === 'quantity') {
      const newQty = Number(value) || 0;
      if (newQty > currentItem.available_stock) {
        toast.error(`الكمية المتوفرة: ${Math.round(currentItem.available_stock)} فقط`);
        return;
      }
    }

    const item = { ...currentItem, [field]: parseFloat(String(value)) || 0 };

    // Recalculate: price per piece × pieces_per_package × quantity - discount
    const qty = parseFloat(String(item.quantity)) || 0;
    const price = parseFloat(String(item.unit_price)) || 0;
    const piecesPerPkg = Number(item.pieces_per_package) || 1;
    const disc = parseFloat(String(item.discount)) || 0;
    const taxPct = parseFloat(String(item.tax_percent)) || 0;

    const subtotal = (price * piecesPerPkg * qty) - disc;
    const taxAmount = (subtotal * taxPct) / 100;
    item.subtotal = subtotal;
    item.tax_amount = taxAmount;
    item.total_with_tax = subtotal + taxAmount;

    newItems[index] = item;
    setOrderItems(newItems);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const selectClient = (client: Client) => {
    setSelectedClient(client.id);
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  // Calculations - subtotal already includes quantity from updateOrderItem
  const subtotal = orderItems.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const totalTax = orderItems.reduce((sum, item) => sum + (Number(item.tax_amount) || 0), 0);
  const grandTotal = subtotal + totalTax - (Number(orderDiscount) || 0);

  const handleSubmit = async () => {
    if (!selectedClient) {
      toast.error('يرجى اختيار العميل');
      return;
    }
    if (!selectedWarehouse) {
      toast.error('يرجى اختيار المستودع');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    // Validate prices and stock
    for (const item of orderItems) {
      if (item.unit_price < item.min_price) {
        toast.error(`سعر "${item.product_name}" أقل من الحد الأدنى (${item.min_price})`);
        return;
      }
      if (item.quantity > item.available_stock) {
        toast.error(`الكمية المطلوبة لـ "${item.product_name}" (${item.quantity}) أكبر من المتوفر (${Math.round(item.available_stock)})`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await ordersApi.create({
        client_id: selectedClient,
        warehouse_id: selectedWarehouse,
        date: new Date().toISOString().split('T')[0],
        discount: orderDiscount,
        tax: totalTax,
        notes: orderNotes,
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          tax_percent: item.tax_percent,
        })),
      });
      toast.success('تم إنشاء الطلب بنجاح');
      router.push('/dashboard/orders');
    } catch (error) {
      toast.error('خطأ في إنشاء الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.barcode?.includes(productSearch)
  ).slice(0, 10);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone?.includes(clientSearch)
  ).slice(0, 10);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/orders" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">إنشاء طلب جديد</h1>
            <p className="text-gray-500">إضافة طلب جديد للعميل</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client & Warehouse Selection */}
          <div className="card">
            <h3 className="font-bold mb-4">معلومات الطلب</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  العميل <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                      if (!e.target.value) setSelectedClient(0);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="ابحث عن عميل..."
                    className="input pr-10"
                  />
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                {showClientDropdown && clientSearch && filteredClients.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredClients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => selectClient(client)}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-gray-500">
                          {client.phone || '-'} | {client.address || 'بدون عنوان'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warehouse Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المستودع <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(Number(e.target.value))}
                  className="select"
                >
                  <option value={0}>اختر المستودع</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} {warehouse.is_main && '(الرئيسي)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Product Search */}
          <div className="card">
            <h3 className="font-bold mb-4">المنتجات</h3>

            {/* Product Search Input */}
            <div className="relative mb-4">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                placeholder="ابحث عن منتج بالاسم أو الباركود..."
                className="input pr-10"
              />
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

              {showProductDropdown && productSearch && filteredProducts.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  {isLoadingStock && (
                    <div className="p-3 text-center text-gray-500">جاري تحميل المخزون...</div>
                  )}
                  {filteredProducts.map((product) => {
                    // Use available stock from map (considers reserved quantities)
                    const availableStock = availableStockMap[product.id] ?? 0;
                    const rawStock = product.stock?.find(s => s.warehouse_id === selectedWarehouse)?.quantity || 0;
                    const reserved = Number(rawStock) - availableStock;
                    return (
                      <div
                        key={product.id}
                        onClick={() => addProductToOrder(product)}
                        className={`p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 ${availableStock < 1 ? 'opacity-50' : ''}`}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-green-600 font-bold">
                            {formatCurrency(product.wholesale_price || product.retail_price)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 mt-1">
                          <span>باركود: {product.barcode || '-'}</span>
                          <span className={availableStock > 0 ? 'text-green-600' : 'text-red-600'}>
                            متاح: {availableStock}
                            {reserved > 0 && <span className="text-orange-500 mr-1">(محجوز: {reserved})</span>}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          TVA: {product.tax_percent || globalTaxRate}% | الحد الأدنى: {formatCurrency(product.min_selling_price || 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Order Items Table */}
            {orderItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">المنتج</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">الكمية</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">السعر/قطعة</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">قطع/وحدة</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">الخصم</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">TVA</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">المجموع</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orderItems.map((item, index) => (
                      <tr key={item.product_id}>
                        <td className="px-2 py-2">
                          <div className="font-medium text-sm">{item.product_name}</div>
                          <div className="text-xs text-gray-500">
                            متاح: {item.available_stock}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateOrderItem(index, 'quantity', Math.max(1, Number(e.target.value)))}
                            min={1}
                            className="input w-full text-center text-sm py-1.5"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateOrderItem(index, 'unit_price', Number(e.target.value))}
                            min={0}
                            className={`input w-full text-sm py-1.5 ${item.unit_price < item.min_price ? 'border-red-500 bg-red-50' : ''}`}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="text-sm font-medium">{item.pieces_per_package}</span>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={item.discount}
                            onChange={(e) => updateOrderItem(index, 'discount', Number(e.target.value))}
                            min={0}
                            className="input w-full text-sm py-1.5"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="text-sm font-medium text-blue-600">{item.tax_percent}%</div>
                          <div className="text-xs text-gray-500">{formatCurrency(item.tax_amount)}</div>
                        </td>
                        <td className="px-2 py-2 text-sm">
                          <div className="font-medium">{formatCurrency(item.total_with_tax)}</div>
                          <div className="text-xs text-gray-400">
                            {formatCurrency(item.subtotal)} + TVA
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeOrderItem(index)}
                            className="p-1.5 hover:bg-red-50 text-red-600 rounded"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-lg">
                <PlusIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>ابحث عن منتج لإضافته إلى الطلب</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="card">
            <h3 className="font-bold mb-4">ملاحظات</h3>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="input"
              rows={3}
              placeholder="ملاحظات إضافية على الطلب..."
            />
          </div>
        </div>

        {/* Sidebar - Order Summary */}
        <div className="lg:col-span-1">
          <div className="card sticky top-4">
            <h3 className="font-bold mb-4">ملخص الطلب</h3>

            {selectedClient > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600">العميل المحدد</div>
                <div className="font-bold">{clients.find(c => c.id === selectedClient)?.name}</div>
              </div>
            )}

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">عدد المنتجات</span>
                <span className="font-medium">{orderItems.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">إجمالي الكميات</span>
                <span className="font-medium">{orderItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">المجموع الفرعي</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">TVA</span>
                <span className="font-medium text-blue-600">{formatCurrency(totalTax)}</span>
              </div>

              {/* Order Discount */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">خصم إضافي</span>
                <input
                  type="number"
                  value={orderDiscount}
                  onChange={(e) => setOrderDiscount(Number(e.target.value))}
                  min={0}
                  className="input w-24 text-left"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between text-lg font-bold">
                <span>المجموع الكلي</span>
                <span className="text-green-600">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="text-xs text-gray-500 text-left mt-1">
                شامل TVA
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || orderItems.length === 0 || !selectedClient || !selectedWarehouse}
                className="btn btn-primary w-full py-3"
              >
                {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الطلب'}
              </button>
              <Link href="/dashboard/orders" className="btn btn-secondary w-full py-3 text-center block">
                إلغاء
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
