'use client';

import { useParams } from 'next/navigation';
import SaleForm from '../../_components/SaleForm';

export default function EditSalePage() {
  const params = useParams();
  const saleId = params?.id ? parseInt(params.id as string) : null;

  if (!saleId) {
    return <div className="p-6">معرف الفاتورة غير صالح</div>;
  }

  return <SaleForm saleId={saleId} />;
}
