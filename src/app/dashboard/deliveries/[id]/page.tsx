import DeliveryDetail from './DeliveryDetail';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <DeliveryDetail />;
}
