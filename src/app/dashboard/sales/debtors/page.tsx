'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { allDebtorsApi, deliveriesApi, salesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BanknotesIcon,
  PhoneIcon,
  MapPinIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CurrencyDollarIcon,
  CheckIcon,
  DocumentTextIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

interface Debtor {
  client_id: number;
  client_name: string;
  client_phone: string;
  client_address: string;
  // Sales debt
  sales_total_due: number;
  sales_total_paid: number;
  sales_total_remaining: number;
  sales_count: number;
  // Delivery debt
  delivery_total_due: number;
  delivery_total_collected: number;
  delivery_total_remaining: number;
  delivery_count: number;
  // Combined
  total_remaining: number;
  total_orders: number;
  client_balance: number;
  has_sales_debt: boolean;
  has_delivery_debt: boolean;
}

interface DebtorsTotals {
  total_debtors: number;
  sales_total_remaining: number;
  delivery_total_remaining: number;
  total_remaining: number;
}

interface SaleDebt {
  id: number;
  type: 'sale';
  reference: string;
  warehouse_name: string;
  date: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  days_old: number | null;
}

interface DeliveryDebt {
  id: number;
  type: 'delivery';
  delivery_id: number;
  delivery_reference: string;
  order_id: number;
  reference: string;
  livreur_name: string;
  date: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  days_old: number | null;
}

interface ClientDebtDetails {
  client: {
    id: number;
    name: string;
    phone: string;
    address: string;
    balance: number;
  } | null;
  sales: SaleDebt[];
  deliveries: DeliveryDebt[];
  totals: {
    sales_total_due: number;
    sales_total_paid: number;
    sales_total_remaining: number;
    delivery_total_due: number;
    delivery_total_paid: number;
    delivery_total_remaining: number;
    total_remaining: number;
  };
}

