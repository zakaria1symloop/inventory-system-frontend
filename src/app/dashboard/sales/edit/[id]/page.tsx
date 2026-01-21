import SaleForm from '../../_components/SaleForm';

export async function generateStaticParams() {
  return [{ id: '1' }];
}

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const saleId = id ? parseInt(id) : null;

  if (!saleId) {
    return <div className="p-6">معرف الفاتورة غير صالح</div>;
  }

  return <SaleForm saleId={saleId} />;
}
