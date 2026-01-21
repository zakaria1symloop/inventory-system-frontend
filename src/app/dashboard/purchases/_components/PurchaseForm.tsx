'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { purchasesApi, productsApi, suppliersApi, warehousesApi, creditorsApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  barcode: string;
  cost_price: number;
  retail_price: number;
  tax_percent: number;
  pieces_per_package: number;
  unit_buy?: { id: number; name: string; short_name: string };
}

interface Supplier {
  id: number;
  name: string;
  phone?: string;
  balance?: number;
}

interface SupplierDebtInfo {
  balance: number;
  unpaid_purchases?: Array<{
    id: number;
    reference: string;
    due_amount: number;
    date: string;
  }>;
}

interface Warehouse {
  id: number;
  name: string;
}

interface PurchaseItem {
  product_id: number;
  product_name: string;
  barcode: string;
  quantity: number; // Number of packages
  pieces_per_package: number; // Pieces per package
  total_pieces: number; // Total pieces = quantity * pieces_per_package
  unit_price: number; // Price per 1 PIECE (not per package)
  original_price: number; // Original price per piece
  selling_price?: number; // Selling price per piece - updates product price
  unit_name: string; // Unit name
  discount: number;
  tax_percent: number;
  tax: number;
  subtotal: number; // = unit_price × pieces_per_package × quantity - discount + tax
}

interface PurchaseFormProps {
  purchaseId?: number | null;
}