export default function DebtorsPage() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [totals, setTotals] = useState<DebtorsTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debtTypeFilter, setDebtTypeFilter] = useState<'all' | 'sales' | 'delivery'>('all');
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [clientDebt, setClientDebt] = useState<ClientDebtDetails | null>(null);
  const [loadingClientDebt, setLoadingClientDebt] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaleDebt | DeliveryDebt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  useEffect(() => {
    fetchDebtors();
  }, []);

  const fetchDebtors = async () => {
    try {
      const response = await allDebtorsApi.getAll();
      setDebtors(response.data.data || []);
      setTotals(response.data.totals);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientDebt = async (clientId: number) => {
    setLoadingClientDebt(true);
    try {
      const response = await allDebtorsApi.getClientDebt(clientId);
      setClientDebt(response.data);
    } catch (error) {
      toast.error('خطأ في تحميل تفاصيل الديون');
    } finally {
      setLoadingClientDebt(false);
    }
  };

  const toggleExpand = (clientId: number) => {
    if (expandedClient === clientId) {
      setExpandedClient(null);
      setClientDebt(null);
    } else {
      setExpandedClient(clientId);
      fetchClientDebt(clientId);
    }
  };

  const openPaymentModal = (item: SaleDebt | DeliveryDebt) => {
    setSelectedItem(item);
    setPaymentAmount(item.amount_remaining.toString());
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (amount > selectedItem.amount_remaining) {
      toast.error('المبلغ أكبر من المتبقي');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      if (selectedItem.type === 'delivery') {
        const deliveryItem = selectedItem as DeliveryDebt;
        await deliveriesApi.collectPayment(deliveryItem.delivery_id, deliveryItem.id, {
          amount,
          notes: paymentNotes,
        });
      } else {
        // Sale payment
        await salesApi.addPayment(selectedItem.id, {
          amount,
          payment_method: 'cash',
          date: new Date().toISOString().split('T')[0],
          notes: paymentNotes,
        });
      }
      toast.success('تم تسجيل الدفعة بنجاح');
      setShowPaymentModal(false);

      // Refresh data
      fetchDebtors();
      if (expandedClient) {
        fetchClientDebt(expandedClient);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في تسجيل الدفعة';
      toast.error(message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handlePayFull = async (item: SaleDebt | DeliveryDebt) => {
    if (!confirm(`هل تريد تسجيل دفعة كاملة بمبلغ ${formatCurrency(item.amount_remaining)}؟`)) return;

    try {
      if (item.type === 'delivery') {
        const deliveryItem = item as DeliveryDebt;
        await deliveriesApi.collectPayment(deliveryItem.delivery_id, deliveryItem.id, {
          amount: item.amount_remaining,
          notes: 'دفعة كاملة',
        });
      } else {
        await salesApi.addPayment(item.id, {
          amount: item.amount_remaining,
          payment_method: 'cash',
          date: new Date().toISOString().split('T')[0],
          notes: 'دفعة كاملة',
        });
      }
      toast.success('تم تسجيل الدفعة بنجاح');

      // Refresh data
      fetchDebtors();
      if (expandedClient) {
        fetchClientDebt(expandedClient);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في تسجيل الدفعة';
      toast.error(message);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-DZ');
  };

  const filteredDebtors = debtors.filter(d => {
    const matchesSearch = d.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.client_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.client_address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = debtTypeFilter === 'all' ||
      (debtTypeFilter === 'sales' && d.has_sales_debt) ||
      (debtTypeFilter === 'delivery' && d.has_delivery_debt);

    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الديون المستحقة</h1>
          <p className="text-gray-600 mt-1">جميع العملاء الذين لديهم مبالغ مستحقة (مبيعات + توصيل)</p>
        </div>
        <Link
          href="/dashboard/sales"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          العودة للمبيعات
        </Link>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">عدد المدينين</p>
                <p className="text-2xl font-bold text-blue-600">{totals.total_debtors}</p>
              </div>
            </div>
          </div>

          <div className="card bg-purple-50 border-purple-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <DocumentTextIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">ديون المبيعات</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(totals.sales_total_remaining)}</p>
              </div>
            </div>
          </div>

          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <TruckIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">ديون التوصيل</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totals.delivery_total_remaining)}</p>
              </div>
            </div>
          </div>

          <div className="card bg-red-50 border-red-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <BanknotesIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">إجمالي المتبقي</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.total_remaining)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف أو العنوان..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-1"
          />
          <select
            value={debtTypeFilter}
            onChange={(e) => setDebtTypeFilter(e.target.value as 'all' | 'sales' | 'delivery')}
            className="select max-w-xs"
          >
            <option value="all">جميع الديون</option>
            <option value="sales">ديون المبيعات فقط</option>
            <option value="delivery">ديون التوصيل فقط</option>
          </select>
        </div>

        {filteredDebtors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BanknotesIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">لا يوجد عملاء لديهم ديون مستحقة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDebtors.map((debtor) => (
              <div key={debtor.client_id} className="border rounded-lg overflow-hidden">
                {/* Debtor Header */}
                <div
                  className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleExpand(debtor.client_id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-lg font-bold text-blue-600">
                        {debtor.client_name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{debtor.client_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {debtor.client_phone && (
                          <span className="flex items-center gap-1">
                            <PhoneIcon className="w-4 h-4" />
                            {debtor.client_phone}
                          </span>
                        )}
                        {debtor.client_address && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="w-4 h-4" />
                            {debtor.client_address}
                          </span>
                        )}
                      </div>
                      {/* Debt type badges */}
                      <div className="flex gap-2 mt-1">
                        {debtor.has_sales_debt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                            <DocumentTextIcon className="w-3 h-3" />
                            مبيعات ({debtor.sales_count})
                          </span>
                        )}
                        {debtor.has_delivery_debt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                            <TruckIcon className="w-3 h-3" />
                            توصيل ({debtor.delivery_count})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {debtor.has_sales_debt && (
                      <div className="text-center">
                        <p className="text-sm text-gray-600">ديون المبيعات</p>
                        <p className="font-bold text-purple-600">{formatCurrency(debtor.sales_total_remaining)}</p>
                      </div>
                    )}
                    {debtor.has_delivery_debt && (
                      <div className="text-center">
                        <p className="text-sm text-gray-600">ديون التوصيل</p>
                        <p className="font-bold text-yellow-600">{formatCurrency(debtor.delivery_total_remaining)}</p>
                      </div>
                    )}
                    <div className="text-center border-r pr-4">
                      <p className="text-sm text-gray-600">إجمالي المتبقي</p>
                      <p className="font-bold text-red-600">{formatCurrency(debtor.total_remaining)}</p>
                    </div>
                    {expandedClient === debtor.client_id ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedClient === debtor.client_id && (
                  <div className="p-4 border-t bg-white">
                    {loadingClientDebt ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="spinner"></div>
                      </div>
                    ) : clientDebt ? (
                      <div className="space-y-6">
                        {/* Sales Debts */}
                        {clientDebt.sales.length > 0 && (
                          <div>
                            <h4 className="font-bold mb-3 flex items-center gap-2 text-purple-700">
                              <DocumentTextIcon className="w-5 h-5" />
                              فواتير المبيعات غير المدفوعة ({clientDebt.sales.length})
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-purple-50">
                                  <tr>
                                    <th className="whitespace-nowrap px-2 text-right">المرجع</th>
                                    <th className="whitespace-nowrap px-2 text-right">المستودع</th>
                                    <th className="whitespace-nowrap px-2 text-right">التاريخ</th>
                                    <th className="whitespace-nowrap px-2 text-right">المستحق</th>
                                    <th className="whitespace-nowrap px-2 text-right">المدفوع</th>
                                    <th className="whitespace-nowrap px-2 text-right">المتبقي</th>
                                    <th className="whitespace-nowrap px-2 text-right">العمر</th>
                                    <th className="whitespace-nowrap px-2 text-center">الإجراءات</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {clientDebt.sales.map((sale) => (
                                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                                      <td className="px-2 py-2 whitespace-nowrap">
                                        <Link
                                          href={`/dashboard/sales/${sale.id}`}
                                          className="text-blue-600 hover:text-blue-800 hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {sale.reference}
                                        </Link>
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap">{sale.warehouse_name || '-'}</td>
                                      <td className="px-2 py-2 whitespace-nowrap">{formatDate(sale.date)}</td>
                                      <td className="px-2 py-2 whitespace-nowrap">{formatCurrency(sale.amount_due)}</td>
                                      <td className="px-2 py-2 whitespace-nowrap text-green-600">{formatCurrency(sale.amount_paid)}</td>
                                      <td className="px-2 py-2 whitespace-nowrap text-red-600 font-bold">{formatCurrency(sale.amount_remaining)}</td>
                                      <td className="px-2 py-2 whitespace-nowrap text-gray-500">
                                        {sale.days_old !== null ? `${sale.days_old} يوم` : '-'}
                                      </td>
                                      <td className="px-2 py-2">
                                        <div className="flex gap-1 justify-center">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openPaymentModal(sale);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                            title="تحصيل جزئي"
                                          >
                                            <CurrencyDollarIcon className="w-3.5 h-3.5" />
                                            جزئي
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handlePayFull(sale);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                                            title="دفع كامل"
                                          >
                                            <CheckIcon className="w-3.5 h-3.5" />
                                            كامل
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-purple-50 font-bold">
                                  <tr>
                                    <td colSpan={3} className="px-2 py-2">إجمالي المبيعات</td>
                                    <td className="px-2 py-2">{formatCurrency(clientDebt.totals.sales_total_due)}</td>
                                    <td className="px-2 py-2 text-green-600">{formatCurrency(clientDebt.totals.sales_total_paid)}</td>
                                    <td className="px-2 py-2 text-red-600">{formatCurrency(clientDebt.totals.sales_total_remaining)}</td>
                                    <td colSpan={2}></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Delivery Debts */}
                        {clientDebt.deliveries.length > 0 && (
                          <div>
                            <h4 className="font-bold mb-3 flex items-center gap-2 text-yellow-700">
                              <TruckIcon className="w-5 h-5" />
                              طلبات التوصيل غير المدفوعة ({clientDebt.deliveries.length})
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-yellow-50">
                                  <tr>
                                    <th className="whitespace-nowrap px-2 text-right">التوصيل</th>
                                    <th className="whitespace-nowrap px-2 text-right">الطلب</th>
                                    <th className="whitespace-nowrap px-2 text-right">السائق</th>
                                    <th className="whitespace-nowrap px-2 text-right">التاريخ</th>
                                    <th className="whitespace-nowrap px-2 text-right">المستحق</th>
                                    <th className="whitespace-nowrap px-2 text-right">المحصل</th>
                                    <th className="whitespace-nowrap px-2 text-right">المتبقي</th>
                                    <th className="whitespace-nowrap px-2 text-center">الإجراءات</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {clientDebt.deliveries.map((delivery) => (
                                    <tr key={delivery.id} className="border-b hover:bg-gray-50">
                                      <td className="px-2 py-2 whitespace-nowrap">
                                        <Link
                                          href={`/dashboard/deliveries/${delivery.delivery_id}`}
                                          className="text-blue-600 hover:text-blue-800 hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {delivery.delivery_reference}
                                        </Link>
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap">
                                        <Link
                                          href={`/dashboard/orders/${delivery.order_id}`}
                                          className="text-blue-600 hover:text-blue-800 hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {delivery.reference}
                                        </Link>
                                      </td>
                                      <td className="px-2 py-2 whitespace-nowrap">{delivery.livreur_name || '-'}</td>
                                      <td className="px-2 py-2 whitespace-nowrap">{formatDate(delivery.date)}</td>
                                      <td className="px-2 py-2 whitespace-nowrap">{formatCurrency(delivery.amount_due)}</td>
                                      <td className="px-2 py-2 whitespace-nowrap text-green-600">{formatCurrency(delivery.amount_paid)}</td>
                                      <td className="px-2 py-2 whitespace-nowrap text-red-600 font-bold">{formatCurrency(delivery.amount_remaining)}</td>
                                      <td className="px-2 py-2">
                                        <div className="flex gap-1 justify-center">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openPaymentModal(delivery);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                            title="تحصيل جزئي"
                                          >
                                            <CurrencyDollarIcon className="w-3.5 h-3.5" />
                                            جزئي
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handlePayFull(delivery);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                                            title="دفع كامل"
                                          >
                                            <CheckIcon className="w-3.5 h-3.5" />
                                            كامل
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-yellow-50 font-bold">
                                  <tr>
                                    <td colSpan={4} className="px-2 py-2">إجمالي التوصيل</td>
                                    <td className="px-2 py-2">{formatCurrency(clientDebt.totals.delivery_total_due)}</td>
                                    <td className="px-2 py-2 text-green-600">{formatCurrency(clientDebt.totals.delivery_total_paid)}</td>
                                    <td className="px-2 py-2 text-red-600">{formatCurrency(clientDebt.totals.delivery_total_remaining)}</td>
                                    <td></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Grand Total */}
                        <div className="bg-gray-100 rounded-lg p-4 flex justify-between items-center">
                          <span className="font-bold text-lg">إجمالي جميع الديون</span>
                          <span className="font-bold text-2xl text-red-600">{formatCurrency(clientDebt.totals.total_remaining)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <CurrencyDollarIcon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold">تحصيل دفعة</h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-5 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">النوع</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                  selectedItem.type === 'sale'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {selectedItem.type === 'sale' ? (
                    <>
                      <DocumentTextIcon className="w-3 h-3" />
                      فاتورة مبيعات
                    </>
                  ) : (
                    <>
                      <TruckIcon className="w-3 h-3" />
                      طلب توصيل
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">المرجع</span>
                <span className="font-medium">{selectedItem.reference}</span>
              </div>
              {selectedItem.type === 'delivery' && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">التوصيل</span>
                  <span className="font-medium">{(selectedItem as DeliveryDebt).delivery_reference}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">المتبقي</span>
                <span className="text-lg font-bold text-red-600">{formatCurrency(selectedItem.amount_remaining)}</span>
              </div>
            </div>

            <form onSubmit={handlePayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">المبلغ</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-4 py-3 text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                    min="0.01"
                    max={selectedItem.amount_remaining}
                    placeholder="0.00"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">د.ج</span>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات (اختياري)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  rows={2}
                  placeholder="أضف ملاحظة..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckIcon className="w-5 h-5" />
                  {isSubmittingPayment ? 'جاري الحفظ...' : 'تأكيد الدفعة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
