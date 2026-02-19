"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartDataPoint = {
  date: string;
  value: number;
  period: string;
};

type IndicatorChartProps = {
  /** Array of historical data points for the chart. */
  data: ChartDataPoint[];
  /** Optional unit label shown on the Y axis and tooltip. */
  unit?: string | null;
};

/**
 * Renders a line chart of historical indicator values using Recharts.
 * Must be a client component because Recharts relies on browser APIs.
 */
export function IndicatorChart({ data, unit }: IndicatorChartProps) {
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No chart data available.
      </p>
    );
  }

  const formatTooltip = (value: number | undefined) =>
    value === undefined ? "" : unit ? `${value} ${unit}` : String(value);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1e2530"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={{ stroke: "#1e2530" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v: number) =>
            unit ? `${v}${unit}` : String(v)
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f1419",
            border: "1px solid #1e2530",
            borderRadius: "6px",
            color: "#e4e4e7",
            fontSize: "12px",
          }}
          formatter={formatTooltip}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: "#3b82f6", r: 3 }}
          activeDot={{ r: 5, fill: "#60a5fa" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