export default function PurchaseForm({ purchaseId = null }: PurchaseFormProps) {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  const isEditMode = purchaseId !== null;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [purchaseDataLoaded, setPurchaseDataLoaded] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(0);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);

  // Supplier debt info
  const [supplierDebt, setSupplierDebt] = useState<SupplierDebtInfo | null>(null);
  const [loadingDebt, setLoadingDebt] = useState(false);

  // Supplier search
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [supplierHighlightIndex, setSupplierHighlightIndex] = useState(-1);
  const supplierSearchRef = useRef<HTMLInputElement>(null);
  const supplierListRef = useRef<HTMLDivElement>(null);

  // Product search
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productHighlightIndex, setProductHighlightIndex] = useState(-1);
  const productListRef = useRef<HTMLDivElement>(null);

  // Search mode toggle (barcode or name) - saved to localStorage
  const [searchMode, setSearchMode] = useState<'barcode' | 'name'>('barcode');

  // Quick product entry modal
  const [quickEntryModal, setQuickEntryModal] = useState<{
    show: boolean;
    product: Product | null;
    quantity: number;
    unitPrice: number;
    sellingPrice: number;
  }>({ show: false, product: null, quantity: 1, unitPrice: 0, sellingPrice: 0 });
  const quickQtyRef = useRef<HTMLInputElement>(null);
  const quickPriceRef = useRef<HTMLInputElement>(null);
  const paidAmountRef = useRef<HTMLInputElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Refs for keyboard navigation
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchData();
    // Load search mode from localStorage
    const savedSearchMode = localStorage.getItem('productSearchMode');
    if (savedSearchMode === 'barcode' || savedSearchMode === 'name') {
      setSearchMode(savedSearchMode);
    }
  }, []);

  // Load purchase data in edit mode - wait for suppliers to be loaded first
  useEffect(() => {
    if (isEditMode && purchaseId && suppliers.length > 0 && !purchaseDataLoaded) {
      loadPurchaseData(purchaseId);
    }
  }, [isEditMode, purchaseId, suppliers.length, purchaseDataLoaded]);

  // Save search mode to localStorage when changed
  const toggleSearchMode = () => {
    const newMode = searchMode === 'barcode' ? 'name' : 'barcode';
    setSearchMode(newMode);
    localStorage.setItem('productSearchMode', newMode);
    // Clear search inputs when switching
    setBarcodeInput('');
    setSearchTerm('');
    setShowProductSearch(false);
    // Focus the search input
    setTimeout(() => {
      if (newMode === 'barcode') {
        barcodeInputRef.current?.focus();
      } else {
        productSearchRef.current?.focus();
      }
    }, 50);
  };

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
        case 'F3':
          e.preventDefault();
          paidAmountRef.current?.focus();
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

  // Fetch supplier debt when supplier changes
  useEffect(() => {
    if (supplierId) {
      fetchSupplierDebt(parseInt(supplierId));
    } else {
      setSupplierDebt(null);
    }
  }, [supplierId]);

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

  const fetchSupplierDebt = async (id: number) => {
    setLoadingDebt(true);
    try {
      const debtRes = await creditorsApi.getSupplierDebt(id).catch(() => ({ data: { purchases: [], totals: { total_remaining: 0 } } }));
      // Use the actual sum of unpaid purchases, not the supplier balance
      // This is more accurate because supplier.balance might be out of sync
      const actualDebt = debtRes.data.totals?.total_remaining || 0;
      setSupplierDebt({
        balance: actualDebt,
        unpaid_purchases: debtRes.data.purchases || []
      });
    } catch (error) {
      console.error('Error fetching supplier debt:', error);
      setSupplierDebt(null);
    } finally {
      setLoadingDebt(false);
    }
  };

  const loadPurchaseData = async (id: number) => {
    try {
      setIsLoading(true);
      const response = await purchasesApi.getOne(id);
      const purchase = response.data;

      // Set form fields (only editable fields)
      setDiscount(purchase.discount || 0);
      setTax(purchase.tax || 0);
      setShipping(purchase.shipping || 0);
      setNote(purchase.note || '');
      setPaidAmount(purchase.paid_amount || 0);

      // Set read-only fields
      if (purchase.supplier_id) {
        setSupplierId(purchase.supplier_id.toString());
        // Use supplier data from purchase response or find in suppliers list
        const supplierName = purchase.supplier?.name || suppliers.find(s => s.id === purchase.supplier_id)?.name || '';
        setSupplierSearch(supplierName);
      }
      setWarehouseId(purchase.warehouse_id?.toString() || '');
      setDate(purchase.date?.split(' ')[0] || new Date().toISOString().split('T')[0]);

      // Load items (read-only in edit mode)
      if (purchase.items && Array.isArray(purchase.items)) {
        const loadedItems: PurchaseItem[] = purchase.items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product?.name || '',
          barcode: item.product?.barcode || '',
          quantity: item.quantity,
          pieces_per_package: item.product?.pieces_per_package || 1,
          total_pieces: item.quantity * (item.product?.pieces_per_package || 1),
          unit_price: item.unit_price,
          original_price: item.unit_price,
          unit_name: item.product?.unit_buy?.short_name || 'وحدة',
          discount: item.discount || 0,
          tax_percent: item.product?.tax_percent || 0,
          tax: item.tax || 0,
          subtotal: item.subtotal || 0,
        }));
        setItems(loadedItems);
      }

      toast.success('تم تحميل بيانات الفاتورة');
      setPurchaseDataLoaded(true);
    } catch (error) {
      toast.error('خطأ في تحميل بيانات الفاتورة');
      console.error('Error loading purchase data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // Define field order for navigation
      const fieldOrder = ['quantity', 'unit_price', 'discount'];
      const currentFieldIndex = fieldOrder.indexOf(field);

      if (currentFieldIndex < fieldOrder.length - 1) {
        // Move to next field in same row
        const nextField = fieldOrder[currentFieldIndex + 1];
        const nextRef = inputRefs.current[`${rowIndex}-${nextField}`];
        nextRef?.focus();
        nextRef?.select();
      } else if (rowIndex < items.length - 1) {
        // Move to first field of next row
        const nextRef = inputRefs.current[`${rowIndex + 1}-quantity`];
        nextRef?.focus();
        nextRef?.select();
      } else {
        // Last field of last row - focus barcode input for next product
        barcodeInputRef.current?.focus();
      }
    }
  }, [items.length]);

  const addProduct = (product: Product, quantity: number = 1) => {
    const existingIndex = items.findIndex((item) => item.product_id === product.id);

    if (existingIndex >= 0) {
      // Update quantity if product already exists - move to top
      const existingItem = items[existingIndex];
      const newQty = existingItem.quantity + quantity;
      const unitPrice = existingItem.unit_price; // Price per 1 piece
      const discount = existingItem.discount;
      const taxPercent = existingItem.tax_percent;
      const piecesPerPkg = existingItem.pieces_per_package;
      // baseAmount = price × pieces × qty - discount
      const baseAmount = (unitPrice * piecesPerPkg * newQty) - discount;
      const updatedItem = {
        ...existingItem,
        quantity: newQty,
        total_pieces: newQty * piecesPerPkg,
        tax: (baseAmount * taxPercent) / 100,
        subtotal: baseAmount + (baseAmount * taxPercent) / 100,
      };
      const otherItems = items.filter((_, i) => i !== existingIndex);
      setItems([updatedItem, ...otherItems]);
    } else {
      // Add new product at the top of the list
      const piecesPerPkg = product.pieces_per_package || 1;
      const unitPrice = parseFloat(String(product.cost_price)) || 0; // Price per 1 piece
      const taxPercent = parseFloat(String(product.tax_percent)) || 0;
      // baseAmount = price × pieces × qty
      const baseAmount = unitPrice * piecesPerPkg * quantity;
      const taxAmount = (baseAmount * taxPercent) / 100;
      const unitName = product.unit_buy?.name || 'وحدة';

      const newItem: PurchaseItem = {
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode || '',
        quantity: quantity,
        pieces_per_package: piecesPerPkg,
        total_pieces: quantity * piecesPerPkg,
        unit_price: unitPrice, // Price per 1 piece
        original_price: unitPrice,
        unit_name: unitName,
        discount: 0,
        tax_percent: taxPercent,
        tax: taxAmount,
        subtotal: baseAmount + taxAmount,
      };
      setItems([newItem, ...items]);
    }

    setSearchTerm('');
    setShowProductSearch(false);
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

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
      sellingPrice: Number(product.cost_price) || 0,
    });
    setShowProductSearch(false);
    setBarcodeInput('');
    setTimeout(() => quickQtyRef.current?.select(), 50);
  };

  // Confirm quick entry and add product
  const confirmQuickEntry = () => {
    if (!quickEntryModal.product) return;
    const { product, quantity, unitPrice, sellingPrice } = quickEntryModal;

    if (quantity <= 0) {
      toast.error('الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    const existingIndex = items.findIndex((item) => item.product_id === product.id);

    if (existingIndex >= 0) {
      const existingItem = items[existingIndex];
      const newQty = existingItem.quantity + quantity;
      const taxPercent = existingItem.tax_percent;
      const piecesPerPkg = existingItem.pieces_per_package;
      // baseAmount = price × pieces × qty - discount
      const baseAmount = (unitPrice * piecesPerPkg * newQty) - existingItem.discount;
      const updatedItem = {
        ...existingItem,
        quantity: newQty,
        total_pieces: newQty * piecesPerPkg,
        unit_price: unitPrice, // Price per 1 piece
        tax: (baseAmount * taxPercent) / 100,
        subtotal: baseAmount + (baseAmount * taxPercent) / 100,
      };
      const otherItems = items.filter((_, i) => i !== existingIndex);
      setItems([updatedItem, ...otherItems]);
    } else {
      const piecesPerPkg = product.pieces_per_package || 1;
      const taxPercent = parseFloat(String(product.tax_percent)) || 0;
      // baseAmount = price × pieces × qty
      const baseAmount = unitPrice * piecesPerPkg * quantity;
      const taxAmount = (baseAmount * taxPercent) / 100;
      const unitName = product.unit_buy?.name || 'وحدة';

      const newItem: PurchaseItem = {
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode || '',
        quantity: quantity,
        pieces_per_package: piecesPerPkg,
        total_pieces: quantity * piecesPerPkg,
        unit_price: unitPrice, // Price per 1 piece
        original_price: Number(product.cost_price) || 0,
        selling_price: sellingPrice > 0 ? sellingPrice : undefined,
        unit_name: unitName,
        discount: 0,
        tax_percent: taxPercent,
        tax: taxAmount,
        subtotal: baseAmount + taxAmount,
      };
      setItems([newItem, ...items]);
    }

    setQuickEntryModal({ show: false, product: null, quantity: 1, unitPrice: 0, sellingPrice: 0 });
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

    // Recalculate: price × pieces_per_package × quantity
    const quantity = updated[index].quantity || 0;
    const unitPrice = updated[index].unit_price || 0; // Price per 1 piece
    const discount = updated[index].discount || 0;
    const taxPercent = updated[index].tax_percent || 0;
    const piecesPerPkg = updated[index].pieces_per_package || 1;

    updated[index].total_pieces = quantity * piecesPerPkg;
    // baseAmount = price × pieces × qty - discount
    const baseAmount = (unitPrice * piecesPerPkg * quantity) - discount;
    updated[index].tax = (baseAmount * taxPercent) / 100;
    updated[index].subtotal = baseAmount + updated[index].tax;

    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const grandTotal = Math.max(0, totalAmount - (Number(discount) || 0) + (Number(tax) || 0) + (Number(shipping) || 0));

  // Calculate how payment is applied
  // previousDebt = what we already owe the supplier BEFORE this purchase
  const previousDebt = Number(supplierDebt?.balance) || 0;
  const currentPaidAmount = Number(paidAmount) || 0;

  // If paid more than current purchase, extra goes to previous debt
  const appliedToCurrentPurchase = Math.min(currentPaidAmount, grandTotal);
  const appliedToPreviousDebt = Math.max(0, currentPaidAmount - grandTotal);
  const remainingFromPurchase = grandTotal - appliedToCurrentPurchase;
  const remainingPreviousDebt = Math.max(0, previousDebt - appliedToPreviousDebt);
  const totalRemainingDebt = remainingFromPurchase + remainingPreviousDebt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode && purchaseId) {
      // Edit mode - only update allowed fields
      setIsSaving(true);
      try {
        await purchasesApi.update(purchaseId, {
          discount,
          tax,
          shipping,
          note,
        });

        toast.success('تم تحديث الفاتورة بنجاح');
        router.push('/dashboard/purchases');
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'خطأ في تحديث الفاتورة');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Create mode validation
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
      // Update product prices if changed
      for (const item of items) {
        if (item.unit_price !== item.original_price) {
          try {
            await productsApi.update(item.product_id, { cost_price: item.unit_price });
          } catch (error) {
            console.error(`Failed to update price for product ${item.product_id}:`, error);
          }
        }
      }

      await purchasesApi.create({
        supplier_id: supplierId ? parseInt(supplierId) : null,
        warehouse_id: parseInt(warehouseId),
        date,
        discount,
        tax,
        shipping,
        note,
        paid_amount: paidAmount,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          tax: item.tax,
        })),
      });

      toast.success('تم إنشاء فاتورة الشراء بنجاح');
      router.push('/dashboard/purchases');
    } catch (error) {
      toast.error('خطأ في إنشاء فاتورة الشراء');
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
      <div className="bg-gray-800 text-white px-4 py-2 rounded-lg mb-4 flex items-center gap-6 text-sm">
        <span className="font-bold">اختصارات:</span>
        <span><kbd className="bg-gray-600 px-2 py-0.5 rounded">F1</kbd> المورد</span>
        <span><kbd className="bg-gray-600 px-2 py-0.5 rounded">F2</kbd> المنتج</span>
        <span><kbd className="bg-gray-600 px-2 py-0.5 rounded">F3</kbd> المبلغ المدفوع</span>
        <span><kbd className="bg-gray-600 px-2 py-0.5 rounded">F4</kbd> حفظ</span>
        <span><kbd className="bg-gray-600 px-2 py-0.5 rounded">↑↓</kbd> تنقل</span>
        <span><kbd className="bg-gray-600 px-2 py-0.5 rounded">Enter</kbd> تأكيد</span>
        <span><kbd className="bg-gray-600 px-2 py-0.5 rounded">Esc</kbd> إغلاق</span>
      </div>

      {/* Quick Entry Modal */}
      {quickEntryModal.show && quickEntryModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full mx-4">
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
                      setQuickEntryModal({ show: false, product: null, quantity: 1, unitPrice: 0, sellingPrice: 0 });
                      barcodeInputRef.current?.focus();
                    }
                  }}
                  className="input w-full text-center text-xl"
                  min="1"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">سعر الشراء</label>
                <input
                  ref={quickPriceRef}
                  type="number"
                  value={quickEntryModal.unitPrice}
                  onChange={(e) => setQuickEntryModal(prev => ({ ...prev, unitPrice: Number(e.target.value) || 0 }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('selling-price-input')?.focus();
                    } else if (e.key === 'Escape') {
                      setQuickEntryModal({ show: false, product: null, quantity: 1, unitPrice: 0, sellingPrice: 0 });
                      barcodeInputRef.current?.focus();
                    }
                  }}
                  className="input w-full text-center text-xl"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">سعر البيع (اختياري)</label>
                <input
                  id="selling-price-input"
                  type="number"
                  value={quickEntryModal.sellingPrice}
                  onChange={(e) => setQuickEntryModal(prev => ({ ...prev, sellingPrice: Number(e.target.value) || 0 }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmQuickEntry();
                    } else if (e.key === 'Escape') {
                      setQuickEntryModal({ show: false, product: null, quantity: 1, unitPrice: 0, sellingPrice: 0 });
                      barcodeInputRef.current?.focus();
                    }
                  }}
                  className="input w-full text-center text-xl"
                  min="0"
                  placeholder="سعر البيع للقطعة"
                />
                <p className="text-xs text-gray-500 mt-1">سيتم تحديث سعر بيع المنتج</p>
              </div>
              <div className="text-center text-lg font-bold text-blue-600">
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
                    setQuickEntryModal({ show: false, product: null, quantity: 1, unitPrice: 0, sellingPrice: 0 });
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
          <Link href="/dashboard/purchases" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">{isEditMode ? 'تعديل فاتورة الشراء' : 'فاتورة شراء جديدة'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">معلومات الفاتورة</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        setSupplierDebt(null);
                      }
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    onKeyDown={(e) => {
                      const filtered = suppliers.filter(s =>
                        s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                        (s.phone && s.phone.includes(supplierSearch))
                      ).slice(0, 10);
                      const maxIndex = filtered.length; // 0 = no supplier, 1+ = filtered suppliers

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
                          setSupplierDebt(null);
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
                    <div ref={supplierListRef} className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div
                        className={`px-3 py-2 cursor-pointer border-b ${supplierHighlightIndex === 0 ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        onClick={() => {
                          setSupplierId('');
                          setSupplierSearch('');
                          setSupplierDebt(null);
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
                            className={`px-3 py-2 cursor-pointer ${supplierHighlightIndex === index + 1 ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
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
                      {suppliers.filter(s =>
                        s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
                        (s.phone && s.phone.includes(supplierSearch))
                      ).length === 0 && (
                        <div className="px-3 py-2 text-gray-500">لا يوجد نتائج</div>
                      )}
                    </div>
                  )}
                  {/* Click outside to close */}
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
                  <label className="block text-sm font-medium mb-1">التاريخ *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input w-full"
                    required
                  />
                </div>
              </div>

              {/* Supplier Debt Info */}
              {supplierId && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  {loadingDebt ? (
                    <div className="text-center text-gray-500">جاري تحميل بيانات الدين...</div>
                  ) : supplierDebt ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-blue-800">دينك للمورد:</span>
                        <span className={`font-bold text-lg ${supplierDebt.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(supplierDebt.balance)}
                        </span>
                      </div>
                      {supplierDebt.unpaid_purchases && supplierDebt.unpaid_purchases.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <div className="text-sm font-medium text-blue-800 mb-2">الفواتير غير المسددة:</div>
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {supplierDebt.unpaid_purchases.slice(0, 5).map((purchase) => (
                              <div key={purchase.id} className="flex justify-between text-sm">
                                <span className="text-gray-600">{purchase.reference}</span>
                                <span className="text-red-600">{formatCurrency(purchase.due_amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-green-600">لا يوجد دين سابق</div>
                  )}
                </div>
              )}
            </div>

            {/* Product Search */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">إضافة المنتجات</h2>
                {/* Search Mode Toggle */}
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${searchMode === 'barcode' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>باركود</span>
                  <button
                    type="button"
                    onClick={toggleSearchMode}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      searchMode === 'name' ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    style={{ direction: 'ltr' }}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-all duration-200 ${
                        searchMode === 'name' ? 'mr-1 ml-auto' : 'ml-1 mr-auto'
                      }`}
                    />
                  </button>
                  <span className={`text-sm ${searchMode === 'name' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>اسم</span>
                </div>
              </div>

              <div className="mb-4">
                {searchMode === 'barcode' ? (
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
                      autoFocus
                    />
                  </div>
                ) : (
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
                          const newIndex = Math.min(productHighlightIndex + 1, maxIndex);
                          setProductHighlightIndex(newIndex);
                          // Scroll to highlighted item
                          setTimeout(() => {
                            const item = productListRef.current?.querySelector(`[data-index="${newIndex}"]`);
                            item?.scrollIntoView({ block: 'nearest' });
                          }, 0);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          const newIndex = Math.max(productHighlightIndex - 1, 0);
                          setProductHighlightIndex(newIndex);
                          // Scroll to highlighted item
                          setTimeout(() => {
                            const item = productListRef.current?.querySelector(`[data-index="${newIndex}"]`);
                            item?.scrollIntoView({ block: 'nearest' });
                          }, 0);
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          const products = filteredProducts.slice(0, 10);
                          if (productHighlightIndex >= 0 && products[productHighlightIndex]) {
                            openQuickEntryModal(products[productHighlightIndex]);
                            setProductHighlightIndex(-1);
                          } else if (products.length === 1) {
                            openQuickEntryModal(products[0]);
                            setProductHighlightIndex(-1);
                          }
                        }
                      }}
                      className="input w-full"
                      placeholder="ابحث عن منتج..."
                      autoFocus
                    />
                    {showProductSearch && searchTerm && (
                      <div ref={productListRef} className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                                data-index={index}
                                onClick={() => openQuickEntryModal(product)}
                                className={`w-full p-3 text-right border-b last:border-b-0 ${isHighlighted ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                              >
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-gray-500 flex justify-between">
                                  <span>{product.barcode}</span>
                                  <span>
                                    {formatCurrency(unitPrice)} / قطعة
                                    {piecesPerPkg > 1 && <span className="text-blue-500 mr-1">({piecesPerPkg} قطعة/وحدة)</span>}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Items Table - New Format */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-2 text-center w-12">الرقم</th>
                      <th className="px-2 py-2 text-right">التعيين</th>
                      <th className="px-2 py-2 text-center w-20">الكمية</th>
                      <th className="px-2 py-2 text-center w-16">الوحدة</th>
                      <th className="px-2 py-2 text-center w-20">العدد</th>
                      <th className="px-2 py-2 text-center w-24">س. الوحدة</th>
                      <th className="px-2 py-2 text-center w-20">الخصم</th>
                      <th className="px-2 py-2 text-center w-16">TVA</th>
                      <th className="px-2 py-2 text-center w-24">المبلغ</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-gray-500">
                          لم يتم إضافة منتجات بعد
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
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
                            <div className="text-blue-600 font-medium">{item.pieces_per_package}</div>
                            <div className="text-xs text-gray-500">{item.unit_name}</div>
                          </td>
                          <td className="px-2 py-2 text-center font-medium">
                            {item.total_pieces}
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
                          <td className="px-2 py-2 text-center text-sm">
                            <div className="font-medium">{item.tax_percent}%</div>
                            <div className="text-gray-500 text-xs">{formatCurrency(item.tax)}</div>
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-green-600">
                            {formatCurrency(item.subtotal)}
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

            {/* Notes */}
            <div className="card">
              <label className="block text-sm font-medium mb-1">ملاحظات</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input w-full"
                rows={2}
                placeholder="أضف ملاحظات..."
              />
            </div>
          </div>

          {/* Sidebar - Summary */}
          <div>
            <div className="card sticky top-24">
              <h2 className="text-lg font-semibold mb-4">ملخص الفاتورة</h2>

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

                {/* Payment Section */}
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <label className="block text-sm font-medium text-green-800 mb-2">المبلغ المدفوع</label>
                  <input
                    ref={paidAmountRef}
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="input w-full text-lg font-bold text-center"
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                  {supplierId && previousDebt > 0 && (
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      يمكنك دفع أكثر من قيمة الفاتورة لتسديد الدين السابق
                    </div>
                  )}
                </div>

                {/* Payment Breakdown */}
                {supplierId && supplierDebt ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                    {/* Summary at top */}
                    <div className="p-2 bg-white rounded border border-blue-100 mb-2">
                      <div className="flex justify-between items-center text-sm">
                        <span>هذه الفاتورة:</span>
                        <span className="font-bold">{formatCurrency(grandTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>+ الدين السابق:</span>
                        <span className="font-bold">{formatCurrency(previousDebt)}</span>
                      </div>
                      <hr className="my-1" />
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span>= المجموع:</span>
                        <span className="text-blue-600">{formatCurrency(grandTotal + previousDebt)}</span>
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-blue-800 mb-2">توزيع المبلغ المدفوع ({formatCurrency(currentPaidAmount)}):</div>

                    {currentPaidAmount > 0 ? (
                      <>
                        {/* Applied to current purchase */}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">يُخصم من الفاتورة:</span>
                          <span className="font-medium text-green-600">{formatCurrency(appliedToCurrentPurchase)}</span>
                        </div>

                        {/* Applied to previous debt */}
                        {appliedToPreviousDebt > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">يُخصم من الدين السابق:</span>
                            <span className="font-medium text-green-600">{formatCurrency(appliedToPreviousDebt)}</span>
                          </div>
                        )}

                        <hr className="border-blue-200" />
                      </>
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-1">لم يتم إدخال مبلغ مدفوع</div>
                    )}

                    {/* Remaining */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">متبقي الفاتورة:</span>
                      <span className={`font-medium ${remainingFromPurchase > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(remainingFromPurchase)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">متبقي الدين السابق:</span>
                      <span className={`font-medium ${remainingPreviousDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(remainingPreviousDebt)}
                      </span>
                    </div>

                    <hr className="border-blue-200" />

                    {/* Total remaining */}
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-blue-800">إجمالي الدين بعد الدفع:</span>
                      <span className={`text-lg ${totalRemainingDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(totalRemainingDebt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">المتبقي من الفاتورة:</span>
                      <span className={`font-bold ${remainingFromPurchase > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(remainingFromPurchase)}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  ref={submitBtnRef}
                  type="submit"
                  disabled={isSaving || items.length === 0}
                  className="btn btn-primary w-full"
                >
                  {isSaving ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
                </button>

                <Link href="/dashboard/purchases" className="btn btn-secondary w-full text-center block">
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
