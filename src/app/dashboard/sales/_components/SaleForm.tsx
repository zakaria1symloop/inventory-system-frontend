'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { salesApi, productsApi, clientsApi, warehousesApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface StockItem {
  quantity: number;
  warehouse_id: number;
}

interface Product {
  id: number;
  name: string;
  barcode: string;
  cost_price: number;
  retail_price: number;
  min_selling_price?: number;
  pieces_per_package?: number;
  unit_sale?: { id: number; name: string; short_name: string };
  stock?: StockItem[];
}

interface Client {
  id: number;
  name: string;
  phone?: string;
  balance?: number;
  credit_limit?: number;
}

interface ClientDebtInfo {
  balance: number;
  credit_limit: number;
  available_credit: number;
  unpaid_orders?: Array<{
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

interface SaleItem {
  product_id: number;
  product_name: string;
  barcode: string;
  quantity: number; // Number of packages/units
  pieces_per_package: number; // Pieces per package
  total_pieces: number; // Total pieces = quantity * pieces_per_package
  unit_price: number; // Price per 1 PIECE (not per package)
  original_price: number; // Original price per piece
  unit_name: string; // Unit name
  discount: number;
  tax: number;
  subtotal: number; // = unit_price × pieces_per_package × quantity - discount + tax
  available_stock: number;
  min_selling_price: number;
}

interface SaleFormProps {
  saleId?: number | null;
}

export default function SaleForm({ saleId = null }: SaleFormProps) {
  const router = useRouter();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  const isEditMode = saleId !== null;

  const [clients, setClients] = useState<Client[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saleDataLoaded, setSaleDataLoaded] = useState(false);

  // Form state
  const [clientId, setClientId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(0);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);

  // Client debt info
  const [clientDebt, setClientDebt] = useState<ClientDebtInfo | null>(null);
  const [loadingDebt, setLoadingDebt] = useState(false);

  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientHighlightIndex, setClientHighlightIndex] = useState(-1);
  const clientSearchRef = useRef<HTMLInputElement>(null);
  const clientListRef = useRef<HTMLDivElement>(null);

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
  }>({ show: false, product: null, quantity: 1, unitPrice: 0 });
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
      // Don't trigger if modal is open or typing in input
      if (quickEntryModal.show) return;

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          clientSearchRef.current?.focus();
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

  // Fetch client debt when client changes
  useEffect(() => {
    if (clientId) {
      fetchClientDebt(parseInt(clientId));
    } else {
      setClientDebt(null);
    }
  }, [clientId]);

  // Load sale data in edit mode - wait for clients to be loaded first
  useEffect(() => {
    if (isEditMode && saleId && clients.length > 0 && !saleDataLoaded) {
      loadSaleData(saleId);
    }
  }, [isEditMode, saleId, clients.length, saleDataLoaded]);

