'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ordersApi, deliveriesApi, usersApi, vehiclesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  ArrowsUpDownIcon,
  MapPinIcon,
  TruckIcon,
  UserIcon,
  CalendarIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PrinterIcon,
  EyeIcon,
  PhoneIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';

interface Client {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  gps_lat?: number;
  gps_lng?: number;
}

interface OrderItem {
  id: number;
  product_id: number;
  quantity_confirmed: number;
  unit_price: number;
  product?: {
    id: number;
    name: string;
    pieces_per_unit?: number;
  };
}

interface Order {
  id: number;
  reference: string;
  client_id: number;
  date: string;
  grand_total: number;
  client?: Client;
  items?: OrderItem[];
}

interface User {
  id: number;
  name: string;
  phone?: string;
  role: string;
}

interface Vehicle {
  id: number;
  name: string;
  plate_number?: string;
}

export default function NewDeliveryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([]);
  const [livreurs, setLivreurs] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    livreur_id: '',
    vehicle_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<number[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const toggleOrderExpand = (orderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const printOrder = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();

    // Create hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.top = '-9999px';
    document.body.appendChild(iframe);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Commande ${order.reference}</title>
        <style>
          @media print {
            @page { size: 80mm auto; margin: 5mm; }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 10px; max-width: 300px; margin: 0 auto; font-size: 12px; }
          h1 { text-align: center; font-size: 16px; margin-bottom: 8px; border-bottom: 2px dashed #000; padding-bottom: 8px; }
          .info { margin-bottom: 10px; border-bottom: 1px dashed #ccc; padding-bottom: 10px; }
          .info-row { display: flex; justify-content: space-between; margin: 4px 0; }
          .info-label { color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border-bottom: 1px solid #eee; padding: 5px 2px; text-align: left; font-size: 11px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .total-row { border-top: 2px dashed #000; margin-top: 10px; padding-top: 10px; font-size: 14px; font-weight: bold; display: flex; justify-content: space-between; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; color: #666; border-top: 1px dashed #ccc; padding-top: 10px; }
        </style>
      </head>
      <body>
        <h1>Commande: ${order.reference}</h1>
        <div class="info">
          <div class="info-row"><span class="info-label">Client:</span> <strong>${order.client?.name || '-'}</strong></div>
          <div class="info-row"><span class="info-label">Tel:</span> <span>${order.client?.phone || '-'}</span></div>
          <div class="info-row"><span class="info-label">Adresse:</span> <span>${order.client?.address || '-'}</span></div>
          <div class="info-row"><span class="info-label">Date:</span> <span>${new Date(order.date).toLocaleDateString('fr-FR')}</span></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produit</th>
              <th>Qte</th>
              <th>Prix</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items?.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.product?.name || '-'}</td>
                <td>${Number(item.quantity_confirmed)}</td>
                <td>${Number(item.unit_price).toLocaleString('fr-FR')}</td>
                <td>${(Number(item.quantity_confirmed) * Number(item.unit_price)).toLocaleString('fr-FR')}</td>
              </tr>
            `).join('') || '<tr><td colspan="5">Aucun produit</td></tr>'}
          </tbody>
        </table>
        <div class="total-row">
          <span>Total:</span>
          <span>${Number(order.grand_total).toLocaleString('fr-FR')} DA</span>
        </div>
        <div class="footer">
          <p>Merci pour votre confiance</p>
          <p>${new Date().toLocaleDateString('fr-FR')} - ${new Date().toLocaleTimeString('fr-FR')}</p>
        </div>
      </body>
      </html>
    `;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();

      // Wait for content to load then print
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          // Remove iframe after printing
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 250);
      };

      // Trigger load for browsers that don't fire onload
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 500);
    }
  };

  const downloadOrderPDF = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();

    // Create PDF using jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200], // Receipt size
    });

    // For Arabic support, we'll use a simple approach with reversed text
    const reverseArabic = (text: string) => text;

    let yPos = 10;
    const pageWidth = 80;
    const margin = 5;
    const contentWidth = pageWidth - (margin * 2);

    // Title
    doc.setFontSize(14);
    doc.text(order.reference, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Line
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // Client Info
    doc.setFontSize(10);
    doc.text(`Client: ${order.client?.name || '-'}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 5;
    doc.text(`Tel: ${order.client?.phone || '-'}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 5;
    doc.text(`Date: ${new Date(order.date).toLocaleDateString('fr-FR')}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 8;

    // Products header
    doc.setFontSize(9);
    doc.text('Qte', margin + 5, yPos);
    doc.text('Produit', margin + 20, yPos);
    doc.text('Total', pageWidth - margin, yPos, { align: 'right' });
    yPos += 3;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // Products
    doc.setFontSize(8);
    order.items?.forEach((item) => {
      const qty = item.quantity_confirmed.toString();
      const name = (item.product?.name || '-').substring(0, 15);
      const total = (Number(item.quantity_confirmed) * Number(item.unit_price)).toFixed(0);

      doc.text(qty, margin + 5, yPos);
      doc.text(name, margin + 15, yPos);
      doc.text(total, pageWidth - margin, yPos, { align: 'right' });
      yPos += 5;
    });

    // Total
    yPos += 3;
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
    doc.setFontSize(12);
    doc.text(`Total: ${Number(order.grand_total).toFixed(0)} DA`, pageWidth - margin, yPos, { align: 'right' });

    // Download
    doc.save(`commande-${order.reference}.pdf`);
    toast.success('PDF telecharge avec succes');
  };

  const fetchData = async () => {
    try {
      const [ordersRes, usersRes, vehiclesRes] = await Promise.all([
        ordersApi.getUnassigned(),
        usersApi.getAll({ role: 'livreur', is_active: true }),
        vehiclesApi.getAll({ is_active: true }),
      ]);

      setOrders(ordersRes.data);
      const usersData = usersRes.data.data || usersRes.data;
      setLivreurs(usersData.filter((u: User) => u.role === 'livreur'));
      setVehicles(vehiclesRes.data.data || vehiclesRes.data);
    } catch (error) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    // Use fr-DZ for consistent comma thousands separator
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-DZ', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleSelectOrder = (order: Order) => {
    if (selectedOrders.find((o) => o.id === order.id)) {
      setSelectedOrders(selectedOrders.filter((o) => o.id !== order.id));
    } else {
      setSelectedOrders([...selectedOrders, order]);
    }
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders([...orders]);
    }
  };

  const handleRemoveSelected = (orderId: number) => {
    setSelectedOrders(selectedOrders.filter((o) => o.id !== orderId));
  };

  // Drag and Drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrders = [...selectedOrders];
    const draggedItem = newOrders[draggedIndex];
    newOrders.splice(draggedIndex, 1);
    newOrders.splice(index, 0, draggedItem);
    setSelectedOrders(newOrders);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === selectedOrders.length - 1)
    )
      return;

    const newOrders = [...selectedOrders];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newOrders[index], newOrders[newIndex]] = [newOrders[newIndex], newOrders[index]];
    setSelectedOrders(newOrders);
  };

  const handleSubmit = async () => {
    if (!formData.livreur_id) {
      toast.error('يرجى اختيار السائق');
      return;
    }
    if (selectedOrders.length === 0) {
      toast.error('يرجى اختيار طلب واحد على الأقل');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await deliveriesApi.create({
        livreur_id: Number(formData.livreur_id),
        vehicle_id: formData.vehicle_id ? Number(formData.vehicle_id) : null,
        date: formData.date,
        notes: formData.notes || null,
        order_ids: selectedOrders.map((o) => o.id),
      });

      toast.success('تم إنشاء رحلة التوصيل بنجاح');
      router.push(`/dashboard/deliveries/${response.data.id}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'خطأ في إنشاء رحلة التوصيل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAmount = selectedOrders.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);
  const totalProducts = selectedOrders.reduce(
    (sum, o) => sum + (o.items?.reduce((s, i) => s + (Number(i.quantity_confirmed) || 0), 0) || 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/deliveries" className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">إنشاء رحلة توصيل جديدة</h1>
            <p className="text-gray-500">اختر الطلبات وحدد السائق والمركبة</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Available Orders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Settings */}
          <div className="card">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <TruckIcon className="w-5 h-5" />
              إعدادات التوصيل
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  السائق <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.livreur_id}
                  onChange={(e) => setFormData({ ...formData, livreur_id: e.target.value })}
                  className="select w-full"
                >
                  <option value="">اختر السائق</option>
                  {livreurs.map((livreur) => (
                    <option key={livreur.id} value={livreur.id}>
                      {livreur.name} {livreur.phone && `(${livreur.phone})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">المركبة</label>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="select w-full"
                >
                  <option value="">اختر المركبة (اختياري)</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} {vehicle.plate_number && `(${vehicle.plate_number})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ التوصيل <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="textarea w-full"
                rows={2}
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>

          {/* Available Orders */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">الطلبات المؤكدة ({orders.length})</h3>
              <button
                onClick={handleSelectAll}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {selectedOrders.length === orders.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">لا توجد طلبات مؤكدة للتوصيل</div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {orders.map((order) => {
                  const isSelected = selectedOrders.some((o) => o.id === order.id);
                  const isExpanded = expandedOrders.includes(order.id);
                  const hasGps = order.client?.gps_lat && order.client?.gps_lng;

                  return (
                    <div
                      key={order.id}
                      className={`border rounded-lg transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Order Header */}
                      <div
                        onClick={() => handleSelectOrder(order)}
                        className="p-3 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                              }`}
                            >
                              {isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}
                            </div>
                            <div>
                              <div className="font-medium">{order.reference}</div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <span>{order.client?.name}</span>
                                {order.client?.phone && (
                                  <span className="flex items-center gap-1 text-xs">
                                    <PhoneIcon className="w-3 h-3" />
                                    {order.client.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasGps && (
                              <MapPinIcon className="w-5 h-5 text-green-600" title="يوجد موقع GPS" />
                            )}
                            <div className="text-left">
                              <div className="font-medium">{formatCurrency(order.grand_total)}</div>
                              <div className="text-xs text-gray-500">
                                {order.items?.length || 0} منتج
                              </div>
                            </div>
                          </div>
                        </div>
                        {order.client?.address && (
                          <div className="mt-2 text-sm text-gray-500 pr-8">
                            {order.client.address}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50/50">
                        <button
                          onClick={(e) => toggleOrderExpand(order.id, e)}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUpIcon className="w-4 h-4" />
                              إخفاء المنتجات
                            </>
                          ) : (
                            <>
                              <ChevronDownIcon className="w-4 h-4" />
                              عرض المنتجات ({order.items?.length || 0})
                            </>
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => downloadOrderPDF(order, e)}
                            className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800"
                            title="تحميل PDF"
                          >
                            <DocumentArrowDownIcon className="w-4 h-4" />
                            PDF
                          </button>
                          <button
                            onClick={(e) => printOrder(order, e)}
                            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                            title="طباعة"
                          >
                            <PrinterIcon className="w-4 h-4" />
                            طباعة
                          </button>
                        </div>
                      </div>

                      {/* Expanded Product Details */}
                      {isExpanded && (
                        <div className="border-t bg-white p-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-500 border-b bg-gray-50">
                                <th className="text-center py-2 font-medium w-10">الرقم</th>
                                <th className="text-right py-2 font-medium">التعيين</th>
                                <th className="text-center py-2 font-medium w-16">الكمية</th>
                                <th className="text-center py-2 font-medium w-16">الوحدة</th>
                                <th className="text-center py-2 font-medium w-16">العدد</th>
                                <th className="text-center py-2 font-medium w-20">س. الوحدة</th>
                                <th className="text-left py-2 font-medium w-24">المبلغ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items && order.items.length > 0 ? (
                                order.items.map((item, idx) => {
                                  const piecesPerUnit = item.product?.pieces_per_unit || 1;
                                  const totalPieces = item.quantity_confirmed * piecesPerUnit;
                                  const lineTotal = item.quantity_confirmed * item.unit_price;
                                  return (
                                    <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                      <td className="py-2 text-center text-gray-500">{idx + 1}</td>
                                      <td className="py-2 font-medium">{item.product?.name || '-'}</td>
                                      <td className="py-2 text-center font-bold text-blue-600">{item.quantity_confirmed}</td>
                                      <td className="py-2 text-center">{formatNumber(piecesPerUnit)}</td>
                                      <td className="py-2 text-center">{formatNumber(totalPieces)}</td>
                                      <td className="py-2 text-center">{formatNumber(item.unit_price)}</td>
                                      <td className="py-2 text-left font-medium">{formatNumber(lineTotal)}</td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={7} className="py-4 text-center text-gray-500">
                                    لا توجد منتجات
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 font-bold bg-green-50">
                                <td colSpan={6} className="py-2 text-right">الإجمالي</td>
                                <td className="py-2 text-left text-green-600">
                                  {formatNumber(order.grand_total)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Selected Orders (Roadmap) */}
        <div className="space-y-6">
          {/* Summary */}
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="font-bold text-blue-800 mb-4">ملخص الرحلة</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">عدد الطلبات</span>
                <span className="font-bold">{selectedOrders.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">عدد المنتجات</span>
                <span className="font-bold">{Math.round(totalProducts)}</span>
              </div>
              <div className="flex justify-between text-lg border-t pt-2">
                <span className="text-gray-600">المبلغ الإجمالي</span>
                <span className="font-bold text-green-600">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Selected Orders - Roadmap */}
          <div className="card">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <ArrowsUpDownIcon className="w-5 h-5" />
              ترتيب التوصيل (اسحب لإعادة الترتيب)
            </h3>

            {selectedOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                اختر الطلبات من القائمة على اليسار
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {selectedOrders.map((order, index) => {
                  const hasGps = order.client?.gps_lat && order.client?.gps_lng;
                  const isExpanded = expandedOrders.includes(order.id);

                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`border rounded-lg bg-white ${
                        draggedIndex === index ? 'opacity-50 border-blue-500' : 'border-gray-200'
                      }`}
                    >
                      <div className="p-3 cursor-move">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveOrder(index, 'up')}
                              disabled={index === 0}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 15l7-7 7 7"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => moveOrder(index, 'down')}
                              disabled={index === selectedOrders.length - 1}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>
                          </div>

                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {index + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{order.client?.name}</div>
                            <div className="text-xs text-gray-500">
                              {order.reference} - {formatCurrency(order.grand_total)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => toggleOrderExpand(order.id, e)}
                              className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"
                              title="عرض المنتجات"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => downloadOrderPDF(order, e)}
                              className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg"
                              title="تحميل PDF"
                            >
                              <DocumentArrowDownIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => printOrder(order, e)}
                              className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg"
                              title="طباعة"
                            >
                              <PrinterIcon className="w-4 h-4" />
                            </button>
                            {hasGps && (
                              <a
                                href={`https://www.google.com/maps?q=${order.client?.gps_lat},${order.client?.gps_lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg"
                                title="الموقع"
                              >
                                <MapPinIcon className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => handleRemoveSelected(order.id)}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg"
                              title="إزالة"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Product Details */}
                      {isExpanded && (
                        <div className="border-t bg-gray-50 p-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 border-b">
                                <th className="text-center py-1 w-6">#</th>
                                <th className="text-right py-1">التعيين</th>
                                <th className="text-center py-1 w-10">الكمية</th>
                                <th className="text-center py-1 w-10">الوحدة</th>
                                <th className="text-center py-1 w-10">العدد</th>
                                <th className="text-left py-1 w-14">المبلغ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items && order.items.length > 0 ? (
                                order.items.map((item, idx) => {
                                  const piecesPerUnit = item.product?.pieces_per_unit || 1;
                                  const totalPieces = item.quantity_confirmed * piecesPerUnit;
                                  const lineTotal = item.quantity_confirmed * item.unit_price;
                                  return (
                                    <tr key={idx} className="border-b last:border-0">
                                      <td className="py-1 text-center text-gray-400">{idx + 1}</td>
                                      <td className="py-1 truncate max-w-[100px]">{item.product?.name}</td>
                                      <td className="py-1 text-center font-bold text-blue-600">{item.quantity_confirmed}</td>
                                      <td className="py-1 text-center">{piecesPerUnit}</td>
                                      <td className="py-1 text-center">{totalPieces}</td>
                                      <td className="py-1 text-left font-medium">{formatNumber(lineTotal)}</td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={6} className="text-center text-gray-500 py-2">لا توجد منتجات</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create Delivery Button */}
            <div className="mt-6 pt-4 border-t">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedOrders.length === 0 || !formData.livreur_id}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner w-5 h-5"></div>
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    <TruckIcon className="w-5 h-5" />
                    إنشاء رحلة التوصيل
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Map Preview */}
          {selectedOrders.some((o) => o.client?.gps_lat && o.client?.gps_lng) && (
            <div className="card">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <MapPinIcon className="w-5 h-5" />
                معاينة المسار
              </h3>
              <a
                href={`https://www.google.com/maps/dir/${selectedOrders
                  .filter((o) => o.client?.gps_lat && o.client?.gps_lng)
                  .map((o) => `${o.client?.gps_lat},${o.client?.gps_lng}`)
                  .join('/')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <MapPinIcon className="w-5 h-5" />
                فتح المسار في خرائط Google
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
