import AdjustmentDetail from './AdjustmentDetail';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Page() {
  return <AdjustmentDetail />;
}
