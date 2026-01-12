'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { PlusIcon, PencilIcon, TrashIcon, KeyIcon } from '@heroicons/react/24/outline';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import type { User } from '@/lib/types';

const roleLabels: Record<string, string> = {
  admin: 'مدير',
  manager: 'مسؤول',
  seller: 'بائع',
  livreur: 'سائق توصيل',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'seller',
    is_active: true,
  });
  const [passwordData, setPasswordData] = useState({
    password: '',
    password_confirmation: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter],
    queryFn: async () => {
      const response = await usersApi.getAll({ page, search, role: roleFilter, per_page: 15 });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('تم إضافة المستخدم بنجاح');
      handleCloseModal();
    },
    onError: () => toast.error('حدث خطأ أثناء الإضافة'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('تم تحديث بيانات المستخدم بنجاح');
      handleCloseModal();
    },
    onError: () => toast.error('حدث خطأ أثناء التحديث'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('تم حذف المستخدم بنجاح');
      setIsDeleteOpen(false);
      setSelectedUser(null);
    },
    onError: () => toast.error('حدث خطأ أثناء الحذف'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { password: string; password_confirmation: string } }) =>
      usersApi.resetPassword(id, data),
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح');
      setIsPasswordOpen(false);
      setSelectedUser(null);
      setPasswordData({ password: '', password_confirmation: '' });
    },
    onError: () => toast.error('حدث خطأ أثناء تغيير كلمة المرور'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: number) => usersApi.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('تم تحديث حالة المستخدم');
    },
    onError: () => toast.error('حدث خطأ'),
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Insert key or Alt+N: open add modal
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        handleOpenCreate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'seller',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      phone: user.phone || '',
      role: user.role,
      is_active: user.is_active,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      role: formData.role,
      is_active: formData.is_active,
    };

    if (!selectedUser) {
      data.password = formData.password;
    }

    if (selectedUser) {
      updateMutation.mutate({ id: selectedUser.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      resetPasswordMutation.mutate({ id: selectedUser.id, data: passwordData });
    }
  };

  const columns = [
    { key: 'name', title: 'الاسم' },
    { key: 'email', title: 'البريد الإلكتروني' },
    { key: 'phone', title: 'الهاتف', render: (item: User) => item.phone || '-' },
    {
      key: 'role',
      title: 'الدور',
      render: (item: User) => (
        <span className="badge badge-info">{roleLabels[item.role]}</span>
      ),
    },
    {
      key: 'is_active',
      title: 'الحالة',
      render: (item: User) => (
        <button
          onClick={() => toggleActiveMutation.mutate(item.id)}
          className={`badge cursor-pointer ${item.is_active ? 'badge-success' : 'badge-danger'}`}
        >
          {item.is_active ? 'نشط' : 'معطل'}
        </button>
      ),
    },
    {
      key: 'actions',
      title: 'الإجراءات',
      render: (item: User) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedUser(item);
              setIsPasswordOpen(true);
            }}
            className="p-1.5 hover:bg-yellow-50 text-yellow-600 rounded-lg"
          >
            <KeyIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenEdit(item)}
            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedUser(item);
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
          <h1 className="text-2xl font-bold text-gray-800">المستخدمين</h1>
          <p className="text-gray-500 mt-1">إدارة مستخدمي النظام</p>
        </div>
        <button onClick={handleOpenCreate} className="btn btn-primary">
          <PlusIcon className="w-5 h-5" />
          إضافة مستخدم
          <kbd className="bg-blue-700 text-white px-1.5 py-0.5 rounded text-xs mr-2">Insert</kbd>
        </button>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-4 mb-4">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="select w-48"
          >
            <option value="">جميع الأدوار</option>
            <option value="admin">مدير</option>
            <option value="manager">مسؤول</option>
            <option value="seller">بائع</option>
            <option value="livreur">سائق توصيل</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          searchable
          searchPlaceholder="بحث عن مستخدم..."
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
          emptyMessage="لا يوجد مستخدمين"
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              className="input"
              required
            />
          </div>

          {!selectedUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                className="input"
                required
                minLength={6}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الهاتف</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
              className="select"
              required
            >
              <option value="admin">مدير</option>
              <option value="manager">مسؤول</option>
              <option value="seller">بائع</option>
              <option value="livreur">سائق توصيل</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">مستخدم نشط</span>
            </label>
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
              ) : selectedUser ? (
                'تحديث'
              ) : (
                'إضافة'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isPasswordOpen}
        onClose={() => {
          setIsPasswordOpen(false);
          setPasswordData({ password: '', password_confirmation: '' });
        }}
        title={`تغيير كلمة المرور - ${selectedUser?.name}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
            <input
              type="password"
              value={passwordData.password}
              onChange={(e) => setPasswordData((p) => ({ ...p, password: e.target.value }))}
              className="input"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">تأكيد كلمة المرور</label>
            <input
              type="password"
              value={passwordData.password_confirmation}
              onChange={(e) => setPasswordData((p) => ({ ...p, password_confirmation: e.target.value }))}
              className="input"
              required
              minLength={6}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsPasswordOpen(false);
                setPasswordData({ password: '', password_confirmation: '' });
              }}
              className="btn btn-secondary"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className="btn btn-primary"
            >
              {resetPasswordMutation.isPending ? (
                <span className="spinner w-4 h-4"></span>
              ) : (
                'تغيير'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => selectedUser && deleteMutation.mutate(selectedUser.id)}
        title="حذف المستخدم"
        message={`هل أنت متأكد من حذف "${selectedUser?.name}"؟`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
