'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { purchasesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  ArrowRightIcon,
  PrinterIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  BanknotesIcon,
  TruckIcon,
  BuildingStorefrontIcon,
  CalendarIcon,
  UserIcon,
  CreditCardIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';

interface PurchaseItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  subtotal: number;
  product?: {
    id: number;
    name: string;
    barcode?: string;
    pieces_per_package?: number;
    unit_buy?: { id: number; name: string; short_name: string };
  };
}

interface Payment {
  id: number;
  reference: string;
  amount: number;
  payment_method: 'cash' | 'bank' | 'check' | 'other';
  date: string;
  notes?: string;
  user?: { id: number; name: string };
  created_at: string;
}

interface Purchase {
  id: number;
  reference: string;
  supplier_id: number;
  warehouse_id: number;
  user_id: number;
  date: string;
  total_amount: number;
  discount: number;
  tax: number;
  shipping: number;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  status: 'pending' | 'received' | 'partial';
  payment_status: 'unpaid' | 'partial' | 'paid';
  note?: string;
  supplier?: { id: number; name: string; phone?: string; address?: string };
  warehouse?: { id: number; name: string };
  user?: { id: number; name: string };
  items?: PurchaseItem[];
  payments?: Payment[];
  created_at: string;
  updated_at: string;
}

