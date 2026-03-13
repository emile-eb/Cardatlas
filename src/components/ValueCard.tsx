import { ValuePanel } from "./ValuePanel";

type Props = {
  value: number;
  condition: string;
  scansLeft?: number;
};

export function ValueCard({ value, condition, scansLeft }: Props) {
  const trend = typeof scansLeft === "number" ? `${scansLeft} free scans left` : undefined;
  return <ValuePanel value={value} condition={condition} trend={trend} />;
}
