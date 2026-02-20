"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyDataPoint } from "@/app/actions/analytics";

type AnalyticsChartsProps = {
  dailySignups: DailyDataPoint[];
  dailyApiCalls: DailyDataPoint[];
};

/**
 * Renders two bar charts for the analytics dashboard:
 * - Daily signups over the last 30 days
 * - API calls per day over the last 30 days
 *
 * Must be a client component because Recharts uses browser APIs.
 */
export function AnalyticsCharts({
  dailySignups,
  dailyApiCalls,
}: AnalyticsChartsProps) {
  const tooltipStyle = {
    backgroundColor: "#0f1419",
    border: "1px solid #1e2530",
    borderRadius: "6px",
    color: "#e4e4e7",
    fontSize: "12px",
  };

  const axisTickStyle = { fill: "#71717a", fontSize: 11 };
  const axisLineStyle = { stroke: "#1e2530" };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Daily Signups Chart */}
      <div className="rounded-lg border border-[#1e2530] bg-[#0b0e11]">
        <div className="border-b border-[#1e2530] px-4 py-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            Daily Signups (Last 30 Days)
          </h2>
        </div>
        <div className="p-4">
          {dailySignups.every((d) => d.count === 0) ? (
            <p className="py-12 text-center text-sm text-zinc-400">
              No signups in the last 30 days.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={dailySignups}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e2530"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={axisTickStyle}
                  axisLine={axisLineStyle}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  tick={axisTickStyle}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#1e2530" }}
                />
                <Bar dataKey="count" name="Signups" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Daily API Calls Chart */}
      <div className="rounded-lg border border-[#1e2530] bg-[#0b0e11]">
        <div className="border-b border-[#1e2530] px-4 py-3">
          <h2 className="text-lg font-semibold text-zinc-100">
            API Calls Per Day (Last 30 Days)
          </h2>
        </div>
        <div className="p-4">
          {dailyApiCalls.every((d) => d.count === 0) ? (
            <p className="py-12 text-center text-sm text-zinc-400">
              No API calls in the last 30 days.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={dailyApiCalls}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e2530"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={axisTickStyle}
                  axisLine={axisLineStyle}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  tick={axisTickStyle}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#1e2530" }}
                />
                <Bar dataKey="count" name="API Calls" fill="#10b981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
