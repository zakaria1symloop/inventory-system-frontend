import PurchaseForm from '../../_components/PurchaseForm';

export async function generateStaticParams() {
  return [{ id: '1' }];
}

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchaseId = id ? parseInt(id) : null;

  if (!purchaseId) {
    return <div className="p-6">معرف الفاتورة غير صالح</div>;
  }

  return <PurchaseForm purchaseId={purchaseId} />;
}
