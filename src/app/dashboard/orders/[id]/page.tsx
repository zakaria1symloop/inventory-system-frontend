import OrderDetail from './OrderDetail';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <OrderDetail />;
}
