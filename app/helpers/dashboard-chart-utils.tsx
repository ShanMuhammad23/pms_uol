export function formatStackBarLabel(value: unknown) {
  const numericValue = Number(value);
  return numericValue >= 5 ? numericValue : "";
}

interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  name?: string;
  value?: number;
  percent?: number;
}

export function createPieLabelRenderer(labelColor: string) {
  return function renderPieLabel({
    cx = 0,
    cy = 0,
    midAngle = 0,
    outerRadius = 0,
    name = "",
    value = 0,
    percent = 0,
  }: PieLabelProps) {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 16;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? "start" : "end";

    return (
      <text
        x={x}
        y={y}
        fill={labelColor}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={10}
        fontWeight={600}
      >
        {`${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };
}
