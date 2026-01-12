'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { deliveriesApi, warehousesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  TruckIcon,
  UserIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CubeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

interface OrderItem {
  id: number;
  product_id: number;
  quantity_ordered: number;
  quantity_confirmed: number;
  quantity_delivered: number;
  quantity_returned: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  product?: {
    id: number;
    name: string;
    barcode?: string;
    pieces_per_package?: number;
  };
}

interface DeliveryOrder {
  id: number;
  order_id: number;
  client_id: number;
  delivery_order: number;
  status: string;
  amount_due: number;
  amount_collected: number;
  delivered_at?: string;
  attempted_at?: string;
  failure_reason?: string;
  notes?: string;
  order?: {
    id: number;
    reference: string;
    items?: OrderItem[];
  };
  client?: {
    id: number;
    name: string;
    phone?: string;
    address?: string;
  };
}

interface DeliveryReturn {
  id: number;
  product_id: number;
  quantity: number;
  reason: string;
  returnable_to_stock: boolean;
  loss_amount: number;
  processed: boolean;
  product?: {
    id: number;
    name: string;
  };
}

interface Delivery {
  id: number;
  reference: string;
  date: string;
  status: string;
  total_orders: number;
  delivered_count: number;
  failed_count: number;
  total_amount: number;
  collected_amount: number;
  start_time?: string;
  end_time?: string;
  notes?: string;
  livreur?: { id: number; name: string };
  vehicle?: { id: number; name: string; plate_number: string };
  warehouse?: { id: number; name: string };
  delivery_orders?: DeliveryOrder[];
  returns?: DeliveryReturn[];
}