export default function PurchaseDetail() {
  const params = useParams();
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Payment modal state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'cash' as 'cash' | 'bank' | 'check' | 'other',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Extract ID from URL for static export compatibility
  useEffect(() => {
    const paramId = params.id as string;
    if (paramId && paramId !== '_') {
      setId(paramId);
    } else if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const urlId = pathParts[pathParts.length - 1];
      if (urlId && urlId !== '_') {
        setId(urlId);
      }
    }
  }, [params.id]);

  useEffect(() => {
    if (id) fetchPurchase();
  }, [id]);

  const fetchPurchase = async () => {
    if (!id) return;
    try {
      const response = await purchasesApi.getOne(parseInt(id));
      setPurchase(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    const safeValue = isNaN(value) ? 0 : value;
    return new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(safeValue);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-DZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: ClockIcon, label: 'قيد الانتظار' },
      received: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon, label: 'مستلم' },
      partial: { bg: 'bg-blue-100', text: 'text-blue-800', icon: TruckIcon, label: 'جزئي' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      unpaid: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon, label: 'غير مدفوع' },
      partial: { bg: 'bg-orange-100', text: 'text-orange-800', icon: BanknotesIcon, label: 'مدفوع جزئياً' },
      paid: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon, label: 'مدفوع' },
    };
    const config = statusConfig[status] || statusConfig.unpaid;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      cash: 'نقدي',
      bank: 'تحويل بنكي',
      check: 'شيك',
      other: 'أخرى',
    };
    return methods[method] || method;
  };

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة شراء - ${purchase?.reference}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; font-size: 14px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header .ref { font-size: 18px; color: #666; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f9f9f9; padding: 15px; border-radius: 8px; }
          .info-box h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
          .info-box p { font-size: 16px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 12px; text-align: right; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; font-weight: bold; }
          .totals { margin-top: 20px; text-align: left; }
          .totals .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .totals .row.grand { font-size: 18px; font-weight: bold; border-top: 2px solid #333; margin-top: 10px; padding-top: 15px; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>فاتورة شراء</h1>
          <div class="ref">${purchase?.reference}</div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>المورد</h3>
            <p>${purchase?.supplier?.name || '-'}</p>
            ${purchase?.supplier?.phone ? `<p style="font-size:12px;color:#666">${purchase.supplier.phone}</p>` : ''}
          </div>
          <div class="info-box">
            <h3>التاريخ</h3>
            <p>${purchase?.date ? formatDate(purchase.date) : '-'}</p>
          </div>
          <div class="info-box">
            <h3>المستودع</h3>
            <p>${purchase?.warehouse?.name || '-'}</p>
          </div>
          <div class="info-box">
            <h3>المستخدم</h3>
            <p>${purchase?.user?.name || '-'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>السعر/قطعة</th>
              <th>قطع/وحدة</th>
              <th>الخصم</th>
              <th>الضريبة</th>
              <th>المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${purchase?.items?.map((item, index) => {
              const piecesPerPkg = item.product?.pieces_per_package || 1;
              return `
              <tr>
                <td>${index + 1}</td>
                <td>${item.product?.name || '-'}</td>
                <td style="text-align:center;font-weight:bold">${item.quantity}</td>
                <td>${formatCurrency(item.unit_price)}</td>
                <td style="text-align:center"><span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:10px;font-size:12px">${piecesPerPkg}</span></td>
                <td>${formatCurrency(item.discount)}</td>
                <td>${formatCurrency(item.tax)}</td>
                <td>
                  <strong>${formatCurrency(item.subtotal)}</strong>
                  <br><small style="color:#666">${item.unit_price} × ${piecesPerPkg} × ${item.quantity}</small>
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="row"><span>المجموع الفرعي:</span><span>${formatCurrency(purchase?.total_amount || 0)}</span></div>
          <div class="row"><span>الخصم:</span><span>${formatCurrency(purchase?.discount || 0)}</span></div>
          <div class="row"><span>الضريبة:</span><span>${formatCurrency(purchase?.tax || 0)}</span></div>
          <div class="row"><span>الشحن:</span><span>${formatCurrency(purchase?.shipping || 0)}</span></div>
          <div class="row grand"><span>المجموع النهائي:</span><span>${formatCurrency(purchase?.grand_total || 0)}</span></div>
          <div class="row"><span>المدفوع:</span><span>${formatCurrency(purchase?.paid_amount || 0)}</span></div>
          <div class="row" style="color: ${(purchase?.due_amount || 0) > 0 ? 'red' : 'green'}"><span>المتبقي:</span><span>${formatCurrency(purchase?.due_amount || 0)}</span></div>
        </div>

        ${purchase?.note ? `<div style="margin-top:30px;padding:15px;background:#f9f9f9;border-radius:8px"><strong>ملاحظات:</strong><p>${purchase.note}</p></div>` : ''}

        <div class="footer">
          <p>تم الطباعة بتاريخ ${new Date().toLocaleDateString('ar-DZ')}</p>
        </div>
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

  const handleDelete = async () => {
    if (!purchase) return;
    setIsDeleting(true);
    try {
      await purchasesApi.delete(purchase.id);
      toast.success('تم حذف الفاتورة بنجاح');
      router.push('/dashboard/purchases');
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في حذف الفاتورة';
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  const openPaymentModal = () => {
    if (!purchase) return;
    setPaymentData({
      amount: purchase.due_amount.toString(),
      payment_method: 'cash',
      notes: '',
      date: new Date().toISOString().split('T')[0],
    });
    setIsPaymentOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;

    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    if (amount > purchase.due_amount) {
      toast.error('المبلغ أكبر من المتبقي');
      return;
    }

    setIsProcessingPayment(true);
    try {
      await purchasesApi.addPayment(purchase.id, {
        amount,
        payment_method: paymentData.payment_method,
        notes: paymentData.notes,
        date: paymentData.date,
      });
      toast.success('تم تسجيل الدفعة بنجاح');
      setIsPaymentOpen(false);
      fetchPurchase(); // Reload purchase data
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في تسجيل الدفعة';
      toast.error(message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePayFull = async () => {
    if (!purchase || purchase.due_amount <= 0) return;

    setIsProcessingPayment(true);
    try {
      await purchasesApi.addPayment(purchase.id, {
        amount: purchase.due_amount,
        payment_method: 'cash',
        notes: 'دفع كامل',
        date: new Date().toISOString().split('T')[0],
      });
      toast.success('تم دفع المبلغ بالكامل');
      fetchPurchase();
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في الدفع';
      toast.error(message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="text-center py-16">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">لم يتم العثور على الفاتورة</h3>
        <Link href="/dashboard/purchases" className="text-blue-600 hover:text-blue-800">
          العودة إلى قائمة المشتريات
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/purchases"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowRightIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{purchase.reference}</h1>
            <p className="text-sm text-gray-500">
              تم الإنشاء في {formatDate(purchase.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {purchase.due_amount > 0 && (
            <>
              <button
                onClick={openPaymentModal}
                className="btn btn-primary"
                disabled={isProcessingPayment}
              >
                <CreditCardIcon className="w-5 h-5" />
                إضافة دفعة
              </button>
              <button
                onClick={handlePayFull}
                className="btn bg-green-600 text-white hover:bg-green-700"
                disabled={isProcessingPayment}
              >
                <CheckCircleIcon className="w-5 h-5" />
                دفع الكل
              </button>
            </>
          )}
          <button
            onClick={handlePrint}
            className="btn btn-secondary"
          >
            <PrinterIcon className="w-5 h-5" />
            طباعة
          </button>
          <button
            onClick={() => setIsDeleteOpen(true)}
            className="btn bg-red-50 text-red-600 hover:bg-red-100"
          >
            <TrashIcon className="w-5 h-5" />
            حذف
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BuildingStorefrontIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">المورد</p>
              <p className="font-semibold">{purchase.supplier?.name || 'بدون مورد'}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">التاريخ</p>
              <p className="font-semibold">{formatDate(purchase.date)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="text-sm text-gray-500 mb-2">حالة الاستلام</p>
          {getStatusBadge(purchase.status)}
        </div>

        <div className="card">
          <p className="text-sm text-gray-500 mb-2">حالة الدفع</p>
          {getPaymentStatusBadge(purchase.payment_status)}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items Table */}
        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">المنتجات ({purchase.items?.length || 0})</h3>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th className="text-center w-12">#</th>
                    <th>المنتج</th>
                    <th className="text-center">الكمية</th>
                    <th className="text-center">السعر/قطعة</th>
                    <th className="text-center">قطع/وحدة</th>
                    <th className="text-center">الخصم</th>
                    <th className="text-center">الضريبة</th>
                    <th className="text-center">المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items?.map((item, index) => {
                    const piecesPerPkg = item.product?.pieces_per_package || 1;
                    return (
                      <tr key={item.id}>
                        <td className="text-center text-gray-500">{index + 1}</td>
                        <td>
                          <div className="font-medium">{item.product?.name || '-'}</div>
                          {item.product?.barcode && (
                            <div className="text-xs text-gray-400">{item.product.barcode}</div>
                          )}
                        </td>
                        <td className="text-center font-semibold">{item.quantity}</td>
                        <td className="text-center">{formatCurrency(item.unit_price)}</td>
                        <td className="text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {piecesPerPkg}
                          </span>
                        </td>
                        <td className="text-center text-red-600">{item.discount > 0 ? `-${formatCurrency(item.discount)}` : '-'}</td>
                        <td className="text-center text-blue-600">{item.tax > 0 ? formatCurrency(item.tax) : '-'}</td>
                        <td className="text-center font-semibold">
                          {formatCurrency(item.subtotal)}
                          <div className="text-xs text-gray-400">
                            {item.unit_price} × {piecesPerPkg} × {item.quantity}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments History */}
          {purchase.payments && purchase.payments.length > 0 && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">سجل الدفعات ({purchase.payments.length})</h3>
                <span className="text-sm text-gray-500">
                  إجمالي المدفوع: <span className="font-semibold text-green-600">{formatCurrency(purchase.paid_amount)}</span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th className="text-center w-12">#</th>
                      <th className="text-center">المرجع</th>
                      <th className="text-center">التاريخ</th>
                      <th className="text-center">طريقة الدفع</th>
                      <th className="text-center">المبلغ</th>
                      <th className="text-center">بواسطة</th>
                      <th>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.payments.map((payment, index) => (
                      <tr key={payment.id}>
                        <td className="text-center text-gray-500">{index + 1}</td>
                        <td className="text-center font-mono text-sm">{payment.reference}</td>
                        <td className="text-center">{formatDate(payment.date)}</td>
                        <td className="text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            payment.payment_method === 'cash' ? 'bg-green-100 text-green-800' :
                            payment.payment_method === 'bank' ? 'bg-blue-100 text-blue-800' :
                            payment.payment_method === 'check' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getPaymentMethodLabel(payment.payment_method)}
                          </span>
                        </td>
                        <td className="text-center font-semibold text-green-600">{formatCurrency(payment.amount)}</td>
                        <td className="text-center text-gray-600">{payment.user?.name || '-'}</td>
                        <td className="text-gray-500 text-sm">{payment.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          {/* Totals */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">ملخص الفاتورة</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>المجموع الفرعي</span>
                <span>{formatCurrency(purchase.total_amount)}</span>
              </div>
              {purchase.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>الخصم</span>
                  <span>-{formatCurrency(purchase.discount)}</span>
                </div>
              )}
              {purchase.tax > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>الضريبة</span>
                  <span>+{formatCurrency(purchase.tax)}</span>
                </div>
              )}
              {purchase.shipping > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>الشحن</span>
                  <span>+{formatCurrency(purchase.shipping)}</span>
                </div>
              )}
              <hr />
              <div className="flex justify-between text-lg font-bold">
                <span>المجموع النهائي</span>
                <span className="text-green-600">{formatCurrency(purchase.grand_total)}</span>
              </div>
              <hr />
              <div className="flex justify-between text-gray-600">
                <span>المدفوع</span>
                <span className="text-green-600">{formatCurrency(purchase.paid_amount)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>المتبقي</span>
                <span className={purchase.due_amount > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(purchase.due_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">معلومات إضافية</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <TruckIcon className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">المستودع</p>
                  <p className="font-medium">{purchase.warehouse?.name || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <UserIcon className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">بواسطة</p>
                  <p className="font-medium">{purchase.user?.name || '-'}</p>
                </div>
              </div>
              {purchase.supplier?.phone && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">هاتف المورد</p>
                    <p className="font-medium">{purchase.supplier.phone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {purchase.note && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">ملاحظات</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{purchase.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="حذف الفاتورة"
        message={`هل أنت متأكد من حذف الفاتورة "${purchase.reference}"؟ سيتم إلغاء جميع حركات المخزون المرتبطة.`}
        isLoading={isDeleting}
      />

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title="إضافة دفعة"
      >
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">المبلغ الإجمالي:</span>
              <span className="font-semibold">{formatCurrency(purchase.grand_total)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">المدفوع:</span>
              <span className="font-semibold text-green-600">{formatCurrency(purchase.paid_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">المتبقي:</span>
              <span className="font-bold text-red-600">{formatCurrency(purchase.due_amount)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
            <input
              type="number"
              value={paymentData.amount}
              onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
              className="input w-full"
              placeholder="0.00"
              min="0"
              max={purchase.due_amount}
              step="0.01"
              required
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentData(prev => ({ ...prev, amount: purchase.due_amount.toString() }))}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
              >
                المبلغ الكامل
              </button>
              <button
                type="button"
                onClick={() => setPaymentData(prev => ({ ...prev, amount: (purchase.due_amount / 2).toFixed(2) }))}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
              >
                النصف
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع</label>
            <select
              value={paymentData.payment_method}
              onChange={(e) => setPaymentData(prev => ({ ...prev, payment_method: e.target.value as any }))}
              className="select w-full"
              required
            >
              <option value="cash">نقدي</option>
              <option value="bank">تحويل بنكي</option>
              <option value="check">شيك</option>
              <option value="other">أخرى</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
            <input
              type="date"
              value={paymentData.date}
              onChange={(e) => setPaymentData(prev => ({ ...prev, date: e.target.value }))}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
            <textarea
              value={paymentData.notes}
              onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
              className="input w-full"
              rows={2}
              placeholder="ملاحظات اختيارية..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsPaymentOpen(false)}
              className="btn btn-secondary"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isProcessingPayment}
              className="btn btn-primary"
            >
              {isProcessingPayment ? (
                <span className="spinner w-5 h-5"></span>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  تأكيد الدفع
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
