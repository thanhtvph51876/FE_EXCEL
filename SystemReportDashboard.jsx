import React, { useEffect, useMemo, useState } from "react";
import { adminService } from "./services/adminService.js";

const TIME_FILTERS = [
  { label: "Today", value: "today" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "This Month", value: "month" },
  { label: "This Quarter", value: "quarter" },
  { label: "Custom Date Range", value: "custom" },
];

const emptyDashboardStats = {
  monthlyRevenue: 0,
  todayRevenue: 0,
  totalRevenue: 0,
  estimatedARR: 0,
  totalUsers: 0,
  activeUsersToday: 0,
  activeWorkspaces: 0,
  processedFiles: 0,
  totalTokens: 0,
  totalTokensLimit: 0,
  apiRequestsToday: 0,
  apiErrorRate: 0,
  avgResponseTime: 0,
  uptime: 0,
  newUsers: 0,
  dau: 0,
  mau: 0,
  retentionRate: 0,
  churnRate: 0,
  todayTokens: 0,
  monthlyTokens: 0,
  estimatedAiCost: 0,
  successRequests: 0,
  failedRequests: 0,
  latency: 0,
  errorRate: 0,
  revenueByPlan: [],
};

const initialFilters = {
  timeRange: "7d",
  customStart: "",
  customEnd: "",
  lastUpdated: "",
};

const emptySystemHealth = {
  cpu: 0,
  ram: 0,
  disk: 0,
  apiUsage: 0,
  networkIn: "N/A",
  networkOut: "N/A",
  databaseStatus: "unknown",
  queueStatus: "unknown",
  webSocketStatus: "unknown",
  apiStatus: "unknown",
  tokenUsagePercent: 0,
  lastChecked: "",
  telemetryAvailable: false,
};