export default function DeliveryDetail() {
  const params = useParams();
  const [id, setId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Returns processing state
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingReturnId, setProcessingReturnId] = useState<number | null>(null);

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
    if (id) {
      fetchDelivery();
      fetchWarehouses();
    }
  }, [id]);

  const fetchWarehouses = async () => {
    try {
      const response = await warehousesApi.getAll();
      setWarehouses(response.data.data || response.data || []);
      // Set default warehouse if delivery has one
      if (delivery?.warehouse?.id) {
        setSelectedWarehouse(delivery.warehouse.id);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  };

  const fetchDelivery = async () => {
    if (!id) return;
    try {
      const response = await deliveriesApi.getOne(parseInt(id));
      setDelivery(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-DZ');
  };

  const formatDateTime = (date: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ar-DZ');
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      preparing: { class: 'badge-warning', text: 'قيد التحضير' },
      in_progress: { class: 'badge-info', text: 'قيد التوصيل' },
      completed: { class: 'badge-success', text: 'مكتمل' },
      cancelled: { class: 'badge-danger', text: 'ملغي' },
    };
    return badges[status] || { class: 'badge-secondary', text: status };
  };

  const getOrderStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      pending: { class: 'badge-warning', text: 'معلق' },
      delivered: { class: 'badge-success', text: 'تم التسليم' },
      partial: { class: 'badge-info', text: 'جزئي' },
      failed: { class: 'badge-danger', text: 'فشل' },
      postponed: { class: 'badge-secondary', text: 'مؤجل' },
    };
    return badges[status] || { class: 'badge-secondary', text: status };
  };

  const getReturnReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      refused: 'مرفوض',
      damaged: 'تالف',
      excess: 'زيادة',
      store_closed: 'المحل مغلق',
      wrong: 'خطأ',
      other: 'أخرى',
    };
    return labels[reason] || reason;
  };

  const toggleExpand = (orderId: number) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const openPaymentModal = (order: DeliveryOrder) => {
    const remaining = order.amount_due - order.amount_collected;
    setSelectedOrder(order);
    setPaymentAmount(remaining.toString());
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !delivery) return;

    const amount = parseFloat(paymentAmount);
    const remaining = selectedOrder.amount_due - selectedOrder.amount_collected;

    if (isNaN(amount) || amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (amount > remaining) {
      toast.error('المبلغ أكبر من المتبقي');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await deliveriesApi.collectPayment(delivery.id, selectedOrder.id, {
        amount,
        notes: paymentNotes,
      });
      toast.success('تم تسجيل الدفعة بنجاح');
      setShowPaymentModal(false);
      fetchDelivery();
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في تسجيل الدفعة';
      toast.error(message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handlePayFull = async (order: DeliveryOrder) => {
    if (!delivery) return;
    const remaining = order.amount_due - order.amount_collected;
    if (!confirm(`هل تريد تسجيل دفعة كاملة بمبلغ ${formatCurrency(remaining)}؟`)) return;

    try {
      await deliveriesApi.collectPayment(delivery.id, order.id, {
        amount: remaining,
        notes: 'دفعة كاملة',
      });
      toast.success('تم تسجيل الدفعة بنجاح');
      fetchDelivery();
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في تسجيل الدفعة';
      toast.error(message);
    }
  };

  const openProcessModal = (returnId?: number) => {
    // Set default warehouse from delivery
    if (delivery?.warehouse?.id) {
      setSelectedWarehouse(delivery.warehouse.id);
    }
    setProcessingReturnId(returnId || null);
    setShowProcessModal(true);
  };

  const handleProcessReturns = async () => {
    if (!delivery || !selectedWarehouse) {
      toast.error('يرجى اختيار المستودع');
      return;
    }

    setIsProcessing(true);
    try {
      if (processingReturnId) {
        // Process single return
        await deliveriesApi.processReturn(delivery.id, processingReturnId, {
          warehouse_id: selectedWarehouse,
        });
        toast.success('تمت معالجة المرتجع بنجاح');
      } else {
        // Process all returns
        await deliveriesApi.processReturns(delivery.id, {
          warehouse_id: selectedWarehouse,
        });
        toast.success('تمت معالجة جميع المرتجعات بنجاح');
      }
      setShowProcessModal(false);
      fetchDelivery();
    } catch (error: any) {
      const message = error.response?.data?.message || 'خطأ في معالجة المرتجعات';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  if (!delivery) return <div className="text-center py-8 text-gray-500">لم يتم العثور على التوصيلة</div>;

  const statusBadge = getStatusBadge(delivery.status);
  const uncollectedAmount = (delivery.total_amount || 0) - (delivery.collected_amount || 0);
  const collectionRate = delivery.total_amount > 0 ? ((delivery.collected_amount || 0) / delivery.total_amount) * 100 : 0;

  // Calculate totals
  const totalDelivered = delivery.delivery_orders?.filter(o => ['delivered', 'partial'].includes(o.status)).length || 0;
  const totalReturns = delivery.returns?.length || 0;
  const totalLoss = delivery.returns?.filter(r => !r.returnable_to_stock).reduce((sum, r) => sum + (r.loss_amount || 0), 0) || 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/deliveries" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{delivery.reference}</h1>
            <p className="text-gray-500">{formatDate(delivery.date)}</p>
          </div>
          <span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span>
        </div>
        <button onClick={fetchDelivery} className="btn btn-outline">
          <ArrowPathIcon className="w-5 h-5" />
          تحديث
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">السائق</p>
              <p className="font-bold text-sm">{delivery.livreur?.name || '-'}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <TruckIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">المركبة</p>
              <p className="font-bold text-sm">{delivery.vehicle?.name || '-'}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <BanknotesIcon className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">المبلغ الإجمالي</p>
              <p className="font-bold text-sm">{formatCurrency(delivery.total_amount || 0)}</p>
            </div>
          </div>
        </div>

        <div className="card bg-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">المحصل</p>
              <p className="font-bold text-sm text-green-600">{formatCurrency(delivery.collected_amount || 0)}</p>
            </div>
          </div>
        </div>

        <div className="card bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircleIcon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">المتبقي</p>
              <p className="font-bold text-sm text-red-600">{formatCurrency(uncollectedAmount)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <CurrencyDollarIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">نسبة التحصيل</p>
              <p className="font-bold text-sm text-indigo-600">{collectionRate.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{delivery.total_orders}</p>
          <p className="text-sm text-gray-500">إجمالي الطلبات</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{totalDelivered}</p>
          <p className="text-sm text-gray-500">تم التسليم</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-600">{delivery.failed_count || 0}</p>
          <p className="text-sm text-gray-500">فشل/مؤجل</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-orange-600">{totalReturns}</p>
          <p className="text-sm text-gray-500">مرتجعات</p>
        </div>
      </div>

      {/* Delivery Orders */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">تفاصيل الطلبات</h2>

        <div className="space-y-3">
          {delivery.delivery_orders?.map((order) => {
            const orderStatusBadge = getOrderStatusBadge(order.status);
            const remaining = order.amount_due - order.amount_collected;
            const hasRemaining = remaining > 0;
            const isExpanded = expandedOrder === order.id;

            return (
              <div key={order.id} className="border rounded-lg overflow-hidden">
                {/* Order Header */}
                <div
                  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}
                  onClick={() => toggleExpand(order.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-sm">
                      {order.delivery_order}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{order.order?.reference || '-'}</span>
                        <span className={`badge ${orderStatusBadge.class}`}>{orderStatusBadge.text}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.client?.name} • {order.client?.phone || '-'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">المستحق</p>
                      <p className="font-bold">{formatCurrency(order.amount_due)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">المحصل</p>
                      <p className="font-bold text-green-600">{formatCurrency(order.amount_collected)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">المتبقي</p>
                      <p className={`font-bold ${hasRemaining ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(remaining)}
                      </p>
                    </div>

                    {hasRemaining && ['delivered', 'partial'].includes(order.status) && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openPaymentModal(order)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          <CurrencyDollarIcon className="w-3.5 h-3.5" />
                          تحصيل
                        </button>
                        <button
                          onClick={() => handlePayFull(order)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700"
                        >
                          <CheckCircleIcon className="w-3.5 h-3.5" />
                          كامل
                        </button>
                      </div>
                    )}

                    {isExpanded ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Order Details (Expanded) */}
                {isExpanded && order.order?.items && (
                  <div className="border-t p-4 bg-white">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <CubeIcon className="w-4 h-4" />
                      المنتجات ({order.order.items.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-right">المنتج</th>
                            <th className="px-3 py-2 text-center">المطلوب</th>
                            <th className="px-3 py-2 text-center">المسلم</th>
                            <th className="px-3 py-2 text-center">المرتجع</th>
                            <th className="px-3 py-2 text-right">السعر/قطعة</th>
                            <th className="px-3 py-2 text-center">قطع/وحدة</th>
                            <th className="px-3 py-2 text-right">المجموع</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.order.items.map((item) => {
                            const piecesPerPkg = item.product?.pieces_per_package || 1;
                            // Price per piece × pieces_per_package × quantity
                            const deliveredAmount = (item.quantity_delivered || 0) * item.unit_price * piecesPerPkg;
                            return (
                              <tr key={item.id} className="border-t">
                                <td className="px-3 py-2">
                                  <div className="font-medium">{item.product?.name || '-'}</div>
                                  {item.product?.barcode && (
                                    <div className="text-xs text-gray-400">{item.product.barcode}</div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">{item.quantity_confirmed}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={item.quantity_delivered > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                                    {item.quantity_delivered || 0}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={item.quantity_returned > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                                    {item.quantity_returned || 0}
                                  </span>
                                </td>
                                <td className="px-3 py-2">{formatCurrency(item.unit_price)}</td>
                                <td className="px-3 py-2 text-center">{piecesPerPkg}</td>
                                <td className="px-3 py-2 font-medium">{formatCurrency(deliveredAmount)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Order Additional Info */}
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {order.delivered_at && (
                        <div>
                          <p className="text-gray-500">وقت التسليم</p>
                          <p className="font-medium">{formatDateTime(order.delivered_at)}</p>
                        </div>
                      )}
                      {order.client?.address && (
                        <div className="col-span-2">
                          <p className="text-gray-500">العنوان</p>
                          <p className="font-medium">{order.client.address}</p>
                        </div>
                      )}
                      {order.failure_reason && (
                        <div className="col-span-2">
                          <p className="text-gray-500">سبب الفشل</p>
                          <p className="font-medium text-red-600">{order.failure_reason}</p>
                        </div>
                      )}
                      {order.notes && (
                        <div className="col-span-2">
                          <p className="text-gray-500">ملاحظات</p>
                          <p className="font-medium">{order.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Returns Section */}
      {delivery.returns && delivery.returns.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ArrowPathIcon className="w-5 h-5" />
              المرتجعات ({delivery.returns.length})
            </h2>
            {delivery.returns.some(r => !r.processed) && (
              <button
                onClick={() => openProcessModal()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                <ArrowPathIcon className="w-4 h-4" />
                معالجة جميع المرتجعات
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-right">المنتج</th>
                  <th className="px-3 py-2 text-center">الكمية</th>
                  <th className="px-3 py-2 text-center">السبب</th>
                  <th className="px-3 py-2 text-center">يعود للمخزون</th>
                  <th className="px-3 py-2 text-right">الخسارة</th>
                  <th className="px-3 py-2 text-center">الحالة</th>
                  <th className="px-3 py-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {delivery.returns.map((ret) => (
                  <tr key={ret.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{ret.product?.name || '-'}</td>
                    <td className="px-3 py-2 text-center">{ret.quantity}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`badge ${ret.reason === 'damaged' ? 'badge-danger' : 'badge-warning'}`}>
                        {getReturnReasonLabel(ret.reason)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {ret.returnable_to_stock ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircleIcon className="w-4 h-4" />
                          <span className="text-xs">نعم</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <XCircleIcon className="w-4 h-4" />
                          <span className="text-xs">لا (خسارة)</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {ret.loss_amount > 0 ? (
                        <span className="text-red-600 font-medium">{formatCurrency(ret.loss_amount)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {ret.processed ? (
                        <span className="badge badge-success">تمت المعالجة</span>
                      ) : (
                        <span className="badge badge-warning">معلق</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {!ret.processed && (
                        <button
                          onClick={() => openProcessModal(ret.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700"
                          title="معالجة المرتجع"
                        >
                          <CheckCircleIcon className="w-3.5 h-3.5" />
                          معالجة
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totalLoss > 0 && (
                <tfoot className="bg-red-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 font-bold text-red-600">إجمالي الخسائر</td>
                    <td className="px-3 py-2 font-bold text-red-600">{formatCurrency(totalLoss)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">معلومات إضافية</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {delivery.warehouse && (
            <div>
              <p className="text-sm text-gray-500">المستودع</p>
              <p className="font-medium">{delivery.warehouse.name}</p>
            </div>
          )}
          {delivery.start_time && (
            <div>
              <p className="text-sm text-gray-500">وقت البدء</p>
              <p className="font-medium">{formatDateTime(delivery.start_time)}</p>
            </div>
          )}
          {delivery.end_time && (
            <div>
              <p className="text-sm text-gray-500">وقت الانتهاء</p>
              <p className="font-medium">{formatDateTime(delivery.end_time)}</p>
            </div>
          )}
          {delivery.vehicle?.plate_number && (
            <div>
              <p className="text-sm text-gray-500">رقم اللوحة</p>
              <p className="font-medium">{delivery.vehicle.plate_number}</p>
            </div>
          )}
        </div>
        {delivery.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">ملاحظات</p>
            <p className="mt-1">{delivery.notes}</p>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
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
                <span className="text-sm text-gray-500">العميل</span>
                <span className="font-medium">{selectedOrder.client?.name || '-'}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">الطلب</span>
                <span className="font-medium">{selectedOrder.order?.reference || '-'}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">المستحق</span>
                <span className="font-medium">{formatCurrency(selectedOrder.amount_due)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">تم تحصيله</span>
                <span className="font-medium text-green-600">{formatCurrency(selectedOrder.amount_collected)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">المتبقي</span>
                <span className="text-lg font-bold text-red-600">
                  {formatCurrency(selectedOrder.amount_due - selectedOrder.amount_collected)}
                </span>
              </div>
            </div>

            <form onSubmit={handlePayment}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">المبلغ المحصل</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-4 py-3 text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0.01"
                    max={selectedOrder.amount_due - selectedOrder.amount_collected}
                    placeholder="0.00"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">د.ج</span>
                </div>
                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(((selectedOrder.amount_due - selectedOrder.amount_collected) / 2).toFixed(0))}
                    className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                  >
                    نصف المبلغ
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount((selectedOrder.amount_due - selectedOrder.amount_collected).toString())}
                    className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                  >
                    المبلغ كامل
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات (اختياري)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={2}
                  placeholder="أضف ملاحظة..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <CheckCircleIcon className="w-5 h-5" />
                  {isSubmittingPayment ? 'جاري الحفظ...' : 'تأكيد التحصيل'}
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

      {/* Process Returns Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <ArrowPathIcon className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-bold">
                  {processingReturnId ? 'معالجة مرتجع' : 'معالجة جميع المرتجعات'}
                </h3>
              </div>
              <button
                onClick={() => setShowProcessModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-5 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">
                {processingReturnId
                  ? 'سيتم معالجة المرتجع المحدد:'
                  : `سيتم معالجة ${delivery?.returns?.filter(r => !r.processed).length || 0} مرتجع:`
                }
              </p>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  <span>إرجاع المنتجات الصالحة للمخزون</span>
                </li>
                <li className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
                  <span>تسجيل الخسائر للمنتجات التالفة</span>
                </li>
              </ul>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">المستودع</label>
              <select
                value={selectedWarehouse || ''}
                onChange={(e) => setSelectedWarehouse(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">اختر المستودع</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleProcessReturns}
                disabled={isProcessing || !selectedWarehouse}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <CheckCircleIcon className="w-5 h-5" />
                {isProcessing ? 'جاري المعالجة...' : 'تأكيد المعالجة'}
              </button>
              <button
                type="button"
                onClick={() => setShowProcessModal(false)}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
