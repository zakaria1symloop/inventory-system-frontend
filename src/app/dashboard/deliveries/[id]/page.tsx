import DeliveryDetail from './DeliveryDetail';

export async function generateStaticParams() {
  // Generate a placeholder route for static export
  return [{ id: '1' }];
}

export default function Page() {
  return <DeliveryDetail />;
}
