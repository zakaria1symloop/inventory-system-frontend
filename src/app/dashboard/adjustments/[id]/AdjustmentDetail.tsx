'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { adjustmentsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function AdjustmentDetail() {
  const params = useParams();
  const [id, setId] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    if (id) fetchAdjustment();
  }, [id]);

  const fetchAdjustment = async () => {
    if (!id) return;
    try {
      const response = await adjustmentsApi.getOne(parseInt(id));
      setAdjustment(response.data.data || response.data);
    } catch (error) {
      toast.error('خطأ في تحميل بيانات التعديل');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', minimumFractionDigits: 0 }).format(value);

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  if (!adjustment) return <div className="text-center py-8 text-gray-500">التعديل غير موجود</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/adjustments" className="text-gray-500 hover:text-gray-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">{adjustment.reference}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card"><div className="text-sm text-gray-500">النوع</div><div className="text-xl font-bold">{adjustment.type === 'addition' ? 'إضافة' : 'خصم'}</div></div>
        <div className="card"><div className="text-sm text-gray-500">المستودع</div><div className="text-xl font-bold">{adjustment.warehouse?.name || '-'}</div></div>
        <div className="card"><div className="text-sm text-gray-500">الحالة</div><div className="text-xl font-bold">{adjustment.status}</div></div>
        <div className="card bg-green-50"><div className="text-sm text-green-600">القيمة</div><div className="text-xl font-bold text-green-700">{formatCurrency(adjustment.total_amount)}</div></div>
      </div>

      <div className="card">
        <h3 className="font-bold mb-4">المنتجات</h3>
        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th className="text-center">الكمية</th>
              <th className="text-center">قطع/وحدة</th>
              <th className="text-center">سعر الوحدة</th>
              <th className="text-center">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {adjustment.items?.map((item: any) => {
              const piecesPerPackage = item.product?.pieces_per_package || 1;
              return (
                <tr key={item.id}>
                  <td>
                    <div className="font-medium">{item.product?.name}</div>
                    {item.product?.barcode && (
                      <div className="text-xs text-gray-400">{item.product.barcode}</div>
                    )}
                  </td>
                  <td className="text-center font-semibold">{item.quantity}</td>
                  <td className="text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {piecesPerPackage}
                    </span>
                  </td>
                  <td className="text-center">{formatCurrency(item.unit_price)}</td>
                  <td className="text-center font-semibold">
                    {formatCurrency(item.total)}
                    <div className="text-xs text-gray-400">
                      {item.unit_price} × {piecesPerPackage} × {item.quantity}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
