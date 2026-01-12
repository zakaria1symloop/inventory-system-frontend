import OrderDetail from './OrderDetail';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <OrderDetail />;
}
