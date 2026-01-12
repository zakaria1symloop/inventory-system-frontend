'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { purchaseOrdersApi, productsApi, suppliersApi, warehousesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  barcode: string;
  cost_price: number;
  pieces_per_package: number;
  unit_buy?: { id: number; name: string; short_name: string };
}

interface Supplier {
  id: number;
  name: string;
  phone?: string;
}

interface Warehouse {
  id: number;
  name: string;
}

interface OrderItem {
  product_id: number;
  product_name: string;
  barcode: string;
  quantity: number; // Number of packages
  pieces_per_package: number; // Pieces per package
  total_pieces: number; // Total pieces = quantity * pieces_per_package
  unit_price: number; // Price per 1 PIECE (not per package)
  original_price: number; // Original price per piece
  unit_name: string;
  discount: number;
  tax: number;
  subtotal: number; // = unit_price × pieces_per_package × quantity - discount + tax
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const supplierSearchRef = useRef<HTMLInputElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(0);
  const [note, setNote] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);

  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [supplierHighlightIndex, setSupplierHighlightIndex] = useState(-1);
  const supplierListRef = useRef<HTMLDivElement>(null);

  // Product search
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productHighlightIndex, setProductHighlightIndex] = useState(-1);
  const productListRef = useRef<HTMLDivElement>(null);

  // Quick product entry modal
  const [quickEntryModal, setQuickEntryModal] = useState<{
    show: boolean;
    product: Product | null;
    quantity: number;
    unitPrice: number;
  }>({ show: false, product: null, quantity: 1, unitPrice: 0 });
  const quickQtyRef = useRef<HTMLInputElement>(null);
  const quickPriceRef = useRef<HTMLInputElement>(null);

  // Refs for keyboard navigation
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchData();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (quickEntryModal.show) return;

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          supplierSearchRef.current?.focus();
          break;
        case 'F2':
          e.preventDefault();
          productSearchRef.current?.focus();
          break;
        case 'F4':
          e.preventDefault();
          submitBtnRef.current?.click();
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [quickEntryModal.show]);

  const fetchData = async () => {
    try {
      const [suppliersRes, warehousesRes, productsRes] = await Promise.all([
        suppliersApi.getAll({ per_page: 1000 }),
        warehousesApi.getAll(),
        productsApi.getAll({ per_page: 1000 }),
      ]);
      setSuppliers(suppliersRes.data.data || suppliersRes.data);
      setWarehouses(warehousesRes.data.data || warehousesRes.data);
      setProducts(productsRes.data.data || productsRes.data);

      // Set default warehouse if only one
      const whs = warehousesRes.data.data || warehousesRes.data;
      if (whs.length === 1) {
        setWarehouseId(whs[0].id.toString());
      }
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      const fieldOrder = ['quantity', 'unit_price', 'discount'];
      const currentFieldIndex = fieldOrder.indexOf(field);

      if (currentFieldIndex < fieldOrder.length - 1) {
        const nextField = fieldOrder[currentFieldIndex + 1];
        const nextRef = inputRefs.current[`${rowIndex}-${nextField}`];
        nextRef?.focus();
        nextRef?.select();
      } else if (rowIndex < items.length - 1) {
        const nextRef = inputRefs.current[`${rowIndex + 1}-quantity`];
        nextRef?.focus();
        nextRef?.select();
      } else {
        barcodeInputRef.current?.focus();
      }
    }
  }, [items.length]);

  // Open quick entry modal for product
  const openQuickEntryModal = (product: Product) => {
    if (!warehouseId) {
      toast.error('الرجاء اختيار المستودع أولاً');
      return;
    }
    setQuickEntryModal({
      show: true,
      product,
      quantity: 1,
      unitPrice: Number(product.cost_price) || 0,
    });
    setShowProductSearch(false);
    setBarcodeInput('');
    setTimeout(() => quickQtyRef.current?.select(), 50);
  };

  // Confirm quick entry and add product
  const confirmQuickEntry = () => {
    if (!quickEntryModal.product) return;
    const { product, quantity, unitPrice } = quickEntryModal;

    if (quantity <= 0) {
      toast.error('الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    const existingIndex = items.findIndex((item) => item.product_id === product.id);

    if (existingIndex >= 0) {
      const existingItem = items[existingIndex];
      const newQty = existingItem.quantity + quantity;
      const piecesPerPkg = existingItem.pieces_per_package;
      // baseAmount = price × pieces × qty - discount
      const baseAmount = (unitPrice * piecesPerPkg * newQty) - existingItem.discount;
      const updatedItem = {
        ...existingItem,
        quantity: newQty,
        total_pieces: newQty * piecesPerPkg,
        unit_price: unitPrice, // Price per 1 piece
        subtotal: baseAmount,
      };
      const otherItems = items.filter((_, i) => i !== existingIndex);
      setItems([updatedItem, ...otherItems]);
    } else {
      const piecesPerPkg = product.pieces_per_package || 1;
      // baseAmount = price × pieces × qty
      const baseAmount = unitPrice * piecesPerPkg * quantity;
      const unitName = product.unit_buy?.name || 'وحدة';

      const newItem: OrderItem = {
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode || '',
        quantity: quantity,
        pieces_per_package: piecesPerPkg,
        total_pieces: quantity * piecesPerPkg,
        unit_price: unitPrice, // Price per 1 piece
        original_price: Number(product.cost_price) || 0,
        unit_name: unitName,
        discount: 0,
        tax: 0,
        subtotal: baseAmount,
      };
      setItems([newItem, ...items]);
    }

    setQuickEntryModal({ show: false, product: null, quantity: 1, unitPrice: 0 });
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const product = products.find((p) => p.barcode === barcodeInput.trim());
      if (product) {
        openQuickEntryModal(product);
      } else {
        toast.error('المنتج غير موجود');
      }
    }
  };

  const updateItem = (index: number, field: 'quantity' | 'unit_price' | 'discount', value: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    const quantity = updated[index].quantity || 0;
    const unitPrice = updated[index].unit_price || 0; // Price per 1 piece
    const itemDiscount = updated[index].discount || 0;
    const piecesPerPkg = updated[index].pieces_per_package || 1;

    updated[index].total_pieces = quantity * piecesPerPkg;
    // subtotal = price × pieces × qty - discount
    updated[index].subtotal = (unitPrice * piecesPerPkg * quantity) - itemDiscount;

    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const grandTotal = Math.max(0, totalAmount - (Number(discount) || 0) + (Number(tax) || 0) + (Number(shipping) || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!warehouseId) {
      toast.error('الرجاء اختيار المستودع');
      return;
    }

    if (items.length === 0) {
      toast.error('الرجاء إضافة منتج واحد على الأقل');
      return;
    }

    setIsSaving(true);

    try {
      await purchaseOrdersApi.create({
        supplier_id: supplierId ? parseInt(supplierId) : null,
        warehouse_id: parseInt(warehouseId),
        date,
        expected_delivery_date: expectedDeliveryDate || null,
        discount,
        tax,
        shipping,
        note,
        terms,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          tax: item.tax,
        })),
      });

      toast.success('تم إنشاء بون الطلب بنجاح');
      router.push('/dashboard/purchase-orders');
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في إنشاء بون الطلب';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    const safeValue = isNaN(value) ? 0 : value;
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(safeValue);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div>
      {/* Keyboard Shortcuts Bar */}
      <div className="bg-green-800 text-white px-4 py-2 rounded-lg mb-4 flex items-center gap-6 text-sm">
        <span className="font-bold">اختصارات:</span>
        <span><kbd className="bg-green-600 px-2 py-0.5 rounded">F1</kbd> المورد</span>
        <span><kbd className="bg-green-600 px-2 py-0.5 rounded">F2</kbd> المنتج</span>
        <span><kbd className="bg-green-600 px-2 py-0.5 rounded">F4</kbd> حفظ</span>
        <span><kbd className="bg-green-600 px-2 py-0.5 rounded">↑↓</kbd> تنقل</span>
        <span><kbd className="bg-green-600 px-2 py-0.5 rounded">Enter</kbd> تأكيد</span>
        <span><kbd className="bg-green-600 px-2 py-0.5 rounded">Esc</kbd> إغلاق</span>
      </div>

      {/* Quick Entry Modal */}
      {quickEntryModal.show && quickEntryModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-center">{quickEntryModal.product.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">الكمية</label>
                <input
                  ref={quickQtyRef}
                  type="number"
                  value={quickEntryModal.quantity}
                  onChange={(e) => setQuickEntryModal(prev => ({ ...prev, quantity: Number(e.target.value) || 0 }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      quickPriceRef.current?.focus();
                      quickPriceRef.current?.select();
                    } else if (e.key === 'Escape') {
                      setQuickEntryModal({ show: false, product: null, quantity: 1, unitPrice: 0 });
                      barcodeInputRef.current?.focus();
                    }
                  }}
                  className="input w-full text-center text-xl"
                  min="1"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">سعر الوحدة</label>
                <input
                  ref={quickPriceRef}
                  type="number"
                  value={quickEntryModal.unitPrice}
                  onChange={(e) => setQuickEntryModal(prev => ({ ...prev, unitPrice: Number(e.target.value) || 0 }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmQuickEntry();
                    } else if (e.key === 'Escape') {
                      setQuickEntryModal({ show: false, product: null, quantity: 1, unitPrice: 0 });
                      barcodeInputRef.current?.focus();
                    }
                  }}
                  className="input w-full text-center text-xl"
                  min="0"
                />
              </div>
              <div className="text-center text-lg font-bold text-green-600">
                المجموع: {formatCurrency(quickEntryModal.unitPrice * (quickEntryModal.product?.pieces_per_package || 1) * quickEntryModal.quantity)}
                <div className="text-xs text-gray-500 font-normal">
                  ({quickEntryModal.unitPrice} × {quickEntryModal.product?.pieces_per_package || 1} قطعة × {quickEntryModal.quantity})
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmQuickEntry}
                  className="btn btn-primary flex-1"
                >
                  إضافة (Enter)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickEntryModal({ show: false, product: null, quantity: 1, unitPrice: 0 });
                    barcodeInputRef.current?.focus();
                  }}
                  className="btn btn-secondary flex-1"
                >
                  إلغاء (Esc)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/purchase-orders" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">بون طلب جديد</h1>
            <p className="text-sm text-gray-500">Nouveau Bon de Commande</p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
        <p className="text-sm text-green-700 dark:text-green-300">
          بون الطلب لا يؤثر على المخزون. عند استلام البضاعة، قم بتحويله إلى فاتورة شراء من صفحة بونات الطلب.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">معلومات الطلب</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">المورد</label>
                  <input
                    ref={supplierSearchRef}
                    type="text"
                    value={supplierSearch}
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      setShowSupplierDropdown(true);
                      if (!e.target.value) {
                        setSupplierId('');
                      }
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    onKeyDown={(e) => {
                      const filtered = suppliers.filter(s =>
                        s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                        (s.phone && s.phone.includes(supplierSearch))
                      ).slice(0, 10);
                      const maxIndex = filtered.length;

                      if (e.key === 'Escape') {
                        setShowSupplierDropdown(false);
                        setSupplierHighlightIndex(-1);
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setShowSupplierDropdown(true);
                        setSupplierHighlightIndex(prev => Math.min(prev + 1, maxIndex));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSupplierHighlightIndex(prev => Math.max(prev - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (supplierHighlightIndex === 0) {
                          setSupplierId('');
                          setSupplierSearch('');
                          setShowSupplierDropdown(false);
                          setSupplierHighlightIndex(-1);
                        } else if (supplierHighlightIndex > 0 && filtered[supplierHighlightIndex - 1]) {
                          const selected = filtered[supplierHighlightIndex - 1];
                          setSupplierId(selected.id.toString());
                          setSupplierSearch(selected.name);
                          setShowSupplierDropdown(false);
                          setSupplierHighlightIndex(-1);
                        } else if (filtered.length === 1) {
                          setSupplierId(filtered[0].id.toString());
                          setSupplierSearch(filtered[0].name);
                          setShowSupplierDropdown(false);
                          setSupplierHighlightIndex(-1);
                        }
                      }
                    }}
                    placeholder="ابحث عن مورد أو اتركه فارغاً"
                    className="input w-full"
                    autoComplete="off"
                  />
                  {showSupplierDropdown && (
                    <div ref={supplierListRef} className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div
                        className={`px-3 py-2 cursor-pointer border-b ${supplierHighlightIndex === 0 ? 'bg-green-100 dark:bg-green-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        onClick={() => {
                          setSupplierId('');
                          setSupplierSearch('');
                          setShowSupplierDropdown(false);
                          setSupplierHighlightIndex(-1);
                        }}
                      >
                        <span className="text-gray-500">بدون مورد</span>
                      </div>
                      {suppliers
                        .filter(s =>
                          s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                          (s.phone && s.phone.includes(supplierSearch))
                        )
                        .slice(0, 10)
                        .map((supplier, index) => (
                          <div
                            key={supplier.id}
                            className={`px-3 py-2 cursor-pointer ${supplierHighlightIndex === index + 1 ? 'bg-green-100 dark:bg-green-900' : 'hover:bg-green-50 dark:hover:bg-gray-700'}`}
                            onClick={() => {
                              setSupplierId(supplier.id.toString());
                              setSupplierSearch(supplier.name);
                              setShowSupplierDropdown(false);
                              setSupplierHighlightIndex(-1);
                            }}
                          >
                            <div className="font-medium">{supplier.name}</div>
                            {supplier.phone && <div className="text-sm text-gray-500">{supplier.phone}</div>}
                          </div>
                        ))}
                    </div>
                  )}
                  {showSupplierDropdown && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowSupplierDropdown(false)}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">المستودع *</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="select w-full"
                    required
                  >
                    <option value="">اختر المستودع</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">تاريخ الطلب *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">تاريخ التسليم المتوقع</label>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="input w-full"
                  />
                </div>
              </div>
            </div>

            {/* Product Search */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">إضافة المنتجات</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">البحث بالباركود</label>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeSearch}
                    className="input w-full"
                    placeholder="امسح الباركود واضغط Enter..."
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">البحث بالاسم</label>
                  <input
                    ref={productSearchRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowProductSearch(true);
                      setProductHighlightIndex(-1);
                    }}
                    onFocus={() => {
                      setShowProductSearch(true);
                      setProductHighlightIndex(-1);
                    }}
                    onKeyDown={(e) => {
                      const maxIndex = Math.min(filteredProducts.length, 10) - 1;

                      if (e.key === 'Escape') {
                        setShowProductSearch(false);
                        setProductHighlightIndex(-1);
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setShowProductSearch(true);
                        setProductHighlightIndex(prev => Math.min(prev + 1, maxIndex));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setProductHighlightIndex(prev => Math.max(prev - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const prods = filteredProducts.slice(0, 10);
                        if (productHighlightIndex >= 0 && prods[productHighlightIndex]) {
                          openQuickEntryModal(prods[productHighlightIndex]);
                          setProductHighlightIndex(-1);
                        } else if (prods.length === 1) {
                          openQuickEntryModal(prods[0]);
                          setProductHighlightIndex(-1);
                        }
                      }
                    }}
                    className="input w-full"
                    placeholder="ابحث عن منتج..."
                  />
                  {showProductSearch && searchTerm && (
                    <div ref={productListRef} className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-gray-500 text-center">لا توجد نتائج</div>
                      ) : (
                        filteredProducts.slice(0, 10).map((product, index) => {
                          const piecesPerPkg = product.pieces_per_package || 1;
                          const unitPrice = Number(product.cost_price) || 0;
                          const unitName = product.unit_buy?.short_name || 'وحدة';
                          const isHighlighted = productHighlightIndex === index;
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => openQuickEntryModal(product)}
                              className={`w-full p-3 text-right border-b last:border-b-0 ${isHighlighted ? 'bg-green-100 dark:bg-green-900' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            >
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500 flex justify-between">
                                <span>{product.barcode}</span>
                                <span>
                                  {formatCurrency(unitPrice)} / {unitName}
                                  {piecesPerPkg > 1 && <span className="text-green-500 mr-1">({piecesPerPkg} قطعة)</span>}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-green-100 dark:bg-green-900/30">
                      <th className="px-2 py-2 text-center w-12">الرقم</th>
                      <th className="px-2 py-2 text-right">التعيين</th>
                      <th className="px-2 py-2 text-center w-20">الكمية</th>
                      <th className="px-2 py-2 text-center w-16">الوحدة</th>
                      <th className="px-2 py-2 text-center w-24">س. الوحدة</th>
                      <th className="px-2 py-2 text-center w-20">الخصم</th>
                      <th className="px-2 py-2 text-center w-24">المبلغ</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-gray-500">
                          لم يتم إضافة منتجات بعد
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-2 py-2 text-center font-medium text-gray-500">{index + 1}</td>
                          <td className="px-2 py-2">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.barcode}</div>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              ref={(el) => { inputRefs.current[`${index}-quantity`] = el; }}
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'quantity')}
                              className="input w-full text-center"
                              min="0.01"
                              step="0.01"
                            />
                          </td>
                          <td className="px-2 py-2 text-center text-sm">
                            <div className="text-green-600 font-medium">{item.unit_name}</div>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              ref={(el) => { inputRefs.current[`${index}-unit_price`] = el; }}
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'unit_price')}
                              className="input w-full text-center"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              ref={(el) => { inputRefs.current[`${index}-discount`] = el; }}
                              type="number"
                              value={item.discount}
                              onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                              onKeyDown={(e) => handleKeyDown(e, index, 'discount')}
                              className="input w-full text-center"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-green-600">
                            {formatCurrency(Number(item.subtotal) || 0)}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                نصيحة: اضغط Enter للانتقال للحقل التالي
              </div>
            </div>

            {/* Notes and Terms */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">ملاحظات وشروط</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">ملاحظات</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="input w-full"
                    rows={3}
                    placeholder="ملاحظات إضافية..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">شروط التسليم</label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className="input w-full"
                    rows={3}
                    placeholder="شروط التسليم والدفع..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Summary */}
          <div>
            <div className="card sticky top-24">
              <h2 className="text-lg font-semibold mb-4">ملخص الطلب</h2>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">إجمالي المنتجات ({items.length})</span>
                  <span className="font-medium">{formatCurrency(totalAmount)}</span>
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">الخصم</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="input w-full"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">الضريبة</label>
                  <input
                    type="number"
                    value={tax}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                    className="input w-full"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-500 mb-1">الشحن</label>
                  <input
                    type="number"
                    value={shipping}
                    onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                    className="input w-full"
                    min="0"
                    step="0.01"
                  />
                </div>

                <hr />

                <div className="flex justify-between items-center text-lg font-bold">
                  <span>الإجمالي النهائي</span>
                  <span className="text-green-600">{formatCurrency(grandTotal)}</span>
                </div>

                <button
                  ref={submitBtnRef}
                  type="submit"
                  disabled={isSaving || items.length === 0}
                  className="btn btn-primary w-full bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? 'جاري الحفظ...' : 'إنشاء بون الطلب'}
                </button>

                <Link href="/dashboard/purchase-orders" className="btn btn-secondary w-full text-center block">
                  إلغاء
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Click outside to close product search */}
      {showProductSearch && (
        <div className="fixed inset-0 z-0" onClick={() => setShowProductSearch(false)} />
      )}
    </div>
  );
}
