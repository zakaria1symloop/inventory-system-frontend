import PurchaseDetail from './PurchaseDetail';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <PurchaseDetail />;
}