  const fetchData = async () => {
    try {
      const [clientsRes, warehousesRes, productsRes] = await Promise.all([
        clientsApi.getAll({ per_page: 1000 }),
        warehousesApi.getAll(),
        productsApi.getAll({ per_page: 1000 }),
      ]);
      setClients(clientsRes.data.data || clientsRes.data);
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

  const fetchClientDebt = async (id: number) => {
    setLoadingDebt(true);
    try {
      const [balanceRes, debtRes] = await Promise.all([
        clientsApi.getBalance(id),
        clientsApi.getSalesDebt(id).catch(() => ({ data: { sales: [], totals: { total_remaining: 0 } } }))
      ]);
      // Use the actual sum of unpaid sales, not the client balance
      // This is more accurate because client.balance might be out of sync
      const actualDebt = debtRes.data.totals?.total_remaining || 0;
      setClientDebt({
        balance: actualDebt,
        credit_limit: balanceRes.data.credit_limit || 0,
        available_credit: balanceRes.data.available_credit || 0,
        unpaid_orders: debtRes.data.sales || []
      });
    } catch (error) {
      console.error('Error fetching client debt:', error);
      setClientDebt(null);
    } finally {
      setLoadingDebt(false);
    }
  };

  const loadSaleData = async (id: number) => {
    try {
      setIsLoading(true);
      const response = await salesApi.getOne(id);
      const sale = response.data;

      // Set form fields (only editable fields)
      setDiscount(sale.discount || 0);
      setTax(sale.tax_percentage || 0);
      setShipping(sale.shipping || 0);
      setNote(sale.note || '');
      setPaidAmount(sale.paid_amount || 0);

      // Set read-only fields
      if (sale.client_id) {
        setClientId(sale.client_id.toString());
        // Use client data from sale response or find in clients list
        const clientName = sale.client?.name || clients.find(c => c.id === sale.client_id)?.name || '';
        setClientSearch(clientName);
      } else {
        setClientId('');
        setClientSearch('');
      }
      setWarehouseId(sale.warehouse_id?.toString() || '');
      setDate(sale.date?.split(' ')[0] || new Date().toISOString().split('T')[0]);

      // Load items (read-only in edit mode)
      if (sale.items && Array.isArray(sale.items)) {
        const loadedItems: SaleItem[] = sale.items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product?.name || '',
          barcode: item.product?.barcode || '',
          quantity: item.quantity,
          pieces_per_package: item.product?.pieces_per_package || 1,
          total_pieces: item.quantity * (item.product?.pieces_per_package || 1),
          unit_price: item.unit_price,
          original_price: item.unit_price,
          unit_name: item.product?.unit_sale?.short_name || 'وحدة',
          discount: item.discount || 0,
          tax: item.tax || 0,
          subtotal: item.subtotal || 0,
          available_stock: 0, // Not needed in edit mode
          min_selling_price: item.product?.min_selling_price || 0,
        }));
        setItems(loadedItems);
      }

      toast.success('تم تحميل بيانات الفاتورة');
      setSaleDataLoaded(true);
    } catch (error) {
      toast.error('خطأ في تحميل بيانات الفاتورة');
      console.error('Error loading sale data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getProductStock = (product: Product): number => {
    if (!product.stock || !warehouseId) return 0;
    const warehouseStock = product.stock.find(s => s.warehouse_id === parseInt(warehouseId));
    return Number(warehouseStock?.quantity) || 0;
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
    if (!warehouseId) {
      toast.error('الرجاء اختيار المستودع أولاً');
      return;
    }

    const availableStock = getProductStock(product);
    const existingIndex = items.findIndex((item) => item.product_id === product.id);

    if (existingIndex >= 0) {
      const existingItem = items[existingIndex];
      const newQty = existingItem.quantity + quantity;
      if (newQty > availableStock) {
        toast.error(`الكمية المتوفرة: ${Math.round(availableStock)} فقط`);
        return;
      }
      const updatedItem = {
        ...existingItem,
        quantity: newQty,
        total_pieces: newQty * existingItem.pieces_per_package
      };
      updatedItem.subtotal = calculateSubtotal(updatedItem);
      const otherItems = items.filter((_, i) => i !== existingIndex);
      setItems([updatedItem, ...otherItems]);
    } else {
      if (availableStock < quantity) {
        toast.error(`المنتج "${product.name}" غير متوفر في المخزون`);
        return;
      }
      const piecesPerPkg = product.pieces_per_package || 1;
      const unitPrice = Number(product.retail_price) || 0;
      const minUnitPrice = Number(product.min_selling_price) || 0;
      const unitName = product.unit_sale?.name || 'وحدة';

      const newItem: SaleItem = {
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode,
        quantity: quantity,
        pieces_per_package: piecesPerPkg,
        total_pieces: quantity * piecesPerPkg,
        unit_price: unitPrice, // Price per 1 piece
        original_price: unitPrice,
        unit_name: unitName,
        discount: 0,
        tax: 0,
        subtotal: unitPrice * piecesPerPkg * quantity, // price × pieces × qty
        available_stock: availableStock,
        min_selling_price: minUnitPrice,
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
      unitPrice: Number(product.retail_price) || 0,
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

    const availableStock = getProductStock(product);
    const existingIndex = items.findIndex((item) => item.product_id === product.id);

    if (existingIndex >= 0) {
      const existingItem = items[existingIndex];
      const newQty = existingItem.quantity + quantity;
      if (newQty > availableStock) {
        toast.error(`الكمية المتوفرة: ${Math.round(availableStock)} فقط`);
        return;
      }
      const updatedItem = {
        ...existingItem,
        quantity: newQty,
        total_pieces: newQty * existingItem.pieces_per_package,
        unit_price: unitPrice,
      };
      updatedItem.subtotal = calculateSubtotal(updatedItem);
      const otherItems = items.filter((_, i) => i !== existingIndex);
      setItems([updatedItem, ...otherItems]);
    } else {
      if (availableStock < quantity) {
        toast.error(`الكمية المتوفرة: ${Math.round(availableStock)} فقط`);
        return;
      }
      const piecesPerPkg = product.pieces_per_package || 1;
      const minUnitPrice = Number(product.min_selling_price) || 0;
      const unitName = product.unit_sale?.name || 'وحدة';

      const newItem: SaleItem = {
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode,
        quantity: quantity,
        pieces_per_package: piecesPerPkg,
        total_pieces: quantity * piecesPerPkg,
        unit_price: unitPrice, // Price per 1 piece
        original_price: Number(product.retail_price) || 0,
        unit_name: unitName,
        discount: 0,
        tax: 0,
        subtotal: unitPrice * piecesPerPkg * quantity, // price × pieces × qty
        available_stock: availableStock,
        min_selling_price: minUnitPrice,
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

  const updateItem = (index: number, field: 'quantity' | 'unit_price' | 'discount' | 'tax', value: number) => {
    const updated = [...items];
    const numValue = Number(value) || 0;

    if (field === 'quantity') {
      if (numValue > updated[index].available_stock) {
        toast.error(`الكمية المتوفرة: ${Math.round(updated[index].available_stock)} فقط`);
        return;
      }
      updated[index].quantity = numValue;
      updated[index].total_pieces = numValue * updated[index].pieces_per_package;
    } else if (field === 'unit_price') {
      updated[index].unit_price = numValue;
    } else if (field === 'discount') {
      updated[index].discount = numValue;
    } else if (field === 'tax') {
      updated[index].tax = numValue;
    }

    updated[index].subtotal = calculateSubtotal(updated[index]);
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateSubtotal = (item: SaleItem): number => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0; // Price per 1 piece
    const piecesPerPkg = Number(item.pieces_per_package) || 1;
    const disc = Number(item.discount) || 0;
    const itemTax = Number(item.tax) || 0;
    // subtotal = price × pieces_per_package × quantity - discount + tax
    return (price * piecesPerPkg * qty) - disc + itemTax;
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const afterDiscount = totalAmount - (Number(discount) || 0);
  const taxAmount = afterDiscount * ((Number(tax) || 0) / 100);
  const grandTotal = Math.max(0, afterDiscount + taxAmount + (Number(shipping) || 0));

  // Calculate how payment is applied
  // previousDebt = what the client already owes us BEFORE this sale
  const previousDebt = Number(clientDebt?.balance) || 0;
  const currentPaidAmount = Number(paidAmount) || 0;

  // If paid more than current sale, extra goes to previous debt
  const appliedToCurrentSale = Math.min(currentPaidAmount, grandTotal);
  const appliedToPreviousDebt = Math.max(0, currentPaidAmount - grandTotal);
  const remainingFromSale = grandTotal - appliedToCurrentSale;
  const remainingPreviousDebt = Math.max(0, previousDebt - appliedToPreviousDebt);
  const totalRemainingDebt = remainingFromSale + remainingPreviousDebt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode && saleId) {
      // Edit mode - only update allowed fields
      setIsSaving(true);
      try {
        await salesApi.update(saleId, {
          discount,
          tax: taxAmount,
          shipping,
          note,
        });

        toast.success('تم تحديث الفاتورة بنجاح');
        router.push('/dashboard/sales');
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

    for (const item of items) {
      if (item.quantity > item.available_stock) {
        toast.error(`الكمية المطلوبة لـ "${item.product_name}" (${item.quantity}) أكبر من المتوفر (${Math.round(item.available_stock)})`);
        return;
      }
    }

    setIsSaving(true);

    try {
      // Update product prices if changed
      for (const item of items) {
        if (item.unit_price !== item.original_price) {
          try {
            await productsApi.update(item.product_id, { retail_price: item.unit_price });
          } catch (error) {
            console.error(`Failed to update price for product ${item.product_id}:`, error);
          }
        }
      }

      await salesApi.create({
        client_id: clientId ? parseInt(clientId) : null,
        warehouse_id: parseInt(warehouseId),
        date,
        discount,
        tax: taxAmount,
        tax_percentage: tax,
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

      toast.success('تم إنشاء فاتورة البيع بنجاح');
      router.push('/dashboard/sales');
    } catch (error) {
      toast.error('خطأ في إنشاء فاتورة البيع');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
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
        <span><kbd className="bg-gray-600 px-2 py-0.5 rounded">F1</kbd> العميل</span>
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
          <Link href="/dashboard/sales" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold">{isEditMode ? 'تعديل فاتورة البيع' : 'فاتورة بيع جديدة'}</h1>
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
                  <label className="block text-sm font-medium mb-1">العميل</label>
                  <input
                    ref={clientSearchRef}
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                      if (!e.target.value) {
                        setClientId('');
                        setClientDebt(null);
                      }
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    onKeyDown={(e) => {
                      const filtered = clients.filter(c =>
                        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                        (c.phone && c.phone.includes(clientSearch))
                      ).slice(0, 10);
                      const maxIndex = filtered.length; // 0 = cash client, 1+ = filtered clients

                      if (e.key === 'Escape') {
                        setShowClientDropdown(false);
                        setClientHighlightIndex(-1);
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setShowClientDropdown(true);
                        const newIndex = Math.min(clientHighlightIndex + 1, maxIndex);
                        setClientHighlightIndex(newIndex);
                        // Scroll to highlighted item
                        setTimeout(() => {
                          const item = clientListRef.current?.querySelector(`[data-client-index="${newIndex}"]`);
                          item?.scrollIntoView({ block: 'nearest' });
                        }, 0);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const newIndex = Math.max(clientHighlightIndex - 1, 0);
                        setClientHighlightIndex(newIndex);
                        // Scroll to highlighted item
                        setTimeout(() => {
                          const item = clientListRef.current?.querySelector(`[data-client-index="${newIndex}"]`);
                          item?.scrollIntoView({ block: 'nearest' });
                        }, 0);
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (clientHighlightIndex === 0) {
                          setClientId('');
                          setClientSearch('');
                          setClientDebt(null);
                          setShowClientDropdown(false);
                          setClientHighlightIndex(-1);
                        } else if (clientHighlightIndex > 0 && filtered[clientHighlightIndex - 1]) {
                          const selected = filtered[clientHighlightIndex - 1];
                          setClientId(selected.id.toString());
                          setClientSearch(selected.name);
                          setShowClientDropdown(false);
                          setClientHighlightIndex(-1);
                        } else if (filtered.length === 1) {
                          setClientId(filtered[0].id.toString());
                          setClientSearch(filtered[0].name);
                          setShowClientDropdown(false);
                          setClientHighlightIndex(-1);
                        }
                      }
                    }}
                    placeholder="ابحث عن عميل أو اتركه فارغاً للنقدي"
                    className="input w-full"
                    autoComplete="off"
                  />
                  {showClientDropdown && (
                    <div ref={clientListRef} className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div
                        data-client-index="0"
                        className={`px-3 py-2 cursor-pointer border-b ${clientHighlightIndex === 0 ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        onClick={() => {
                          setClientId('');
                          setClientSearch('');
                          setClientDebt(null);
                          setShowClientDropdown(false);
                          setClientHighlightIndex(-1);
                        }}
                      >
                        <span className="text-gray-500">عميل نقدي (بدون عميل)</span>
                      </div>
                      {clients
                        .filter(c =>
                          c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                          (c.phone && c.phone.includes(clientSearch))
                        )
                        .slice(0, 10)
                        .map((client, index) => (
                          <div
                            key={client.id}
                            data-client-index={index + 1}
                            className={`px-3 py-2 cursor-pointer ${clientHighlightIndex === index + 1 ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                            onClick={() => {
                              setClientId(client.id.toString());
                              setClientSearch(client.name);
                              setShowClientDropdown(false);
                              setClientHighlightIndex(-1);
                            }}
                          >
                            <div className="font-medium">{client.name}</div>
                            {client.phone && <div className="text-sm text-gray-500">{client.phone}</div>}
                          </div>
                        ))}
                      {clients.filter(c =>
                        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                        (c.phone && c.phone.includes(clientSearch))
                      ).length === 0 && (
                        <div className="px-3 py-2 text-gray-500">لا يوجد نتائج</div>
                      )}
                    </div>
                  )}
                  {/* Click outside to close */}
                  {showClientDropdown && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowClientDropdown(false)}
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

              {/* Client Debt Info */}
              {clientId && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  {loadingDebt ? (
                    <div className="text-center text-gray-500">جاري تحميل بيانات الدين...</div>
                  ) : clientDebt ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-orange-800">الدين السابق:</span>
                        <span className={`font-bold text-lg ${clientDebt.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(clientDebt.balance)}
                        </span>
                      </div>
                      {clientDebt.credit_limit > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">حد الائتمان:</span>
                          <span>{formatCurrency(clientDebt.credit_limit)}</span>
                        </div>
                      )}
                      {clientDebt.unpaid_orders && clientDebt.unpaid_orders.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-orange-200">
                          <div className="text-sm font-medium text-orange-800 mb-2">الفواتير غير المسددة:</div>
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {clientDebt.unpaid_orders.slice(0, 5).map((order) => (
                              <div key={order.id} className="flex justify-between text-sm">
                                <span className="text-gray-600">{order.reference}</span>
                                <span className="text-red-600">{formatCurrency(order.due_amount)}</span>
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
                        const availableProducts = filteredProducts.slice(0, 10).filter(p => getProductStock(p) >= 1);
                        const maxIndex = availableProducts.length - 1;

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
                          if (productHighlightIndex >= 0 && availableProducts[productHighlightIndex]) {
                            openQuickEntryModal(availableProducts[productHighlightIndex]);
                            setProductHighlightIndex(-1);
                          } else if (availableProducts.length === 1) {
                            openQuickEntryModal(availableProducts[0]);
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
                          (() => {
                            let availableIndex = -1;
                            return filteredProducts.slice(0, 10).map((product) => {
                              const stock = getProductStock(product);
                              const isOutOfStock = stock < 1;
                              if (!isOutOfStock) availableIndex++;
                              const currentAvailableIndex = availableIndex;
                              const isHighlighted = !isOutOfStock && productHighlightIndex === currentAvailableIndex;
                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  data-index={isOutOfStock ? undefined : currentAvailableIndex}
                                  onClick={() => openQuickEntryModal(product)}
                                  className={`w-full p-3 text-right border-b last:border-b-0 ${isOutOfStock ? 'bg-red-50 opacity-60' : isHighlighted ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                                  disabled={isOutOfStock}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{product.name}</span>
                                    <span className={`text-sm font-bold ${isOutOfStock ? 'text-red-600' : 'text-green-600'}`}>
                                      {stock > 0 ? `متوفر: ${stock}` : 'غير متوفر'}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-500 flex justify-between">
                                    <span>{product.barcode}</span>
                                    <span>{formatCurrency(Number(product.retail_price) || 0)} / قطعة</span>
                                  </div>
                                </button>
                              );
                            });
                          })()
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
                      <th className="px-2 py-2 text-center w-24">المبلغ</th>
                      <th className="px-2 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-gray-500">
                          لم يتم إضافة منتجات بعد
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => {
                        const isBelowMinPrice = item.min_selling_price > 0 && item.unit_price < item.min_selling_price;
                        return (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="px-2 py-2 text-center font-medium text-gray-500">{index + 1}</td>
                            <td className="px-2 py-2">
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-xs text-gray-500">{item.barcode}</div>
                              {isBelowMinPrice && (
                                <div className="text-xs text-red-600">الحد الأدنى: {formatCurrency(item.min_selling_price)}</div>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                ref={(el) => { inputRefs.current[`${index}-quantity`] = el; }}
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                onKeyDown={(e) => handleKeyDown(e, index, 'quantity')}
                                className={`input w-full text-center ${item.quantity > item.available_stock ? 'border-red-500' : ''}`}
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
                                className={`input w-full text-center ${isBelowMinPrice ? 'border-red-500 bg-red-50' : ''}`}
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
                        );
                      })
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
                  <label className="block text-sm text-gray-500 mb-1">الضريبة (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={tax}
                      onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                      className="input flex-1"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <span className="text-gray-400">%</span>
                  </div>
                  {tax > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      = {formatCurrency(taxAmount)}
                    </div>
                  )}
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
                  <span className="text-blue-600">{formatCurrency(grandTotal)}</span>
                </div>

                {/* Payment Section */}
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <label className="block text-sm font-medium text-green-800 mb-2">المبلغ المقبوض</label>
                  <input
                    ref={paidAmountRef}
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        submitBtnRef.current?.focus();
                      }
                    }}
                    className="input w-full text-lg font-bold text-center"
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                  {clientId && previousDebt > 0 && (
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      يمكن قبض أكثر من قيمة الفاتورة لتسديد الدين السابق
                    </div>
                  )}
                </div>

                {/* Payment Breakdown */}
                {clientId && clientDebt ? (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
                    {/* Summary at top */}
                    <div className="p-2 bg-white rounded border border-orange-100 mb-2">
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
                        <span className="text-orange-600">{formatCurrency(grandTotal + previousDebt)}</span>
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-orange-800 mb-2">توزيع المبلغ المقبوض ({formatCurrency(currentPaidAmount)}):</div>

                    {currentPaidAmount > 0 ? (
                      <>
                        {/* Applied to current sale */}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">يُخصم من الفاتورة:</span>
                          <span className="font-medium text-green-600">{formatCurrency(appliedToCurrentSale)}</span>
                        </div>

                        {/* Applied to previous debt */}
                        {appliedToPreviousDebt > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">يُخصم من الدين السابق:</span>
                            <span className="font-medium text-green-600">{formatCurrency(appliedToPreviousDebt)}</span>
                          </div>
                        )}

                        <hr className="border-orange-200" />
                      </>
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-1">لم يتم إدخال مبلغ مقبوض</div>
                    )}

                    {/* Remaining */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">متبقي الفاتورة:</span>
                      <span className={`font-medium ${remainingFromSale > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(remainingFromSale)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">متبقي الدين السابق:</span>
                      <span className={`font-medium ${remainingPreviousDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(remainingPreviousDebt)}
                      </span>
                    </div>

                    <hr className="border-orange-200" />

                    {/* Total remaining */}
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-orange-800">إجمالي دين العميل بعد التحصيل:</span>
                      <span className={`text-lg ${totalRemainingDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(totalRemainingDebt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">المتبقي من الفاتورة:</span>
                      <span className={`font-bold ${remainingFromSale > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(remainingFromSale)}
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
                  {isSaving ? 'جاري الحفظ...' : 'حفظ الفاتورة (F4)'}
                </button>

                <Link href="/dashboard/sales" className="btn btn-secondary w-full text-center block">
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
