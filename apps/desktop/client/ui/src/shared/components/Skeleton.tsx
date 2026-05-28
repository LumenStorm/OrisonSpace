type Props = {
  width?: string;
  height?: string;
  borderRadius?: string;
};

export function Skeleton({ width = '100%', height = '1rem', borderRadius = '4px' }: Props) {
  return <div className="skeleton" style={{ width, height, borderRadius }} />;
}
