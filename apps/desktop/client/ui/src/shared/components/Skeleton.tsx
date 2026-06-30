type Props = {
  width?: string;
  height?: string;
  borderRadius?: string;
  ariaLabel?: string;
};

export function Skeleton({ width = '100%', height = '1rem', borderRadius = '4px', ariaLabel }: Props) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius }}
      {...(ariaLabel ? { role: 'status', 'aria-label': ariaLabel, 'aria-busy': true } : { 'aria-hidden': true })}
    />
  );
}
