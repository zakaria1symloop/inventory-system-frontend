'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { creditorsApi, purchasesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BanknotesIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CurrencyDollarIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface Creditor {
  supplier_id: number;
  supplier_name: string;
  supplier_phone: string;
  supplier_company: string;
  supplier_address: string;
  total_due: number;
  total_paid: number;
  total_remaining: number;
  total_purchases: number;
  supplier_balance: number;
}

interface CreditorsTotals {
  total_creditors: number;
  total_due: number;
  total_paid: number;
  total_remaining: number;
}

interface DebtPurchase {
  id: number;
  reference: string;
  warehouse_name: string;
  date: string;
  status: string;
  payment_status: string;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  days_old: number | null;
}

interface SupplierDebtDetails {
  supplier: {
    id: number;
    name: string;
    phone: string;
    company_name: string;
    address: string;
    balance: number;
  } | null;
  purchases: DebtPurchase[];
  totals: {
    total_due: number;
    total_paid: number;
    total_remaining: number;
  };
}

export default function CreditorsPage() {
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [totals, setTotals] = useState<CreditorsTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null);
  const [supplierDebt, setSupplierDebt] = useState<SupplierDebtDetails | null>(null);
  const [loadingSupplierDebt, setLoadingSupplierDebt] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<DebtPurchase | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  useEffect(() => {
    fetchCreditors();
  }, []);

  const fetchCreditors = async () => {
    try {
      const response = await creditorsApi.getAll();
      setCreditors(response.data.data || []);
      setTotals(response.data.totals);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSupplierDebt = async (supplierId: number) => {
    setLoadingSupplierDebt(true);
    try {
      const response = await creditorsApi.getSupplierDebt(supplierId);
      setSupplierDebt(response.data);
    } catch (error) {
      toast.error('خطأ في تحميل تفاصيل الديون');
    } finally {
      setLoadingSupplierDebt(false);
    }
  };

  const toggleExpand = (supplierId: number) => {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null);
      setSupplierDebt(null);
    } else {
      setExpandedSupplier(supplierId);
      fetchSupplierDebt(supplierId);
    }
  };

  const openPaymentModal = (purchase: DebtPurchase) => {
    setSelectedPurchase(purchase);
    setPaymentAmount(purchase.due_amount.toString());
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (amount > selectedPurchase.due_amount) {
      toast.error('المبلغ أكبر من المتبقي');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await purchasesApi.addPayment(selectedPurchase.id, {
        amount,
        payment_method: paymentMethod,
        date: paymentDate,
        notes: paymentNotes,
      });
      toast.success('تم تسجيل الدفعة بنجاح');
      setShowPaymentModal(false);

      // Refresh data
      fetchCreditors();
      if (expandedSupplier) {
        fetchSupplierDebt(expandedSupplier);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في تسجيل الدفعة';
      toast.error(message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handlePayFull = async (purchase: DebtPurchase) => {
    if (!confirm(`هل تريد تسجيل دفعة كاملة بمبلغ ${formatCurrency(purchase.due_amount)}؟`)) return;

    try {
      await purchasesApi.addPayment(purchase.id, {
        amount: purchase.due_amount,
        payment_method: 'cash',
        date: new Date().toISOString().split('T')[0],
        notes: 'دفعة كاملة',
      });
      toast.success('تم تسجيل الدفعة بنجاح');

      // Refresh data
      fetchCreditors();
      if (expandedSupplier) {
        fetchSupplierDebt(expandedSupplier);
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

  const getAgingBadge = (days: number | null) => {
    if (days === null) return { class: 'bg-gray-100 text-gray-800', text: '-' };
    if (days <= 7) return { class: 'bg-green-100 text-green-800', text: `${days} يوم` };
    if (days <= 30) return { class: 'bg-yellow-100 text-yellow-800', text: `${days} يوم` };
    if (days <= 60) return { class: 'bg-orange-100 text-orange-800', text: `${days} يوم` };
    return { class: 'bg-red-100 text-red-800', text: `${days} يوم` };
  };

  const filteredCreditors = creditors.filter(c => {
    return c.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.supplier_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.supplier_company?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الديون للموردين</h1>
          <p className="text-gray-600 mt-1">الموردين الذين لديهم مبالغ مستحقة علينا</p>
        </div>
        <Link
          href="/dashboard/purchases"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          العودة للمشتريات
        </Link>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <BuildingOfficeIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">عدد الموردين</p>
                <p className="text-2xl font-bold text-blue-600">{totals.total_creditors}</p>
              </div>
            </div>
          </div>

          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <BanknotesIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">إجمالي المستحق</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totals.total_due)}</p>
              </div>
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">إجمالي المدفوع</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.total_paid)}</p>
              </div>
            </div>
          </div>

          <div className="card bg-red-50 border-red-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
            placeholder="بحث بالاسم أو الهاتف أو الشركة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-1"
          />
        </div>

        {filteredCreditors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BanknotesIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">لا يوجد موردين لديهم ديون مستحقة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCreditors.map((creditor) => (
              <div key={creditor.supplier_id} className="border rounded-lg overflow-hidden">
                {/* Creditor Header */}
                <div
                  className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleExpand(creditor.supplier_id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-lg font-bold text-purple-600">
                        {creditor.supplier_name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{creditor.supplier_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {creditor.supplier_company && (
                          <span className="flex items-center gap-1">
                            <BuildingOfficeIcon className="w-4 h-4" />
                            {creditor.supplier_company}
                          </span>
                        )}
                        {creditor.supplier_phone && (
                          <span className="flex items-center gap-1">
                            <PhoneIcon className="w-4 h-4" />
                            {creditor.supplier_phone}
                          </span>
                        )}
                        {creditor.supplier_address && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="w-4 h-4" />
                            {creditor.supplier_address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">عدد الفواتير</p>
                      <p className="font-bold">{creditor.total_purchases}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">المستحق</p>
                      <p className="font-bold text-yellow-600">{formatCurrency(creditor.total_due)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">المدفوع</p>
                      <p className="font-bold text-green-600">{formatCurrency(creditor.total_paid)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">المتبقي</p>
                      <p className="font-bold text-red-600">{formatCurrency(creditor.total_remaining)}</p>
                    </div>
                    {expandedSupplier === creditor.supplier_id ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedSupplier === creditor.supplier_id && (
                  <div className="p-4 border-t bg-white">
                    {loadingSupplierDebt ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="spinner"></div>
                      </div>
                    ) : supplierDebt ? (
                      <div className="overflow-x-auto">
                        <h4 className="font-bold mb-4">الفواتير غير المدفوعة:</h4>
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="whitespace-nowrap px-2">المرجع</th>
                              <th className="whitespace-nowrap px-2">المستودع</th>
                              <th className="whitespace-nowrap px-2">التاريخ</th>
                              <th className="whitespace-nowrap px-2">العمر</th>
                              <th className="whitespace-nowrap px-2">المستحق</th>
                              <th className="whitespace-nowrap px-2">المدفوع</th>
                              <th className="whitespace-nowrap px-2">المتبقي</th>
                              <th className="whitespace-nowrap px-2">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supplierDebt.purchases.map((purchase) => {
                              const agingBadge = getAgingBadge(purchase.days_old);
                              return (
                                <tr key={purchase.id}>
                                  <td className="px-2 whitespace-nowrap">
                                    <Link
                                      href={`/dashboard/purchases/${purchase.id}`}
                                      className="text-blue-600 hover:text-blue-800 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {purchase.reference}
                                    </Link>
                                  </td>
                                  <td className="px-2 whitespace-nowrap">{purchase.warehouse_name}</td>
                                  <td className="px-2 whitespace-nowrap">{formatDate(purchase.date)}</td>
                                  <td className="px-2 whitespace-nowrap">
                                    <span className={`px-2 py-1 rounded text-xs ${agingBadge.class}`}>
                                      {agingBadge.text}
                                    </span>
                                  </td>
                                  <td className="px-2 whitespace-nowrap">{formatCurrency(purchase.grand_total)}</td>
                                  <td className="px-2 whitespace-nowrap text-green-600">{formatCurrency(purchase.paid_amount)}</td>
                                  <td className="px-2 whitespace-nowrap text-red-600 font-bold">{formatCurrency(purchase.due_amount)}</td>
                                  <td className="px-2">
                                    <div className="flex gap-1 justify-center">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openPaymentModal(purchase);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                        title="دفعة جزئية"
                                      >
                                        <CurrencyDollarIcon className="w-3.5 h-3.5" />
                                        جزئي
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePayFull(purchase);
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
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-gray-50 font-bold">
                            <tr>
                              <td colSpan={4} className="px-2">الإجمالي</td>
                              <td className="px-2">{formatCurrency(supplierDebt.totals.total_due)}</td>
                              <td className="px-2 text-green-600">{formatCurrency(supplierDebt.totals.total_paid)}</td>
                              <td className="px-2 text-red-600">{formatCurrency(supplierDebt.totals.total_remaining)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
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
      {showPaymentModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <CurrencyDollarIcon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold">تسجيل دفعة للمورد</h3>
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
                <span className="text-sm text-gray-500">الفاتورة</span>
                <span className="font-medium">{selectedPurchase.reference}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">التاريخ</span>
                <span className="font-medium">{formatDate(selectedPurchase.date)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">المتبقي</span>
                <span className="text-lg font-bold text-red-600">{formatCurrency(selectedPurchase.due_amount)}</span>
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
                    max={selectedPurchase.due_amount}
                    placeholder="0.00"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">د.ج</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">طريقة الدفع</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  >
                    <option value="cash">نقداً</option>
                    <option value="bank">تحويل بنكي</option>
                    <option value="check">شيك</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">التاريخ</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
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
