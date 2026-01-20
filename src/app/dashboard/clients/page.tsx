'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientsApi, salesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  BanknotesIcon,
  UserGroupIcon,
  UserIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface Client {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gps_lat?: number;
  gps_lng?: number;
  balance: number;
  sales_debt?: number;
  delivery_debt?: number;
  combined_debt?: number;
  credit_limit?: number;
  is_active: boolean;
  rc?: string;
  nif?: string;
  ai?: string;
  nis?: string;
  rib?: string;
  created_at?: string;
  orders_count?: number;
  sales_count?: number;
}

interface ClientSale {
  id: number;
  reference: string;
  date: string;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  status: string;
  payment_status: string;
}

interface ClientDetails {
  client: Client;
  sales: ClientSale[];
  totals: {
    total_sales: number;
    total_paid: number;
    total_remaining: number;
  };
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'has_debt' | 'no_debt'>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDetails, setClientDetails] = useState<ClientDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gps_lat: '',
    gps_lng: '',
    credit_limit: '',
    is_active: true,
    rc: '',
    nif: '',
    ai: '',
    nis: '',
    rib: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        handleOpenCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchClients = async () => {
    try {
      const response = await clientsApi.getAll({ per_page: 1000 });
      setClients(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientDetails = async (clientId: number) => {
    setLoadingDetails(true);
    try {
      const [clientRes, salesDebtRes] = await Promise.all([
        clientsApi.getOne(clientId),
        clientsApi.getSalesDebt(clientId).catch(() => ({ data: { sales: [], totals: {} } }))
      ]);

      setClientDetails({
        client: clientRes.data,
        sales: salesDebtRes.data.sales || [],
        totals: salesDebtRes.data.totals || { total_sales: 0, total_paid: 0, total_remaining: 0 }
      });
    } catch (error) {
      toast.error('خطأ في تحميل تفاصيل العميل');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedClient(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      gps_lat: '',
      gps_lng: '',
      credit_limit: '',
      is_active: true,
      rc: '',
      nif: '',
      ai: '',
      nis: '',
      rib: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      gps_lat: client.gps_lat?.toString() || '',
      gps_lng: client.gps_lng?.toString() || '',
      credit_limit: client.credit_limit?.toString() || '',
      is_active: client.is_active,
      rc: client.rc || '',
      nif: client.nif || '',
      ai: client.ai || '',
      nis: client.nis || '',
      rib: client.rib || '',
    });
    setIsModalOpen(true);
  };

  const handleOpenDetails = (client: Client) => {
    setSelectedClient(client);
    setIsDetailsOpen(true);
    fetchClientDetails(client.id);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedClient(null);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedClient(null);
    setClientDetails(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const data = {
      ...formData,
      gps_lat: formData.gps_lat ? parseFloat(formData.gps_lat) : null,
      gps_lng: formData.gps_lng ? parseFloat(formData.gps_lng) : null,
      credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
    };

    try {
      if (selectedClient) {
        await clientsApi.update(selectedClient.id, data);
        toast.success('تم تحديث بيانات العميل بنجاح');
      } else {
        await clientsApi.create(data);
        toast.success('تم إضافة العميل بنجاح');
      }
      handleCloseModal();
      fetchClients();
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    try {
      await clientsApi.delete(selectedClient.id);
      toast.success('تم حذف العميل بنجاح');
      setIsDeleteOpen(false);
      setSelectedClient(null);
      fetchClients();
    } catch (error: any) {
      const message = error.response?.data?.message || 'حدث خطأ أثناء الحذف';
      toast.error(message);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-DZ');
  };

  // Statistics - use combined_debt (sales + deliveries)
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.is_active).length;
  const clientsWithDebt = clients.filter(c => (Number(c.combined_debt) || 0) > 0).length;
  const totalDebt = clients.reduce((sum, c) => {
    const debt = Number(c.combined_debt) || 0;
    return sum + (debt > 0 ? debt : 0);
  }, 0);

  // Filtered clients
  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && client.is_active) ||
      (statusFilter === 'inactive' && !client.is_active);

    const clientDebt = Number(client.combined_debt) || 0;
    const matchesBalance =
      balanceFilter === 'all' ||
      (balanceFilter === 'has_debt' && clientDebt > 0) ||
      (balanceFilter === 'no_debt' && clientDebt <= 0);

    return matchesSearch && matchesStatus && matchesBalance;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Shortcuts hint */}
      <div className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg flex items-center gap-6 text-sm">
        <span className="font-medium">اختصارات:</span>
        <span><kbd className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">Insert</kbd> إضافة عميل جديد</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">العملاء</h1>
          <p className="text-gray-500 mt-1">إدارة بيانات العملاء وحساباتهم</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/sales/debtors"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <BanknotesIcon className="w-5 h-5" />
            الديون المستحقة
          </Link>
          <button onClick={handleOpenCreate} className="btn btn-primary">
            <PlusIcon className="w-5 h-5" />
            إضافة عميل
            <kbd className="bg-blue-700 px-1.5 py-0.5 rounded text-xs mr-2">Insert</kbd>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">إجمالي العملاء</p>
              <p className="text-2xl font-bold text-blue-600">{totalClients}</p>
            </div>
          </div>
        </div>

        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">عملاء نشطون</p>
              <p className="text-2xl font-bold text-green-600">{activeClients}</p>
            </div>
          </div>
        </div>

        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">عملاء لديهم ديون</p>
              <p className="text-2xl font-bold text-orange-600">{clientsWithDebt}</p>
            </div>
          </div>
        </div>

        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <BanknotesIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">إجمالي الديون</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[250px] relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="بحث بالاسم، الهاتف، البريد، أو العنوان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-full pr-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="select min-w-[150px]"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط فقط</option>
            <option value="inactive">معطل فقط</option>
          </select>
          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as typeof balanceFilter)}
            className="select min-w-[150px]"
          >
            <option value="all">جميع الأرصدة</option>
            <option value="has_debt">لديه دين</option>
            <option value="no_debt">بدون دين</option>
          </select>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-500 mb-4">
          عرض {filteredClients.length} من {totalClients} عميل
        </div>

        {/* Clients Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">العميل</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">التواصل</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">العنوان</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">الرصيد</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">حد الائتمان</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">الحالة</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <UserGroupIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>لا يوجد عملاء مطابقين للبحث</p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 font-bold">{client.name.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{client.name}</div>
                          <div className="text-xs text-gray-500">#{client.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {client.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <PhoneIcon className="w-4 h-4" />
                            <span dir="ltr">{client.phone}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <EnvelopeIcon className="w-4 h-4" />
                            <span className="truncate max-w-[150px]">{client.email}</span>
                          </div>
                        )}
                        {!client.phone && !client.email && (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {client.address ? (
                        <div className="flex items-start gap-1 text-sm text-gray-600 max-w-[200px]">
                          <MapPinIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{client.address}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const totalDebt = Number(client.combined_debt) || 0;
                        const salesDebt = Number(client.sales_debt) || 0;
                        const deliveryDebt = Number(client.delivery_debt) || 0;
                        return (
                          <>
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                              totalDebt > 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {totalDebt > 0 && <ArrowTrendingUpIcon className="w-4 h-4" />}
                              {formatCurrency(totalDebt)}
                            </div>
                            {totalDebt > 0 && (
                              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                {salesDebt > 0 && (
                                  <div>مبيعات: {formatCurrency(salesDebt)}</div>
                                )}
                                {deliveryDebt > 0 && (
                                  <div>توصيل: {formatCurrency(deliveryDebt)}</div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {client.credit_limit ? (
                        <span className="text-gray-700">{formatCurrency(client.credit_limit)}</span>
                      ) : (
                        <span className="text-gray-400">غير محدد</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        client.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {client.is_active ? (
                          <>
                            <CheckCircleIcon className="w-3 h-3" />
                            نشط
                          </>
                        ) : (
                          <>
                            <XMarkIcon className="w-3 h-3" />
                            معطل
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenDetails(client)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                          title="عرض التفاصيل"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(client)}
                          className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setIsDeleteOpen(true);
                          }}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">
                {selectedClient ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
              </h3>
              <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اسم العميل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="input w-full"
                  required
                  placeholder="أدخل اسم العميل"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                  <div className="relative">
                    <PhoneIcon className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                      className="input w-full pr-10"
                      placeholder="0xxx xxx xxx"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                  <div className="relative">
                    <EnvelopeIcon className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                      className="input w-full pr-10"
                      placeholder="example@email.com"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                <div className="relative">
                  <MapPinIcon className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
                    className="input w-full pr-10"
                    rows={2}
                    placeholder="أدخل عنوان العميل"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">خط العرض (GPS)</label>
                  <input
                    type="number"
                    value={formData.gps_lat}
                    onChange={(e) => setFormData(p => ({ ...p, gps_lat: e.target.value }))}
                    className="input w-full"
                    step="any"
                    placeholder="مثال: 34.8449"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">خط الطول (GPS)</label>
                  <input
                    type="number"
                    value={formData.gps_lng}
                    onChange={(e) => setFormData(p => ({ ...p, gps_lng: e.target.value }))}
                    className="input w-full"
                    step="any"
                    placeholder="مثال: 5.7248"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">حد الائتمان</label>
                <div className="relative">
                  <BanknotesIcon className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData(p => ({ ...p, credit_limit: e.target.value }))}
                    className="input w-full pr-10"
                    min="0"
                    placeholder="الحد الأقصى للدين المسموح"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">اتركه فارغاً لعدم تحديد حد</p>
              </div>

              {/* Legal Information */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-700 mb-3">المعلومات القانونية</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        RC (السجل التجاري)
                      </label>
                      <input
                        type="text"
                        value={formData.rc}
                        onChange={(e) => setFormData(p => ({ ...p, rc: e.target.value }))}
                        className="input w-full"
                        dir="ltr"
                        placeholder="00/00-0000000B00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        NIF (الرقم الجبائي)
                      </label>
                      <input
                        type="text"
                        value={formData.nif}
                        onChange={(e) => setFormData(p => ({ ...p, nif: e.target.value }))}
                        className="input w-full"
                        dir="ltr"
                        placeholder="000000000000000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        AI (رقم المادة)
                      </label>
                      <input
                        type="text"
                        value={formData.ai}
                        onChange={(e) => setFormData(p => ({ ...p, ai: e.target.value }))}
                        className="input w-full"
                        dir="ltr"
                        placeholder="00000000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        NIS (رقم الإحصاء)
                      </label>
                      <input
                        type="text"
                        value={formData.nis}
                        onChange={(e) => setFormData(p => ({ ...p, nis: e.target.value }))}
                        className="input w-full"
                        dir="ltr"
                        placeholder="000000000000000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RIB (رقم الحساب البنكي)
                    </label>
                    <input
                      type="text"
                      value={formData.rib}
                      onChange={(e) => setFormData(p => ({ ...p, rib: e.target.value }))}
                      className="input w-full"
                      dir="ltr"
                      placeholder="00000 00000 00000000000 00"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <div>
                    <span className="font-medium text-gray-700">عميل نشط</span>
                    <p className="text-xs text-gray-500">العميل غير النشط لن يظهر في قوائم الاختيار</p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
                  إلغاء
                </button>
                <button type="submit" disabled={isSaving} className="btn btn-primary">
                  {isSaving ? (
                    <>
                      <span className="spinner w-4 h-4"></span>
                      جاري الحفظ...
                    </>
                  ) : selectedClient ? (
                    'تحديث البيانات'
                  ) : (
                    'إضافة العميل'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Details Modal */}
      {isDetailsOpen && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xl font-bold text-blue-600">{selectedClient.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedClient.name}</h3>
                  <p className="text-sm text-gray-500">تفاصيل العميل والمعاملات</p>
                </div>
              </div>
              <button onClick={handleCloseDetails} className="p-2 hover:bg-gray-200 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="spinner"></div>
                </div>
              ) : clientDetails ? (
                <div className="space-y-6">
                  {/* Client Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="card">
                      <h4 className="font-bold mb-3 flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-blue-600" />
                        معلومات العميل
                      </h4>
                      <div className="space-y-2 text-sm">
                        {selectedClient.phone && (
                          <div className="flex items-center gap-2">
                            <PhoneIcon className="w-4 h-4 text-gray-400" />
                            <span dir="ltr">{selectedClient.phone}</span>
                          </div>
                        )}
                        {selectedClient.email && (
                          <div className="flex items-center gap-2">
                            <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                            <span>{selectedClient.email}</span>
                          </div>
                        )}
                        {selectedClient.address && (
                          <div className="flex items-start gap-2">
                            <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                            <span>{selectedClient.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-gray-500">الحالة:</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            selectedClient.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {selectedClient.is_active ? 'نشط' : 'معطل'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="card bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
                      <h4 className="font-bold mb-3 flex items-center gap-2">
                        <BanknotesIcon className="w-5 h-5 text-orange-600" />
                        الحالة المالية
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">إجمالي الدين:</span>
                          <span className={`text-xl font-bold ${
                            (Number(selectedClient.combined_debt) || 0) > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {formatCurrency(Number(selectedClient.combined_debt) || 0)}
                          </span>
                        </div>
                        {(Number(selectedClient.combined_debt) || 0) > 0 && (
                          <>
                            {(Number(selectedClient.sales_debt) || 0) > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">دين المبيعات:</span>
                                <span className="text-red-500">{formatCurrency(Number(selectedClient.sales_debt) || 0)}</span>
                              </div>
                            )}
                            {(Number(selectedClient.delivery_debt) || 0) > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">دين التوصيل:</span>
                                <span className="text-orange-500">{formatCurrency(Number(selectedClient.delivery_debt) || 0)}</span>
                              </div>
                            )}
                          </>
                        )}
                        {selectedClient.credit_limit && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">حد الائتمان:</span>
                            <span className="font-medium">{formatCurrency(selectedClient.credit_limit)}</span>
                          </div>
                        )}
                        {clientDetails.totals && (
                          <>
                            <hr />
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">إجمالي المبيعات:</span>
                              <span>{formatCurrency(clientDetails.totals.total_sales || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">إجمالي المدفوع:</span>
                              <span className="text-green-600">{formatCurrency(clientDetails.totals.total_paid || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">إجمالي المتبقي:</span>
                              <span className="text-red-600">{formatCurrency(clientDetails.totals.total_remaining || 0)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unpaid Sales */}
                  {clientDetails.sales && clientDetails.sales.length > 0 && (
                    <div className="card">
                      <h4 className="font-bold mb-3 flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5 text-purple-600" />
                        الفواتير غير المسددة ({clientDetails.sales.length})
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-right">المرجع</th>
                              <th className="px-3 py-2 text-right">التاريخ</th>
                              <th className="px-3 py-2 text-center">المبلغ</th>
                              <th className="px-3 py-2 text-center">المدفوع</th>
                              <th className="px-3 py-2 text-center">المتبقي</th>
                              <th className="px-3 py-2 text-center">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {clientDetails.sales.map((sale) => (
                              <tr key={sale.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2">
                                  <Link
                                    href={`/dashboard/sales/${sale.id}`}
                                    className="text-blue-600 hover:underline"
                                  >
                                    {sale.reference}
                                  </Link>
                                </td>
                                <td className="px-3 py-2">{formatDate(sale.date)}</td>
                                <td className="px-3 py-2 text-center">{formatCurrency(sale.grand_total)}</td>
                                <td className="px-3 py-2 text-center text-green-600">{formatCurrency(sale.paid_amount)}</td>
                                <td className="px-3 py-2 text-center text-red-600 font-medium">{formatCurrency(sale.due_amount)}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                                    sale.payment_status === 'paid'
                                      ? 'bg-green-100 text-green-700'
                                      : sale.payment_status === 'partial'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                  }`}>
                                    {sale.payment_status === 'paid' ? 'مدفوع' : sale.payment_status === 'partial' ? 'جزئي' : 'غير مدفوع'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/dashboard/sales/new?client_id=${selectedClient.id}`}
                      className="btn btn-primary"
                    >
                      <DocumentTextIcon className="w-5 h-5" />
                      فاتورة بيع جديدة
                    </Link>
                    <button
                      onClick={() => {
                        handleCloseDetails();
                        handleOpenEdit(selectedClient);
                      }}
                      className="btn btn-secondary"
                    >
                      <PencilIcon className="w-5 h-5" />
                      تعديل البيانات
                    </button>
                    {(Number(selectedClient.combined_debt) || 0) > 0 && (
                      <Link
                        href="/dashboard/sales/debtors"
                        className="btn bg-amber-500 text-white hover:bg-amber-600"
                      >
                        <CurrencyDollarIcon className="w-5 h-5" />
                        تحصيل دين
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  لا توجد بيانات
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {isDeleteOpen && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <TrashIcon className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold mb-2">حذف العميل</h3>
              <p className="text-gray-600 mb-6">
                هل أنت متأكد من حذف العميل "{selectedClient.name}"؟
                <br />
                <span className="text-sm text-red-600">هذا الإجراء لا يمكن التراجع عنه</span>
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setIsDeleteOpen(false)}
                  className="btn btn-secondary"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDelete}
                  className="btn bg-red-600 text-white hover:bg-red-700"
                >
                  نعم، حذف العميل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