export default function SystemReportDashboard() {
  const [dashboardStats, setDashboardStats] = useState(emptyDashboardStats);
  const [filters, setFilters] = useState(initialFilters);
  const [revenueChartData, setRevenueChartData] = useState([]);
  const [apiUsageData, setApiUsageData] = useState([]);
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [topWorkspaces, setTopWorkspaces] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [systemHealth, setSystemHealth] = useState(emptySystemHealth);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    handleRefreshData(initialFilters, false);
  }, []);

  const maxRevenue = useMemo(
    () => Math.max(...revenueChartData.map((item) => item.revenue), 1),
    [revenueChartData],
  );

  const maxPlanRevenue = useMemo(
    () => Math.max(...dashboardStats.revenueByPlan.map((item) => item.revenue), 1),
    [dashboardStats.revenueByPlan],
  );

  const maxDau = useMemo(
    () => Math.max(...userGrowthData.map((item) => item.dau), 1),
    [userGrowthData],
  );

  const maxNewUsers = useMemo(
    () => Math.max(...userGrowthData.map((item) => item.newUsers), 1),
    [userGrowthData],
  );

  const revenueGrowth = useMemo(() => {
    const current = revenueChartData[revenueChartData.length - 1]?.revenue || 0;
    const previous = revenueChartData[revenueChartData.length - 2]?.revenue || 0;
    return calculateGrowthPercent(current, previous);
  }, [revenueChartData]);

  const hasEmptyData =
    !revenueChartData.length &&
    !apiUsageData.length &&
    !userGrowthData.length &&
    !topWorkspaces.length &&
    !systemAlerts.length &&
    !recentActivities.length;

  const riskWarnings = useMemo(() => {
    const warnings = [];

    if (systemHealth.cpu > 80) warnings.push(`CPU usage đang ở mức ${systemHealth.cpu}%.`);
    if (systemHealth.ram > 80) warnings.push(`RAM usage đang ở mức ${systemHealth.ram}%.`);
    if (systemHealth.disk > 80) warnings.push(`Disk usage đang ở mức ${systemHealth.disk}%.`);
    if (dashboardStats.apiErrorRate > 5) {
      warnings.push(`Critical: API error rate đạt ${dashboardStats.apiErrorRate}%.`);
    }
    if (systemHealth.tokenUsagePercent > 80) {
      warnings.push(`Token usage đã dùng ${systemHealth.tokenUsagePercent}% giới hạn tháng.`);
    }

    return warnings;
  }, [dashboardStats.apiErrorRate, systemHealth]);

  function applyDashboardPayload(payload = {}) {
    setDashboardStats({ ...emptyDashboardStats, ...(payload.dashboardStats || {}) });
    setRevenueChartData(Array.isArray(payload.revenueChartData) ? payload.revenueChartData : []);
    setApiUsageData(Array.isArray(payload.apiUsageData) ? payload.apiUsageData : []);
    setUserGrowthData(Array.isArray(payload.userGrowthData) ? payload.userGrowthData : []);
    setTopWorkspaces(Array.isArray(payload.topWorkspaces) ? payload.topWorkspaces : []);
    setSystemAlerts(Array.isArray(payload.systemAlerts) ? payload.systemAlerts : []);
    setRecentActivities(Array.isArray(payload.recentActivities) ? payload.recentActivities : []);
    setSystemHealth({ ...emptySystemHealth, ...(payload.systemHealth || {}) });
    setFilters((prev) => ({ ...prev, lastUpdated: payload.filters?.lastUpdated || new Date().toLocaleTimeString("vi-VN") }));
  }

  async function handleRefreshData(nextFilters = filters, showSuccessNotice = true) {
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const payload = await adminService.getSystemReportDashboard({
        timeRange: nextFilters.timeRange,
        dateFrom: nextFilters.timeRange === "custom" ? nextFilters.customStart : "",
        dateTo: nextFilters.timeRange === "custom" ? nextFilters.customEnd : "",
      });
      applyDashboardPayload(payload);
      if (showSuccessNotice) {
        setNotice(`Đã refresh dashboard từ backend lúc ${payload.filters?.lastUpdated || new Date().toLocaleTimeString("vi-VN")}.`);
      }
      return true;
    } catch (refreshError) {
      setError(refreshError.message || "Không thể tải dữ liệu báo cáo thật từ backend.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  function handleExportExcel() {
    const rows = [
      ["section", "name", "value_1", "value_2", "value_3"],
      ...Object.entries(dashboardStats)
        .filter(([, value]) => typeof value !== "object")
        .map(([key, value]) => ["kpi", key, value, "", ""]),
      ...revenueChartData.map((row) => ["revenue", row.label, row.revenue, row.previousRevenue || 0, ""]),
      ...apiUsageData.map((row) => ["api_usage", row.label, row.success, row.failed, row.tokens]),
      ...topWorkspaces.map((row) => ["workspace", row.workspace, row.apiRequests, row.tokenUsage, row.estimatedCost]),
      ...systemAlerts.map((row) => ["alert", row.type, row.source, row.severity, row.message]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `system-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("Đã export CSV từ dữ liệu backend hiện tại.");
  }

  function handleExportPDF() {
    setNotice("Backend chưa có API xuất PDF cho System Report; không tạo job tạm thời.");
  }

  async function handleCheckSystemHealth() {
    const ok = await handleRefreshData(filters, false);
    if (ok) setNotice("Đã kiểm tra system health từ backend.");
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
  }

  function getStatusBadge(status) {
    const normalized = String(status || "info").toLowerCase();
    const badges = {
      active: "bg-green-500/20 text-green-400 border-green-500/30",
      healthy: "bg-green-500/20 text-green-400 border-green-500/30",
      online: "bg-green-500/20 text-green-400 border-green-500/30",
      resolved: "bg-green-500/20 text-green-400 border-green-500/30",
      success: "bg-green-500/20 text-green-400 border-green-500/30",
      warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      monitoring: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      investigating: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      critical: "bg-red-500/20 text-red-400 border-red-500/30",
      failed: "bg-red-500/20 text-red-400 border-red-500/30",
      paused: "bg-slate-500/20 text-slate-300 border-slate-500/30",
      info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };

    return badges[normalized] || badges.info;
  }

  function getHealthColor(value) {
    if (value >= 90) return "bg-red-500";
    if (value > 80) return "bg-yellow-400";
    return "bg-green-500";
  }

  function calculateGrowthPercent(current, previous) {
    if (!previous) return 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  const Badge = ({ children, status = "info" }) => (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadge(status)}`}>
      {children}
    </span>
  );

  const Button = ({ children, variant = "secondary", className = "", ...props }) => {
    const variants = {
      primary: "bg-green-600 hover:bg-green-700 text-white",
      secondary: "bg-slate-800 hover:bg-slate-700 text-white",
      info: "bg-blue-600 hover:bg-blue-700 text-white",
    };

    return (
      <button
        className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  };

  const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-2xl bg-slate-800/70 ${className}`} />;

  const ProgressBar = ({ label, value, detail }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          {detail ? <p className="text-xs text-slate-400">{detail}</p> : null}
        </div>
        <span className="text-sm font-semibold text-slate-200">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${getHealthColor(value)}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );

  const KpiCard = ({ label, value, meta, status = "info" }) => (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${status === "critical" ? "bg-red-400" : status === "warning" ? "bg-yellow-400" : "bg-green-400"}`} />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-normal text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{meta}</p>
    </div>
  );

  const EmptyState = () => (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/80 p-10 text-center shadow">
      <p className="text-lg font-semibold text-white">Chưa có dữ liệu báo cáo</p>
      <p className="mt-2 text-sm text-slate-400">Hãy đổi bộ lọc thời gian hoặc refresh để tải lại dashboard.</p>
      <Button variant="primary" className="mt-5" onClick={() => handleRefreshData()}>
        Refresh data
      </Button>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-normal text-white">Báo cáo chung Hệ thống 📊</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Theo dõi doanh thu, người dùng, API usage, hiệu năng máy chủ và trạng thái vận hành theo thời gian thực.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge status={systemHealth.databaseStatus}>Database {systemHealth.databaseStatus}</Badge>
              <Badge status="info">Backend data</Badge>
              <Badge status={systemHealth.apiStatus}>API {systemHealth.apiStatus}</Badge>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase text-slate-400">Time filter</span>
                <select
                  value={filters.timeRange}
                  onChange={(event) => setFilters((prev) => ({ ...prev, timeRange: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-green-500"
                >
                  {TIME_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>

              {filters.timeRange === "custom" ? (
                <>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-slate-400">From</span>
                    <input
                      type="date"
                      value={filters.customStart}
                      onChange={(event) => setFilters((prev) => ({ ...prev, customStart: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-green-500"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-slate-400">To</span>
                    <input
                      type="date"
                      value={filters.customEnd}
                      onChange={(event) => setFilters((prev) => ({ ...prev, customEnd: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-green-500"
                    />
                  </label>
                </>
              ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 md:col-span-1 xl:col-span-2">
                  <p className="text-xs font-semibold uppercase text-slate-400">Last updated</p>
                  <p className="mt-1 text-sm font-semibold text-white">{filters.lastUpdated || "Chưa tải"}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => handleRefreshData()} disabled={isLoading}>
                {isLoading ? "Refreshing..." : "Refresh"}
              </Button>
              <Button variant="primary" onClick={handleExportExcel}>
                Export Excel
              </Button>
              <Button variant="info" onClick={handleExportPDF}>
                Export PDF
              </Button>
            </div>
          </div>
        </section>

        {notice ? (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300" aria-live="polite">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-red-300">Fetch lỗi</p>
                <p className="mt-1 text-red-200/80">{error}</p>
              </div>
              <Button variant="secondary" onClick={() => handleRefreshData()}>
                Thử lại
              </Button>
            </div>
          </div>
        ) : null}

        {riskWarnings.length ? (
          <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 shadow">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold text-yellow-300">Operational warnings</p>
                <p className="mt-1 text-sm text-yellow-100/80">Một số chỉ số đang vượt ngưỡng theo dõi.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {riskWarnings.map((warning) => (
                  <Badge key={warning} status={warning.startsWith("Critical") ? "critical" : "warning"}>
                    {warning}
                  </Badge>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {hasEmptyData && !isLoading ? (
          <EmptyState />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {isLoading ? (
                Array.from({ length: 13 }).map((_, index) => <Skeleton key={index} className="h-32" />)
              ) : (
                <>
                  <KpiCard label="Monthly Revenue" value={formatCurrency(dashboardStats.monthlyRevenue)} meta={`Growth ${revenueGrowth}% vs previous day`} />
                  <KpiCard label="Today Revenue" value={formatCurrency(dashboardStats.todayRevenue)} meta="Realtime paid invoices" />
                  <KpiCard label="Total Revenue" value={formatCurrency(dashboardStats.totalRevenue)} meta="Lifetime revenue" />
                  <KpiCard label="Estimated ARR" value={formatCurrency(dashboardStats.estimatedARR)} meta="Annualized recurring revenue" />
                  <KpiCard label="Total Users" value={formatNumber(dashboardStats.totalUsers)} meta={`${formatNumber(dashboardStats.newUsers)} new users`} />
                  <KpiCard label="Active Users Today" value={formatNumber(dashboardStats.activeUsersToday)} meta="DAU realtime" />
                  <KpiCard label="Active Workspaces" value={formatNumber(dashboardStats.activeWorkspaces)} meta="Workspace đang hoạt động" />
                  <KpiCard label="Processed Files" value={formatNumber(dashboardStats.processedFiles)} meta="Excel files processed" />
                  <KpiCard label="Total Tokens" value={formatNumber(dashboardStats.totalTokens)} meta={`${systemHealth.tokenUsagePercent}% monthly limit`} status={systemHealth.tokenUsagePercent > 80 ? "warning" : "success"} />
                  <KpiCard label="API Requests Today" value={formatNumber(dashboardStats.apiRequestsToday)} meta="All endpoints" />
                  <KpiCard label="API Error Rate" value={`${dashboardStats.apiErrorRate}%`} meta="Critical nếu vượt 5%" status={dashboardStats.apiErrorRate > 5 ? "critical" : "success"} />
                  <KpiCard label="Avg Response Time" value={`${dashboardStats.avgResponseTime} ms`} meta="p50 API latency" status={dashboardStats.avgResponseTime > 500 ? "warning" : "success"} />
                  <KpiCard label="Uptime" value={`${dashboardStats.uptime}%`} meta="30-day rolling SLA" />
                </>
              )}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow xl:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Revenue Analytics</h2>
                    <p className="mt-1 text-sm text-slate-400">Doanh thu theo ngày, dựng bằng div/bar không dùng chart library.</p>
                  </div>
                  <Badge status={revenueGrowth >= 0 ? "success" : "warning"}>{revenueGrowth >= 0 ? "+" : ""}{revenueGrowth}%</Badge>
                </div>

                {isLoading ? (
                  <Skeleton className="mt-6 h-72" />
                ) : revenueChartData.length ? (
                  <div className="mt-6">
                    <div className="flex h-72 items-end gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                      {revenueChartData.map((item) => (
                        <div key={item.label} className="flex h-full flex-1 flex-col justify-end gap-2">
                          <div className="flex flex-1 items-end">
                            <div
                              className="w-full rounded-t-xl bg-green-500 shadow-[0_0_24px_rgba(34,197,94,0.18)] transition-all"
                              style={{ height: `${Math.max((item.revenue / maxRevenue) * 100, 8)}%` }}
                              title={formatCurrency(item.revenue)}
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-semibold text-slate-300">{item.label}</p>
                            <p className="mt-1 text-[11px] text-slate-500">{formatCurrency(item.revenue)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState />
                )}
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow xl:col-span-2">
                <h2 className="text-lg font-bold text-white">User Analytics</h2>
                <p className="mt-1 text-sm text-slate-400">Tăng trưởng người dùng, DAU, MAU, retention và churn.</p>

                {isLoading ? (
                  <Skeleton className="mt-6 h-72" />
                ) : (
                  <div className="mt-6 space-y-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["New Users", formatNumber(dashboardStats.newUsers)],
                        ["DAU", formatNumber(dashboardStats.dau)],
                        ["MAU", formatNumber(dashboardStats.mau)],
                        ["Retention", `${dashboardStats.retentionRate}%`],
                        ["Churn", `${dashboardStats.churnRate}%`],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs text-slate-400">{label}</p>
                          <p className="mt-2 text-lg font-bold text-white">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">User growth trend</p>
                            <p className="text-xs text-slate-400">New users và DAU theo ngày</p>
                          </div>
                          <Badge status="info">{formatNumber(userGrowthData[userGrowthData.length - 1]?.mau || dashboardStats.mau)} MAU</Badge>
                        </div>
                        <div className="mt-4 flex h-28 items-end gap-2">
                          {userGrowthData.map((item) => (
                            <div key={item.label} className="flex h-full flex-1 flex-col justify-end gap-2">
                              <div className="flex flex-1 items-end justify-center gap-1">
                                <div
                                  className="w-3 rounded-t-md bg-blue-500"
                                  style={{ height: `${Math.max((item.newUsers / maxNewUsers) * 100, 8)}%` }}
                                  title={`${formatNumber(item.newUsers)} new users`}
                                />
                                <div
                                  className="w-3 rounded-t-md bg-green-500"
                                  style={{ height: `${Math.max((item.dau / maxDau) * 100, 8)}%` }}
                                  title={`${formatNumber(item.dau)} DAU`}
                                />
                              </div>
                              <p className="text-center text-[11px] font-semibold text-slate-500">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">Top active workspaces</p>
                        <Badge status="info">{topWorkspaces.length} workspaces</Badge>
                      </div>
                      {topWorkspaces.slice(0, 4).map((workspace) => (
                        <div key={workspace.workspace} className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{workspace.workspace}</p>
                            <p className="text-xs text-slate-400">{workspace.owner}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-green-400">{formatNumber(workspace.apiRequests)}</p>
                            <p className="text-xs text-slate-500">API requests</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow xl:col-span-2">
                <h2 className="text-lg font-bold text-white">AI/API Usage</h2>
                <p className="mt-1 text-sm text-slate-400">Token consumption, request health, latency và estimated AI cost.</p>

                {isLoading ? (
                  <Skeleton className="mt-6 h-72" />
                ) : (
                  <div className="mt-6 space-y-5">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <ProgressBar label="Token Usage" value={systemHealth.tokenUsagePercent} detail={`${formatNumber(dashboardStats.totalTokens)} / ${formatNumber(dashboardStats.totalTokensLimit)}`} />
                      <ProgressBar label="API Capacity" value={systemHealth.apiUsage} detail={`${formatNumber(dashboardStats.apiRequestsToday)} requests today`} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ["Today Tokens", formatNumber(dashboardStats.todayTokens)],
                        ["Monthly Tokens", formatNumber(dashboardStats.monthlyTokens)],
                        ["AI Cost", formatCurrency(dashboardStats.estimatedAiCost)],
                        ["Latency", `${dashboardStats.latency} ms`],
                        ["Success Requests", formatNumber(dashboardStats.successRequests)],
                        ["Failed Requests", formatNumber(dashboardStats.failedRequests)],
                        ["Error Rate", `${dashboardStats.errorRate}%`],
                        ["Total Tokens", formatNumber(dashboardStats.totalTokens)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs text-slate-400">{label}</p>
                          <p className="mt-2 text-base font-bold text-white">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {apiUsageData.map((item) => {
                        const total = item.success + item.failed || 1;
                        const successPercent = (item.success / total) * 100;
                        const failedPercent = (item.failed / total) * 100;

                        return (
                          <div key={item.label} className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-300">{item.label}</span>
                              <span className="text-slate-500">{formatNumber(item.tokens)} tokens</span>
                            </div>
                            <div className="flex h-2 overflow-hidden rounded-full bg-slate-800">
                              <div className="bg-green-500" style={{ width: `${successPercent}%` }} />
                              <div className="bg-red-500" style={{ width: `${failedPercent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow xl:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">System Health</h2>
                    <p className="mt-1 text-sm text-slate-400">CPU, RAM, Disk, network và trạng thái dịch vụ lõi.</p>
                  </div>
                  <Button variant="secondary" onClick={handleCheckSystemHealth}>
                    Check Health
                  </Button>
                </div>

                {isLoading ? (
                  <Skeleton className="mt-6 h-72" />
                ) : (
                  <div className="mt-6 space-y-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <ProgressBar label="CPU Usage" value={systemHealth.cpu} detail={!systemHealth.telemetryAvailable ? "Telemetry unavailable" : systemHealth.cpu > 80 ? "Warning threshold exceeded" : "Stable"} />
                      <ProgressBar label="RAM Usage" value={systemHealth.ram} detail={!systemHealth.telemetryAvailable ? "Telemetry unavailable" : systemHealth.ram > 80 ? "Warning threshold exceeded" : "Stable"} />
                      <ProgressBar label="Disk Usage" value={systemHealth.disk} detail={systemHealth.disk > 80 ? "Warning threshold exceeded" : "Stable"} />
                      <ProgressBar label="API Usage" value={systemHealth.apiUsage} detail="Gateway capacity" />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-xs text-slate-400">Network In/Out</p>
                        <p className="mt-2 text-lg font-bold text-white">{systemHealth.networkIn} / {systemHealth.networkOut}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-xs text-slate-400">Last Health Check</p>
                        <p className="mt-2 text-lg font-bold text-white">{systemHealth.lastChecked}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge status={systemHealth.databaseStatus}>Database: {systemHealth.databaseStatus}</Badge>
                      <Badge status={systemHealth.queueStatus}>Queue: {systemHealth.queueStatus}</Badge>
                      <Badge status={systemHealth.webSocketStatus}>WebSocket: {systemHealth.webSocketStatus}</Badge>
                      <Badge status={systemHealth.apiStatus}>API: {systemHealth.apiStatus}</Badge>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Top Workspace Table</h2>
                  <p className="mt-1 text-sm text-slate-400">Workspace có hoạt động cao nhất theo request, file và token usage.</p>
                </div>
                <Badge status="info">{topWorkspaces.length} records</Badge>
              </div>

              {isLoading ? (
                <Skeleton className="mt-5 h-64" />
              ) : topWorkspaces.length ? (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                    <thead className="bg-slate-950 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Workspace</th>
                        <th className="px-4 py-3">Owner</th>
                        <th className="px-4 py-3">Users</th>
                        <th className="px-4 py-3">Files</th>
                        <th className="px-4 py-3">API Requests</th>
                        <th className="px-4 py-3">Token Usage</th>
                        <th className="px-4 py-3">Estimated Cost</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {topWorkspaces.map((workspace) => (
                        <tr key={workspace.workspace} className="hover:bg-slate-800/40">
                          <td className="px-4 py-4 font-semibold text-white">{workspace.workspace}</td>
                          <td className="px-4 py-4 text-slate-300">{workspace.owner}</td>
                          <td className="px-4 py-4 text-slate-300">{formatNumber(workspace.users)}</td>
                          <td className="px-4 py-4 text-slate-300">{formatNumber(workspace.files)}</td>
                          <td className="px-4 py-4 text-slate-300">{formatNumber(workspace.apiRequests)}</td>
                          <td className="px-4 py-4 text-slate-300">{formatNumber(workspace.tokenUsage)}</td>
                          <td className="px-4 py-4 text-slate-300">{formatCurrency(workspace.estimatedCost)}</td>
                          <td className="px-4 py-4">
                            <Badge status={workspace.status}>{workspace.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState />
              )}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow xl:col-span-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">System Alerts Table</h2>
                    <p className="mt-1 text-sm text-slate-400">Cảnh báo vận hành, security, API và billing.</p>
                  </div>
                  <Badge status={!systemAlerts.length ? "info" : systemAlerts.some((alert) => alert.severity === "critical") ? "critical" : "warning"}>
                    {systemAlerts.length} alerts
                  </Badge>
                </div>

                {isLoading ? (
                  <Skeleton className="mt-5 h-72" />
                ) : systemAlerts.length ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                      <thead className="bg-slate-950 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Source</th>
                          <th className="px-4 py-3">Severity</th>
                          <th className="px-4 py-3">Message</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {systemAlerts.map((alert) => (
                          <tr key={`${alert.time}-${alert.message}`} className="hover:bg-slate-800/40">
                            <td className="px-4 py-4 text-slate-300">{alert.time}</td>
                            <td className="px-4 py-4 text-slate-300">{alert.type}</td>
                            <td className="px-4 py-4 text-slate-300">{alert.source}</td>
                            <td className="px-4 py-4">
                              <Badge status={alert.severity}>{alert.severity}</Badge>
                            </td>
                            <td className="max-w-md px-4 py-4 text-slate-300">{alert.message}</td>
                            <td className="px-4 py-4">
                              <Badge status={alert.status}>{alert.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState />
                )}
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
                <h2 className="text-lg font-bold text-white">Recent Activities</h2>
                <p className="mt-1 text-sm text-slate-400">Activity feed realtime.</p>

                {isLoading ? (
                  <Skeleton className="mt-5 h-72" />
                ) : recentActivities.length ? (
                  <div className="mt-5 space-y-4">
                    {recentActivities.map((activity) => (
                      <div key={`${activity.time}-${activity.title}`} className="relative border-l border-slate-700 pl-4">
                        <span className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full ${activity.type === "warning" ? "bg-yellow-400" : activity.type === "success" ? "bg-green-400" : "bg-blue-400"}`} />
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{activity.title}</p>
                          <span className="text-xs text-slate-500">{activity.time}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{activity.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState />
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Revenue by Plan</h2>
                  <p className="mt-1 text-sm text-slate-400">Free, Starter, Pro và Enterprise theo revenue tháng hiện tại.</p>
                </div>
                <Badge status="success">{formatCurrency(dashboardStats.monthlyRevenue)}</Badge>
              </div>

              {isLoading ? (
                <Skeleton className="mt-5 h-52" />
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {dashboardStats.revenueByPlan.map((plan) => (
                    <div key={plan.plan} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{plan.plan}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatNumber(plan.users)} users</p>
                        </div>
                        <p className="text-sm font-bold text-green-400">{formatCurrency(plan.revenue)}</p>
                      </div>
                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full rounded-full ${plan.color}`} style={{ width: `${Math.max((plan.revenue / maxPlanRevenue) * 100, plan.plan === "Free" ? 4 : 8)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
