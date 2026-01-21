import PurchaseDetail from './PurchaseDetail';

export async function generateStaticParams() {
  // Generate a placeholder route for static export
  return [{ id: '1' }];
}

export default function Page() {
  return <PurchaseDetail />;
}
