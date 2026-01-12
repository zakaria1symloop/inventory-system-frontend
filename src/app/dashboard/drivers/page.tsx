'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

interface Driver {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function DriversPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [passwordData, setPasswordData] = useState({
    password: '',
    password_confirmation: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, search],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, per_page: 15, role: 'livreur' };
      if (search) params.search = search;
      const response = await usersApi.getAll(params);
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create({ ...data, role: 'livreur' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('تم إضافة السائق بنجاح');
      closeModal();
    },
    onError: () => toast.error('حدث خطأ أثناء الإضافة'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('تم تحديث بيانات السائق');
      closeModal();
    },
    onError: () => toast.error('حدث خطأ أثناء التحديث'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('تم حذف السائق');
      setIsDeleteOpen(false);
      setSelectedDriver(null);
    },
    onError: () => toast.error('حدث خطأ أثناء الحذف'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: number) => usersApi.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('تم تحديث حالة السائق');
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { password: string; password_confirmation: string } }) =>
      usersApi.resetPassword(id, data),
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور');
      setIsPasswordModalOpen(false);
      setSelectedDriver(null);
      setPasswordData({ password: '', password_confirmation: '' });
    },
    onError: () => toast.error('حدث خطأ أثناء تغيير كلمة المرور'),
  });

  const openModal = (driver?: Driver) => {
    if (driver) {
      setSelectedDriver(driver);
      setFormData({
        name: driver.name,
        email: driver.email,
        phone: driver.phone || '',
        password: '',
      });
    } else {
      setSelectedDriver(null);
      setFormData({ name: '', email: '', phone: '', password: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDriver(null);
    setFormData({ name: '', email: '', phone: '', password: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDriver) {
      const updateData: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
      };
      updateMutation.mutate({ id: selectedDriver.id, data: updateData });
    } else {
      if (!formData.password) {
        toast.error('كلمة المرور مطلوبة');
        return;
      }
      createMutation.mutate(formData);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.password_confirmation) {
      toast.error('كلمة المرور غير متطابقة');
      return;
    }
    if (passwordData.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (selectedDriver) {
      resetPasswordMutation.mutate({ id: selectedDriver.id, data: passwordData });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-DZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Insert key or Alt+N: open add modal
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        openModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const columns = [
    { key: 'name', title: 'الاسم' },
    { key: 'email', title: 'البريد الإلكتروني' },
    { key: 'phone', title: 'الهاتف', render: (item: Driver) => item.phone || '-' },
    {
      key: 'is_active',
      title: 'الحالة',
      render: (item: Driver) => (
        <button
          onClick={() => toggleActiveMutation.mutate(item.id)}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            item.is_active
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-red-100 text-red-700 hover:bg-red-200'
          }`}
        >
          {item.is_active ? (
            <>
              <CheckCircleIcon className="w-4 h-4" />
              نشط
            </>
          ) : (
            <>
              <XCircleIcon className="w-4 h-4" />
              معطل
            </>
          )}
        </button>
      ),
    },
    {
      key: 'created_at',
      title: 'تاريخ الإضافة',
      render: (item: Driver) => formatDate(item.created_at),
    },
    {
      key: 'actions',
      title: 'الإجراءات',
      render: (item: Driver) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openModal(item)}
            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"
            title="تعديل"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedDriver(item);
              setIsPasswordModalOpen(true);
            }}
            className="p-1.5 hover:bg-yellow-50 text-yellow-600 rounded-lg"
            title="تغيير كلمة المرور"
          >
            <KeyIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedDriver(item);
              setIsDeleteOpen(true);
            }}
            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg"
            title="حذف"
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
        <span><kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">Insert</kbd> اضافة جديد</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">السائقين</h1>
          <p className="text-gray-500 mt-1">إدارة سائقي التوصيل</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          إضافة سائق
          <kbd className="bg-primary-600 px-1.5 py-0.5 rounded text-xs mr-1">Insert</kbd>
        </button>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          searchable
          searchPlaceholder="بحث عن سائق..."
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
          emptyMessage="لا يوجد سائقين"
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedDriver ? 'تعديل بيانات السائق' : 'إضافة سائق جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الاسم <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              البريد الإلكتروني <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              required
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الهاتف</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              dir="ltr"
            />
          </div>
          {!selectedDriver && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                كلمة المرور <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
                required
                minLength={6}
                dir="ltr"
              />
              <p className="text-xs text-gray-500 mt-1">6 أحرف على الأقل</p>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn btn-primary flex-1"
            >
              {createMutation.isPending || updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setSelectedDriver(null);
          setPasswordData({ password: '', password_confirmation: '' });
        }}
        title="تغيير كلمة المرور"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <p className="text-gray-600 mb-4">
            تغيير كلمة المرور للسائق: <strong>{selectedDriver?.name}</strong>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              كلمة المرور الجديدة <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={passwordData.password}
              onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
              className="input"
              required
              minLength={6}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تأكيد كلمة المرور <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={passwordData.password_confirmation}
              onChange={(e) =>
                setPasswordData({ ...passwordData, password_confirmation: e.target.value })
              }
              className="input"
              required
              minLength={6}
              dir="ltr"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className="btn btn-primary flex-1"
            >
              {resetPasswordMutation.isPending ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPasswordModalOpen(false);
                setSelectedDriver(null);
                setPasswordData({ password: '', password_confirmation: '' });
              }}
              className="btn btn-secondary flex-1"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setSelectedDriver(null);
        }}
        onConfirm={() => selectedDriver && deleteMutation.mutate(selectedDriver.id)}
        title="حذف السائق"
        message={`هل أنت متأكد من حذف السائق "${selectedDriver?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        isLoading={deleteMutation.isPending}
        variant="danger"
      />
    </div>
  );
}
