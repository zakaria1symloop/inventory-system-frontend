'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, categoriesApi, brandsApi, unitsApi } from '@/lib/api';
import { PlusIcon, PencilIcon, TrashIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import type { Product, Category, Brand, Unit } from '@/lib/types';

interface StockItem {
  quantity: number;
  warehouse?: { name: string };
}

interface ProductWithStock extends Product {
  stock?: StockItem[];
  available_stock?: number;
  current_stock?: number;
}

export default function ProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    brand_id: '',
    unit_buy_id: '',
    unit_sale_id: '',
    barcode: '',
    cost_price: '',
    retail_price: '',
    wholesale_price: '',
    min_selling_price: '',
    stock_alert: '',
    tax_percent: '',
    pieces_per_package: '1',
    is_active: true,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Insert key or Alt+N: Open add product modal
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        handleOpenCreate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search],
    queryFn: async () => {
      const response = await productsApi.getAll({ page, search, per_page: 15, warehouse_id: 1 });
      return response.data;
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const response = await categoriesApi.getAll({ active_only: true });
      return response.data;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ['brands-list'],
    queryFn: async () => {
      const response = await brandsApi.getAll({ active_only: true });
      return response.data;
    },
  });

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => {
      const response = await unitsApi.getAll({ active_only: true });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('تم إضافة المنتج بنجاح');
      handleCloseModal();
    },
    onError: () => toast.error('حدث خطأ أثناء الإضافة'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('تم تحديث المنتج بنجاح');
      handleCloseModal();
    },
    onError: () => toast.error('حدث خطأ أثناء التحديث'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('تم حذف المنتج بنجاح');
      setIsDeleteOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'حدث خطأ أثناء الحذف';
      toast.error(message);
      setIsDeleteOpen(false);
    },
  });

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setFormData({
      name: '',
      category_id: '',
      brand_id: '',
      unit_buy_id: '',
      unit_sale_id: '',
      barcode: '',
      cost_price: '',
      retail_price: '',
      wholesale_price: '',
      min_selling_price: '',
      stock_alert: '',
      tax_percent: '',
      pieces_per_package: '1',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      category_id: product.category_id?.toString() || '',
      brand_id: product.brand_id?.toString() || '',
      unit_buy_id: product.unit_buy_id?.toString() || '',
      unit_sale_id: product.unit_sale_id?.toString() || '',
      barcode: product.barcode || '',
      cost_price: product.cost_price?.toString() || '',
      retail_price: product.retail_price?.toString() || '',
      wholesale_price: product.wholesale_price?.toString() || '',
      min_selling_price: product.min_selling_price?.toString() || '',
      stock_alert: product.stock_alert?.toString() || '',
      tax_percent: product.tax_percent?.toString() || '',
      pieces_per_package: (product.pieces_per_package || 1).toString(),
      is_active: product.is_active,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      category_id: parseInt(formData.category_id) || null,
      brand_id: formData.brand_id ? parseInt(formData.brand_id) : null,
      unit_buy_id: parseInt(formData.unit_buy_id) || null,
      unit_sale_id: parseInt(formData.unit_sale_id) || null,
      cost_price: parseFloat(formData.cost_price) || 0,
      retail_price: parseFloat(formData.retail_price) || 0,
      wholesale_price: parseFloat(formData.wholesale_price) || 0,
      min_selling_price: formData.min_selling_price ? parseFloat(formData.min_selling_price) : null,
      stock_alert: formData.stock_alert ? parseInt(formData.stock_alert) : null,
      tax_percent: formData.tax_percent ? parseFloat(formData.tax_percent) : 0,
      pieces_per_package: formData.pieces_per_package ? parseInt(formData.pieces_per_package) : 1,
    };

    if (selectedProduct) {
      updateMutation.mutate({ id: selectedProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleGenerateBarcode = async () => {
    try {
      const response = await productsApi.generateBarcode();
      setFormData((prev) => ({ ...prev, barcode: response.data.barcode }));
    } catch {
      toast.error('حدث خطأ أثناء توليد الباركود');
    }
  };

  const getTotalStock = (product: ProductWithStock): number => {
    // Prefer available_stock (warehouse-specific with reserved deducted) if provided
    if (product.available_stock !== undefined) {
      return product.available_stock;
    }
    // Fallback to current_stock (total across warehouses)
    if (product.current_stock !== undefined) {
      return product.current_stock;
    }
    // Fallback to summing stock array
    if (!product.stock || product.stock.length === 0) return 0;
    return product.stock.reduce((sum, s) => sum + (parseFloat(String(s.quantity)) || 0), 0);
  };

  const exportToPDF = () => {
    const products = data?.data || [];
    const printContent = `
      <html>
      <head>
        <title>Liste des Produits</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          .low-stock { color: red; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Liste des Produits</h1>
        <p>Date: ${new Date().toLocaleDateString('fr-FR')}</p>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Categorie</th>
              <th>Marque</th>
              <th>Quantite</th>
              <th>Prix Achat</th>
              <th>Prix Vente</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${products.map((p: ProductWithStock) => {
              const qty = getTotalStock(p);
              const isLow = p.stock_alert && qty <= p.stock_alert;
              return `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.category?.name || '-'}</td>
                  <td>${p.brand?.name || '-'}</td>
                  <td class="${isLow ? 'low-stock' : ''}">${qty}</td>
                  <td>${p.cost_price} DA</td>
                  <td>${p.retail_price} DA</td>
                  <td>${p.is_active ? 'Actif' : 'Inactif'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const exportToExcel = () => {
    const products = data?.data || [];
    let csv = '\uFEFF'; // BOM for UTF-8
    csv += 'Nom,Categorie,Marque,Quantite,Prix Achat,Prix Vente,Statut\n';
    products.forEach((p: ProductWithStock) => {
      const qty = getTotalStock(p);
      csv += `"${p.name}","${p.category?.name || '-'}","${p.brand?.name || '-'}",${qty},${p.cost_price},${p.retail_price},"${p.is_active ? 'Actif' : 'Inactif'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Export termine avec succes');
  };

  const columns = [
    { key: 'name', title: 'الاسم' },
    {
      key: 'category',
      title: 'الصنف',
      render: (item: ProductWithStock) => item.category?.name || '-',
    },
    {
      key: 'brand',
      title: 'العلامة',
      render: (item: ProductWithStock) => item.brand?.name || '-',
    },
    {
      key: 'quantity',
      title: 'الكمية',
      render: (item: ProductWithStock) => {
        const qty = getTotalStock(item);
        const isLow = item.stock_alert && qty <= item.stock_alert;
        const displayQty = Number.isInteger(qty) ? qty : Math.round(qty);
        return (
          <span className={isLow ? 'text-red-600 font-bold' : ''}>
            {displayQty}
          </span>
        );
      },
    },
    {
      key: 'cost_price',
      title: 'سعر الشراء',
      render: (item: ProductWithStock) => {
        const unitName = item.unit_buy?.short_name || 'وحدة';
        return `${item.cost_price} د.ج/${unitName}`;
      },
    },
    {
      key: 'retail_price',
      title: 'سعر البيع',
      render: (item: ProductWithStock) => {
        const unitName = item.unit_sale?.short_name || 'وحدة';
        return `${item.retail_price} د.ج/${unitName}`;
      },
    },
    {
      key: 'is_active',
      title: 'الحالة',
      render: (item: ProductWithStock) => (
        <span className={`badge ${item.is_active ? 'badge-success' : 'badge-danger'}`}>
          {item.is_active ? 'نشط' : 'معطل'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'الإجراءات',
      render: (item: ProductWithStock) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEdit(item)}
            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedProduct(item);
              setIsDeleteOpen(true);
            }}
            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Shortcuts hint */}
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg mb-4 flex items-center gap-6 text-sm">
        <span className="font-medium">اختصارات:</span>
        <span><kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">Insert</kbd> إضافة جديد</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">المنتجات</h1>
          <p className="text-gray-500 mt-1">إدارة المنتجات والمخزون</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToPDF} className="btn btn-secondary">
            <DocumentArrowDownIcon className="w-5 h-5" />
            PDF
          </button>
          <button onClick={exportToExcel} className="btn btn-secondary">
            <DocumentArrowDownIcon className="w-5 h-5" />
            Excel
          </button>
          <button onClick={handleOpenCreate} className="btn btn-primary">
            <PlusIcon className="w-5 h-5" />
            إضافة منتج
            <kbd className="bg-blue-700 px-1.5 py-0.5 rounded text-xs">Insert</kbd>
          </button>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          searchable
          searchPlaceholder="بحث عن منتج..."
          onSearch={setSearch}
          pagination={
            data && {
              currentPage: data.current_page,
              lastPage: data.last_page,
              total: data.total,
              perPage: data.per_page,
              onPageChange: setPage,
            }
          }
          emptyMessage="لا توجد منتجات"
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الصنف</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData((p) => ({ ...p, category_id: e.target.value }))}
                className="select"
                required
              >
                <option value="">اختر الصنف</option>
                {(categories as Category[])?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">العلامة التجارية</label>
              <select
                value={formData.brand_id}
                onChange={(e) => setFormData((p) => ({ ...p, brand_id: e.target.value }))}
                className="select"
              >
                <option value="">اختر العلامة</option>
                {(brands as Brand[])?.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">وحدة الشراء (الكرتون/العلبة)</label>
              <select
                value={formData.unit_buy_id}
                onChange={(e) => setFormData((p) => ({ ...p, unit_buy_id: e.target.value }))}
                className="select"
                required
              >
                <option value="">اختر الوحدة</option>
                {(units as Unit[])?.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                عدد القطع في {(units as Unit[])?.find(u => u.id.toString() === formData.unit_buy_id)?.name || 'الوحدة'} (للمعلومات)
              </label>
              <input
                type="number"
                value={formData.pieces_per_package}
                onChange={(e) => setFormData((p) => ({ ...p, pieces_per_package: e.target.value }))}
                className="input"
                min="1"
                placeholder="1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">وحدة البيع</label>
              <select
                value={formData.unit_sale_id}
                onChange={(e) => setFormData((p) => ({ ...p, unit_sale_id: e.target.value }))}
                className="select"
                required
              >
                <option value="">اختر الوحدة</option>
                {(units as Unit[])?.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الباركود</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))}
                className="input flex-1"
              />
              <button type="button" onClick={handleGenerateBarcode} className="btn btn-secondary">
                توليد
              </button>
            </div>
          </div>

          {/* Price Section Header */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <h3 className="font-semibold text-blue-800">الأسعار (سعر الوحدة: {(units as Unit[])?.find(u => u.id.toString() === formData.unit_buy_id)?.name || 'كرتون'})</h3>
            <p className="text-sm text-blue-600">عدد القطع في الوحدة ({formData.pieces_per_package} قطعة) للمعلومات فقط</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سعر الشراء (لل{(units as Unit[])?.find(u => u.id.toString() === formData.unit_buy_id)?.name || 'وحدة'})</label>
              <input
                type="number"
                value={formData.cost_price}
                onChange={(e) => setFormData((p) => ({ ...p, cost_price: e.target.value }))}
                className="input"
                required
                min="0"
                step="0.01"
                placeholder="سعر الوحدة"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع (لل{(units as Unit[])?.find(u => u.id.toString() === formData.unit_sale_id)?.name || 'وحدة'})</label>
              <input
                type="number"
                value={formData.retail_price}
                onChange={(e) => setFormData((p) => ({ ...p, retail_price: e.target.value }))}
                className="input"
                required
                min="0"
                step="0.01"
                placeholder="سعر الوحدة"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للبيع (اختياري)</label>
              <input
                type="number"
                value={formData.min_selling_price}
                onChange={(e) => setFormData((p) => ({ ...p, min_selling_price: e.target.value }))}
                className="input"
                min="0"
                step="0.01"
                placeholder="اختياري"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نسبة الضريبة (TVA %)</label>
              <input
                type="number"
                value={formData.tax_percent}
                onChange={(e) => setFormData((p) => ({ ...p, tax_percent: e.target.value }))}
                className="input"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">حد التنبيه للمخزون</label>
              <input
                type="number"
                value={formData.stock_alert}
                onChange={(e) => setFormData((p) => ({ ...p, stock_alert: e.target.value }))}
                className="input"
                min="0"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">منتج نشط</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn btn-primary"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <span className="spinner w-4 h-4"></span>
              ) : selectedProduct ? (
                'تحديث'
              ) : (
                'إضافة'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => selectedProduct && deleteMutation.mutate(selectedProduct.id)}
        title="حذف المنتج"
        message={`هل أنت متأكد من حذف "${selectedProduct?.name}"؟`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
