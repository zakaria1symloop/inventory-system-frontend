'use client';

import { useParams } from 'next/navigation';
import PurchaseForm from '../../_components/PurchaseForm';

export default function EditPurchasePage() {
  const params = useParams();
  const purchaseId = params?.id ? parseInt(params.id as string) : null;

  if (!purchaseId) {
    return <div className="p-6">معرف الفاتورة غير صالح</div>;
  }

  return <PurchaseForm purchaseId={purchaseId} />;
}
