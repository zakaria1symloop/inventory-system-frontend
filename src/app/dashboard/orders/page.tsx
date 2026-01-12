'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api';
import {
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import DataTable from '@/components/ui/DataTable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import Link from 'next/link';
import type { Order } from '@/lib/types';

const statusLabels: Record<string, string> = {
  pending: 'معلق',
  confirmed: 'مؤكد',
  assigned: 'موزع',
  delivered: 'تم التسليم',
  partial: 'تسليم جزئي',
  cancelled: 'ملغي',
};

const statusClasses: Record<string, string> = {
  pending: 'badge-warning',
  confirmed: 'badge-info',
  assigned: 'badge-info',
  delivered: 'badge-success',
  partial: 'badge-warning',
  cancelled: 'badge-danger',
};

export default function OrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, search, statusFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, per_page: 15 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const response = await ordersApi.getAll(params);
      return response.data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: number) => ordersApi.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('تم تأكيد الطلب بنجاح');
      setIsConfirmOpen(false);
      setSelectedOrder(null);
    },
    onError: () => toast.error('حدث خطأ أثناء التأكيد'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => ordersApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('تم إلغاء الطلب');
      setIsCancelOpen(false);
      setSelectedOrder(null);
    },
    onError: () => toast.error('حدث خطأ أثناء الإلغاء'),
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Insert key or Alt+N: navigate to new order page
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        router.push('/dashboard/orders/new');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-DZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns = [
    { key: 'reference', title: 'المرجع' },
    {
      key: 'client',
      title: 'العميل',
      render: (item: Order) => item.client?.name || '-',
    },
    {
      key: 'seller',
      title: 'البائع',
      render: (item: Order) => item.seller?.name || '-',
    },
    {
      key: 'date',
      title: 'التاريخ',
      render: (item: Order) => formatDate(item.date),
    },
    {
      key: 'grand_total',
      title: 'المجموع',
      render: (item: Order) => formatCurrency(item.grand_total),
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (item: Order) => (
        <div className="flex items-center gap-2">
          <span className={`badge ${statusClasses[item.status]}`}>
            {statusLabels[item.status]}
          </span>
          {item.has_problem && (
            <span className="text-red-500" title={item.problem_description || 'يوجد مشكلة'}>
              <ExclamationTriangleIcon className="w-5 h-5" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      title: 'الإجراءات',
      render: (item: Order) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/orders/${item.id}`}
            className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg"
          >
            <EyeIcon className="w-4 h-4" />
          </Link>
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => {
                  setSelectedOrder(item);
                  setIsConfirmOpen(true);
                }}
                className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg"
              >
                <CheckIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setSelectedOrder(item);
                  setIsCancelOpen(true);
                }}
                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </>
          )}
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
          <h1 className="text-2xl font-bold text-gray-800">الطلبات</h1>
          <p className="text-gray-500 mt-1">إدارة طلبات العملاء</p>
        </div>
        <Link
          href="/dashboard/orders/new"
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          إنشاء طلب جديد
          <kbd className="bg-primary-600 px-1.5 py-0.5 rounded text-xs mr-1">Insert</kbd>
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-4 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select w-48"
          >
            <option value="">جميع الحالات</option>
            <option value="pending">معلق</option>
            <option value="confirmed">مؤكد</option>
            <option value="assigned">موزع</option>
            <option value="delivered">تم التسليم</option>
            <option value="partial">تسليم جزئي</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          searchable
          searchPlaceholder="بحث عن طلب..."
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
          emptyMessage="لا توجد طلبات"
        />
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => selectedOrder && confirmMutation.mutate(selectedOrder.id)}
        title="تأكيد الطلب"
        message={`هل أنت متأكد من تأكيد الطلب "${selectedOrder?.reference}"؟`}
        confirmText="تأكيد"
        isLoading={confirmMutation.isPending}
        variant="info"
      />

      <ConfirmDialog
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={() => selectedOrder && cancelMutation.mutate(selectedOrder.id)}
        title="إلغاء الطلب"
        message={`هل أنت متأكد من إلغاء الطلب "${selectedOrder?.reference}"؟`}
        confirmText="إلغاء الطلب"
        isLoading={cancelMutation.isPending}
        variant="danger"
      />
    </div>
  );
}
