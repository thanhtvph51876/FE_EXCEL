import React, { useEffect, useMemo, useState } from "react";
import { adminService } from "./services/adminService.js";

const defaultStats = {
  aiRequestsToday: 0,
  aiRequests24h: 0,
  aiRequests30d: 0,
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  estimatedCost: 0,
  cacheHitRate: 0,
  providerErrorRate: 0,
  blockedRequests: 0,
  quotaExceeded: 0,
  quotaRemaining: 0,
};

const defaultQuotaConfig = {
  freeDailyRequestLimit: 20,
  proDailyRequestLimit: 300,
  enterpriseDailyRequestLimit: 99999,
  monthlyTokenLimit: 10000000,
  monthlyTokenUsed: 0,
  monthlyCostBudget: 100,
  monthlyCostUsed: 0,
  dailyRequestQuota: 0,
  dailyRequestUsed: 0,
  resetTime: "",
  warningThreshold: 80,
  autoBlockOnExceeded: false,
  adminBypassQuota: true,
  enableCache: true,
  aiSystemBlocked: false,
};

const emptyCachePerformance = {
  cacheHitRate: 0,
  cacheMissRate: 0,
  cacheHits: 0,
  cacheMisses: 0,
  savedTokens: 0,
  savedCost: 0,
  avgResponseWithCache: 0,
  avgResponseWithoutCache: 0,
  telemetryAvailable: false,
};

export default function AIUsageAnalyticsDashboard() {
  const [aiUsageStats, setAiUsageStats] = useState(defaultStats);
  const [filters, setFilters] = useState({
    timeRange: "24h",
    dateFrom: "",
    dateTo: "",
    provider: "all",
    model: "all",
    workspace: "all",
  });
  const [tokenUsageByFeature, setTokenUsageByFeature] = useState([]);
  const [aiRequestsTimeline, setAiRequestsTimeline] = useState([]);
  const [quotaConfig, setQuotaConfig] = useState(defaultQuotaConfig);
  const [cachePerformance, setCachePerformance] = useState(emptyCachePerformance);
  const [providerPerformance, setProviderPerformance] = useState([]);
  const [topAiUsers, setTopAiUsers] = useState([]);
  const [providerErrors, setProviderErrors] = useState([]);
  const [aiUsageAlerts, setAiUsageAlerts] = useState([]);

  const [quotaDraft, setQuotaDraft] = useState(defaultQuotaConfig);
  const [quotaErrors, setQuotaErrors] = useState({});
  const [providerHealth, setProviderHealth] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [blockReason, setBlockReason] = useState("Bảo trì AI provider");
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dataError, setDataError] = useState("");

  const providerOptions = useMemo(() => ["all", ...new Set(providerPerformance.map((row) => row.provider).filter(Boolean))], [providerPerformance]);
  const modelOptions = useMemo(() => ["all", ...new Set(providerPerformance.map((row) => row.model).filter(Boolean))], [providerPerformance]);
  const workspaceOptions = useMemo(() => ["all", ...new Set(topAiUsers.map((row) => row.workspace).filter(Boolean))], [topAiUsers]);

  useEffect(() => {
    handleRefreshData();
  }, []);

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function formatTokens(value) {
    const number = Number(value || 0);
    if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(2)}M`;
    if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
    return number.toLocaleString("vi-VN");
  }

  function formatCost(value) {
    return `$${Number(value || 0).toFixed(6)}`;
  }

  function calculateUsagePercent(used, limit) {
    return Math.min(100, Math.round((Number(used || 0) / Math.max(1, Number(limit || 0))) * 100));
  }

  function getQuotaStatusBadge(statusOrUsed, limit = null) {
    const status = limit === null
      ? String(statusOrUsed || "normal")
      : calculateUsagePercent(statusOrUsed, limit) >= 100
        ? "exceeded"
        : calculateUsagePercent(statusOrUsed, limit) >= Number(quotaConfig.warningThreshold || 80)
          ? "highUsage"
          : "normal";
    const badges = {
      normal: "bg-green-500/20 text-green-400 border-green-500/30",
      warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      highUsage: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      exceeded: "bg-red-500/20 text-red-400 border-red-500/30",
      blocked: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return badges[status] || badges.normal;
  }

  function getProviderStatusBadge(status) {
    const badges = {
      online: "bg-green-500/20 text-green-400 border-green-500/30",
      warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      degraded: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      offline: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return badges[String(status || "online")] || badges.online;
  }

  function validateQuotaConfig(config = quotaDraft) {
    const errors = {};
    ["freeDailyRequestLimit", "proDailyRequestLimit", "enterpriseDailyRequestLimit"].forEach((key) => {
      if (Number(config[key]) <= 0) errors[key] = "Request limit phải lớn hơn 0.";
    });
    if (Number(config.monthlyTokenLimit) <= 0) errors.monthlyTokenLimit = "Token limit phải lớn hơn 0.";
    if (Number(config.monthlyCostBudget) < 0) errors.monthlyCostBudget = "Cost budget phải lớn hơn hoặc bằng 0.";
    if (Number(config.warningThreshold) < 1 || Number(config.warningThreshold) > 100) {
      errors.warningThreshold = "Warning threshold phải từ 1 đến 100.";
    }
    if (config.autoBlockOnExceeded && Number(config.monthlyTokenLimit) <= 0) {
      errors.autoBlockOnExceeded = "Auto block chỉ được bật khi quota limit tồn tại.";
    }
    setQuotaErrors(errors);
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  async function handleRefreshData(nextFilters = filters) {
    setIsLoading(true);
    setDataError("");
    try {
      const payload = await adminService.getAiCostDashboard({
        timeRange: nextFilters.timeRange,
        dateFrom: nextFilters.dateFrom,
        dateTo: nextFilters.dateTo,
        provider: nextFilters.provider,
        model: nextFilters.model,
        workspace: nextFilters.workspace,
      });
      setAiUsageStats({ ...defaultStats, ...(payload.aiUsageStats || {}) });
      setTokenUsageByFeature(Array.isArray(payload.tokenUsageByFeature) ? payload.tokenUsageByFeature : []);
      setAiRequestsTimeline(Array.isArray(payload.aiRequestsTimeline) ? payload.aiRequestsTimeline : []);
      setQuotaConfig({ ...defaultQuotaConfig, ...(payload.quotaConfig || {}) });
      setQuotaDraft({ ...defaultQuotaConfig, ...(payload.quotaConfig || {}) });
      setCachePerformance({ ...emptyCachePerformance, ...(payload.cachePerformance || {}) });
      setProviderPerformance(Array.isArray(payload.providerPerformance) ? payload.providerPerformance : []);
      setTopAiUsers(Array.isArray(payload.topAiUsers) ? payload.topAiUsers : []);
      setProviderErrors(Array.isArray(payload.providerErrors) ? payload.providerErrors : []);
      setAiUsageAlerts(Array.isArray(payload.aiUsageAlerts) ? payload.aiUsageAlerts : []);
    } catch (error) {
      setDataError(error.message || "Không thể tải dữ liệu AI usage từ backend.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleExportAIUsage() {
    const rows = [
      ["section", "name", "requests", "tokens", "cost", "status"],
      ...tokenUsageByFeature.map((row) => ["feature", row.feature || row.featureName, row.requests, row.totalTokens, row.estimatedCost, row.trend]),
      ...providerPerformance.map((row) => ["provider", `${row.provider} ${row.model}`, row.requests, row.totalTokens, row.estimatedCost, row.status]),
      ...topAiUsers.map((row) => ["user", `${row.user} ${row.email}`, row.requests, row.tokens, row.estimatedCost, row.quotaStatus]),
      ...providerErrors.map((row) => ["error", `${row.provider} ${row.model}`, "", "", "", row.status]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Đã export AI usage từ dữ liệu backend.");
  }

  async function handleSaveQuotaConfig() {
    const validation = validateQuotaConfig();
    if (!validation.isValid) {
      showToast("Vui lòng kiểm tra cấu hình quota.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const payload = await adminService.saveAiQuotaConfig({
        freeDailyRequestLimit: Number(quotaDraft.freeDailyRequestLimit),
        proDailyRequestLimit: Number(quotaDraft.proDailyRequestLimit),
        enterpriseDailyRequestLimit: Number(quotaDraft.enterpriseDailyRequestLimit),
        monthlyTokenLimit: Number(quotaDraft.monthlyTokenLimit),
        monthlyCostBudget: Number(quotaDraft.monthlyCostBudget),
        warningThreshold: Number(quotaDraft.warningThreshold),
        autoBlockOnExceeded: Boolean(quotaDraft.autoBlockOnExceeded),
        adminBypassQuota: Boolean(quotaDraft.adminBypassQuota),
        enableCache: Boolean(quotaDraft.enableCache),
      });
      setQuotaConfig({ ...quotaConfig, ...(payload.quotaConfig || {}) });
      setActiveModal(null);
      showToast("Đã lưu quota config vào backend.");
      await handleRefreshData();
    } catch (error) {
      showToast(error.message || "Không thể lưu quota config.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCheckProvider() {
    if (!filters.provider || filters.provider === "all") {
      showToast("Provider không được rỗng khi kiểm tra.", "error");
      return;
    }
    if (!filters.model || filters.model === "all") {
      showToast("Model không được rỗng khi kiểm tra.", "error");
      return;
    }
    try {
      const health = await adminService.checkAiProvider();
      setProviderHealth(health);
      showToast(`Provider health: ${health.status || "ok"}`);
    } catch (error) {
      showToast(error.message || "Không thể kiểm tra provider.", "error");
    }
  }

  async function handleClearCache() {
    setIsSaving(true);
    try {
      await adminService.clearAiCache();
      showToast("Đã ghi nhận thao tác clear cache trên backend.");
      await handleRefreshData();
    } catch (error) {
      showToast(error.message || "Không thể clear cache.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBlockAISystem(confirmed = false) {
    if (!confirmed) {
      setActiveModal("confirmBlock");
      return;
    }
    setIsSaving(true);
    try {
      await adminService.blockAiSystem(blockReason);
      setActiveModal(null);
      showToast("Đã tạm chặn AI toàn hệ thống trên backend.");
      await handleRefreshData();
    } catch (error) {
      showToast(error.message || "Không thể tạm chặn AI.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnblockAISystem() {
    setIsSaving(true);
    try {
      await adminService.unblockAiSystem();
      showToast("Đã mở chặn AI toàn hệ thống.");
      await handleRefreshData();
    } catch (error) {
      showToast(error.message || "Không thể mở chặn AI.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const Button = ({ children, variant = "secondary", className = "", ...props }) => {
    const variants = {
      primary: "bg-green-600 hover:bg-green-700 text-white border border-green-600",
      secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700",
      info: "bg-blue-600 hover:bg-blue-700 text-white border border-blue-600",
      danger: "bg-transparent border border-red-500 text-red-400 hover:bg-red-500/10",
    };
    return <button className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>{children}</button>;
  };

  const Badge = ({ children, className = "" }) => <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;

  const Input = ({ label, error, className = "", ...props }) => (
    <label className={`space-y-2 ${className}`}>
      <span className="text-xs font-semibold uppercase text-slate-400">{label}</span>
      <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition placeholder:text-slate-600 focus:border-green-500" {...props} />
      {error ? <span className="block text-xs text-red-400">{error}</span> : null}
    </label>
  );

  const Select = ({ label, children, className = "", ...props }) => (
    <label className={`space-y-2 ${className}`}>
      <span className="text-xs font-semibold uppercase text-slate-400">{label}</span>
      <select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-green-500" {...props}>{children}</select>
    </label>
  );

  const Toggle = ({ checked, onChange, label }) => (
    <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-slate-700 bg-slate-900 accent-green-600" />
      {label}
    </label>
  );

  const Modal = ({ title, children, size = "max-w-3xl" }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl ${size}`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button type="button" onClick={() => setActiveModal(null)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1 text-sm font-semibold text-slate-300 hover:bg-slate-800">Close</button>
        </div>
        {children}
      </div>
    </div>
  );

  const StatCard = ({ label, value, hint, status = "normal" }) => (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <Badge className={getQuotaStatusBadge(status)}>{status}</Badge>
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );

  const ProgressBar = ({ value, max, label }) => {
    const percent = calculateUsagePercent(value, max);
    const color = percent >= 100 ? "bg-red-500" : percent >= Number(quotaConfig.warningThreshold || 80) ? "bg-orange-400" : "bg-green-500";
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  };

  const maxTimelineTotal = Math.max(1, ...aiRequestsTimeline.map((row) => Number(row.total || 0)));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      {toast ? (
        <div className={`fixed right-4 top-4 z-[60] rounded-2xl border px-4 py-3 text-sm shadow-2xl ${toast.type === "error" ? "border-red-500/40 bg-red-500/15 text-red-200" : "border-green-500/40 bg-green-500/15 text-green-200"}`}>
          {toast.message}
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-normal text-white">Phân tích Lượt gọi & Hạn mức AI Usage 🤖</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
                Theo dõi lượt gọi AI, token tiêu thụ, chi phí ước tính, cache hit rate, quota và lỗi provider theo thời gian thực.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className={getProviderStatusBadge(providerHealth?.status === "degraded" ? "degraded" : "online")}>AI Provider Online</Badge>
                <Badge className={getQuotaStatusBadge(aiUsageStats.quotaExceeded ? "exceeded" : "normal")}>Quota {aiUsageStats.quotaExceeded ? "Exceeded" : "Normal"}</Badge>
                <Badge className={quotaConfig.enableCache ? "border-purple-500/30 bg-purple-500/20 text-purple-400" : "border-slate-500/30 bg-slate-500/20 text-slate-300"}>Cache {quotaConfig.enableCache ? "Enabled" : "Disabled"}</Badge>
                {quotaConfig.aiSystemBlocked ? <Badge className={getQuotaStatusBadge("blocked")}>AI System Blocked</Badge> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setQuotaDraft(quotaConfig); setActiveModal("quota"); }}>Quota config</Button>
              <Button variant="info" onClick={handleCheckProvider}>Check provider</Button>
              <Button onClick={handleClearCache} disabled={isSaving}>Clear cache</Button>
              {quotaConfig.aiSystemBlocked ? (
                <Button variant="primary" onClick={handleUnblockAISystem} disabled={isSaving}>Unblock AI</Button>
              ) : (
                <Button variant="danger" onClick={() => handleBlockAISystem(false)} disabled={isSaving}>Block AI system</Button>
              )}
            </div>
          </div>
        </header>

        {dataError ? <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{dataError}</div> : null}
        {isLoading ? <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200">Đang tải dữ liệu thật từ backend...</div> : null}

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Select label="timeRange" value={filters.timeRange} onChange={(event) => setFilters((prev) => ({ ...prev, timeRange: event.target.value }))}>
              <option value="24h">24h</option>
              <option value="7d">7 ngày</option>
              <option value="30d">30 ngày</option>
              <option value="90d">90 ngày</option>
            </Select>
            <Input label="dateFrom" type="date" value={filters.dateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} />
            <Input label="dateTo" type="date" value={filters.dateTo} onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))} />
            <Select label="providerFilter" value={filters.provider} onChange={(event) => setFilters((prev) => ({ ...prev, provider: event.target.value }))}>
              {providerOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select label="modelFilter" value={filters.model} onChange={(event) => setFilters((prev) => ({ ...prev, model: event.target.value }))}>
              {modelOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select label="workspaceFilter" value={filters.workspace} onChange={(event) => setFilters((prev) => ({ ...prev, workspace: event.target.value }))}>
              {workspaceOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <div className="flex items-end gap-2 xl:col-span-2">
              <Button className="w-full" variant="primary" onClick={() => handleRefreshData()} disabled={isLoading}>Refresh</Button>
              <Button className="w-full" onClick={handleExportAIUsage}>Export</Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="AI requests today" value={aiUsageStats.aiRequestsToday.toLocaleString("vi-VN")} hint="Từ 00:00 hôm nay" />
          <StatCard label="AI requests 24h" value={aiUsageStats.aiRequests24h.toLocaleString("vi-VN")} hint="Cửa sổ 24 giờ gần nhất" />
          <StatCard label="AI requests 30d" value={aiUsageStats.aiRequests30d.toLocaleString("vi-VN")} hint="30 ngày gần nhất" />
          <StatCard label="Total tokens" value={formatTokens(aiUsageStats.totalTokens)} hint={`${formatTokens(aiUsageStats.inputTokens)} input · ${formatTokens(aiUsageStats.outputTokens)} output`} />
          <StatCard label="Estimated cost" value={formatCost(aiUsageStats.estimatedCost)} hint="Theo event estimated_cost" />
          <StatCard label="Cache hit rate" value={`${Number(aiUsageStats.cacheHitRate || 0).toFixed(2)}%`} hint={cachePerformance.telemetryAvailable ? "Cache telemetry" : "Chưa có cache telemetry"} />
          <StatCard label="Provider error rate" value={`${Number(aiUsageStats.providerErrorRate || 0).toFixed(2)}%`} hint="failed / total" status={aiUsageStats.providerErrorRate >= 10 ? "warning" : "normal"} />
          <StatCard label="Quota remaining" value={aiUsageStats.quotaRemaining.toLocaleString("vi-VN")} hint="Daily quota còn lại" status={aiUsageStats.quotaExceeded ? "exceeded" : "normal"} />
          <StatCard label="Blocked requests" value={aiUsageStats.blockedRequests.toLocaleString("vi-VN")} hint="status=blocked" status={aiUsageStats.blockedRequests ? "blocked" : "normal"} />
          <StatCard label="Quota exceeded" value={aiUsageStats.quotaExceeded.toLocaleString("vi-VN")} hint="status=quota_exceeded" status={aiUsageStats.quotaExceeded ? "exceeded" : "normal"} />
          <StatCard label="Input tokens" value={formatTokens(aiUsageStats.inputTokens)} hint="Tổng input tokens" />
          <StatCard label="Output tokens" value={formatTokens(aiUsageStats.outputTokens)} hint="Tổng output tokens" />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow xl:col-span-2">
            <h2 className="text-lg font-bold text-white">Quota & Limits</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <ProgressBar label="Daily request quota" value={quotaConfig.dailyRequestUsed} max={quotaConfig.dailyRequestQuota} />
              <ProgressBar label="Monthly token limit" value={quotaConfig.monthlyTokenUsed} max={quotaConfig.monthlyTokenLimit} />
              <ProgressBar label="Monthly cost budget" value={quotaConfig.monthlyCostUsed} max={quotaConfig.monthlyCostBudget} />
            </div>
            <p className="mt-4 text-sm text-slate-400">Reset time: {quotaConfig.resetTime ? new Date(quotaConfig.resetTime).toLocaleString("vi-VN") : "N/A"} · Warning threshold {quotaConfig.warningThreshold}% · Auto block {quotaConfig.autoBlockOnExceeded ? "on" : "off"}</p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
            <h2 className="text-lg font-bold text-white">Cache Performance</h2>
            <div className="mt-4 space-y-3 text-sm">
              <ProgressBar label="Cache hit rate" value={cachePerformance.cacheHitRate} max={100} />
              <p className="text-slate-400">Hits: {cachePerformance.cacheHits} · Misses: {cachePerformance.cacheMisses}</p>
              <p className="text-slate-400">Saved: {formatTokens(cachePerformance.savedTokens)} tokens · {formatCost(cachePerformance.savedCost)}</p>
              <p className="text-slate-400">Avg latency: {cachePerformance.avgResponseWithCache}ms cached · {cachePerformance.avgResponseWithoutCache}ms uncached</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
          <h2 className="text-lg font-bold text-white">AI Requests Timeline</h2>
          <div className="mt-5 flex h-56 items-end gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4">
            {aiRequestsTimeline.length ? aiRequestsTimeline.map((row) => {
              const height = Math.max(8, Math.round((Number(row.total || 0) / maxTimelineTotal) * 180));
              return (
                <div key={row.time} className="flex min-w-[56px] flex-col items-center gap-2">
                  <div className="flex h-[180px] items-end">
                    <div className="w-8 overflow-hidden rounded-t-lg bg-slate-800" style={{ height }}>
                      <div className="bg-green-500" style={{ height: `${calculateUsagePercent(row.success, row.total)}%` }} />
                      <div className="bg-red-500" style={{ height: `${calculateUsagePercent(row.error, row.total)}%` }} />
                      <div className="bg-orange-400" style={{ height: `${calculateUsagePercent(row.blocked, row.total)}%` }} />
                    </div>
                  </div>
                  <span className="max-w-[64px] truncate text-[10px] text-slate-500" title={row.time}>{row.time}</span>
                </div>
              );
            }) : <p className="self-center text-sm text-slate-400">Chưa có timeline AI usage từ backend.</p>}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <TableCard title="Token Usage By Feature" empty="Chưa có dữ liệu token theo tính năng." rowCount={tokenUsageByFeature.length}>
            <thead className="bg-slate-950 text-xs uppercase text-slate-400">
              <tr><th className="px-4 py-3">Feature</th><th className="px-4 py-3">Requests</th><th className="px-4 py-3">Input</th><th className="px-4 py-3">Output</th><th className="px-4 py-3">Tokens</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">%</th><th className="px-4 py-3">Trend</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tokenUsageByFeature.map((row) => (
                <tr key={row.feature || row.featureName} className="hover:bg-slate-800/40">
                  <td className="px-4 py-4 font-semibold text-white">{row.feature || row.featureName}</td>
                  <td className="px-4 py-4 text-slate-300">{Number(row.requests || row.requestCount || 0).toLocaleString("vi-VN")}</td>
                  <td className="px-4 py-4 text-slate-300">{formatTokens(row.inputTokens)}</td>
                  <td className="px-4 py-4 text-slate-300">{formatTokens(row.outputTokens)}</td>
                  <td className="px-4 py-4 text-slate-300">{formatTokens(row.totalTokens)}</td>
                  <td className="px-4 py-4 text-slate-300">{formatCost(row.estimatedCost)}</td>
                  <td className="px-4 py-4 text-slate-300">{Number(row.percentage || 0).toFixed(2)}%</td>
                  <td className="px-4 py-4 text-slate-300">{row.trend || "stable"}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>

          <TableCard title="Provider / Model Performance" empty="Chưa có dữ liệu provider performance." rowCount={providerPerformance.length}>
            <thead className="bg-slate-950 text-xs uppercase text-slate-400">
              <tr><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Model</th><th className="px-4 py-3">Requests</th><th className="px-4 py-3">Success</th><th className="px-4 py-3">Error</th><th className="px-4 py-3">Latency</th><th className="px-4 py-3">Total Tokens</th><th className="px-4 py-3">Estimated Cost</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {providerPerformance.map((row) => (
                <tr key={`${row.provider}-${row.model}`} className="hover:bg-slate-800/40">
                  <td className="px-4 py-4 font-semibold text-white">{row.provider}</td>
                  <td className="px-4 py-4 text-slate-300">{row.model}</td>
                  <td className="px-4 py-4 text-slate-300">{Number(row.requests || 0).toLocaleString("vi-VN")}</td>
                  <td className="px-4 py-4 text-green-300">{Number(row.successRate || 0).toFixed(2)}%</td>
                  <td className="px-4 py-4 text-red-300">{Number(row.errorRate || 0).toFixed(2)}%</td>
                  <td className="px-4 py-4 text-slate-300">{Number(row.avgLatency || 0).toFixed(0)}ms</td>
                  <td className="px-4 py-4 text-slate-300">{formatTokens(row.totalTokens)}</td>
                  <td className="px-4 py-4 text-slate-300">{formatCost(row.estimatedCost)}</td>
                  <td className="px-4 py-4"><Badge className={getProviderStatusBadge(row.status)}>{row.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <TableCard title="Top AI Users / Workspaces" empty="Chưa có top user AI usage." rowCount={topAiUsers.length}>
            <thead className="bg-slate-950 text-xs uppercase text-slate-400">
              <tr><th className="px-4 py-3">Workspace</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Requests</th><th className="px-4 py-3">Tokens</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Top Feature</th><th className="px-4 py-3">Quota</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {topAiUsers.map((row) => (
                <tr key={`${row.email}-${row.workspace}`} className="hover:bg-slate-800/40">
                  <td className="px-4 py-4 text-slate-300">{row.workspace}</td>
                  <td className="px-4 py-4 font-semibold text-white">{row.user}</td>
                  <td className="px-4 py-4 text-slate-300">{row.email}</td>
                  <td className="px-4 py-4 text-slate-300">{Number(row.requests || 0).toLocaleString("vi-VN")}</td>
                  <td className="px-4 py-4 text-slate-300">{formatTokens(row.tokens)}</td>
                  <td className="px-4 py-4 text-slate-300">{formatCost(row.estimatedCost)}</td>
                  <td className="px-4 py-4 text-slate-300">{row.topFeature}</td>
                  <td className="px-4 py-4"><Badge className={getQuotaStatusBadge(row.quotaStatus)}>{row.quotaStatus}</Badge></td>
                  <td className="px-4 py-4">
                    <Button className="px-3 py-1 text-xs" onClick={() => {
                      const nextFilters = { ...filters, workspace: row.workspace || "all" };
                      setFilters(nextFilters);
                      handleRefreshData(nextFilters);
                    }}>Lọc</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>

          <TableCard title="Provider Errors" empty="Không có lỗi provider trong khoảng lọc." rowCount={providerErrors.length}>
            <thead className="bg-slate-950 text-xs uppercase text-slate-400">
              <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Model</th><th className="px-4 py-3">Feature</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Message</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {providerErrors.map((row, index) => (
                <tr key={`${row.time}-${index}`} className="hover:bg-slate-800/40">
                  <td className="px-4 py-4 text-slate-300">{row.time ? new Date(row.time).toLocaleString("vi-VN") : "N/A"}</td>
                  <td className="px-4 py-4 font-semibold text-white">{row.provider}</td>
                  <td className="px-4 py-4 text-slate-300">{row.model}</td>
                  <td className="px-4 py-4 text-slate-300">{row.feature}</td>
                  <td className="px-4 py-4 text-slate-300">{row.user}</td>
                  <td className="px-4 py-4 text-slate-300">{row.errorCode}</td>
                  <td className="max-w-xs px-4 py-4 text-slate-300">{row.message}</td>
                  <td className="px-4 py-4"><Badge className={getQuotaStatusBadge(row.severity === "high" ? "exceeded" : "warning")}>{row.severity}</Badge></td>
                  <td className="px-4 py-4 text-slate-300">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
          <h2 className="text-lg font-bold text-white">AI Usage Alerts</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {aiUsageAlerts.length ? aiUsageAlerts.map((alert) => (
              <div key={`${alert.title}-${alert.detail}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">{alert.title}</p>
                  <Badge className={getQuotaStatusBadge(alert.severity)}>{alert.severity}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-400">{alert.detail}</p>
              </div>
            )) : <p className="text-sm text-slate-400">Không có alert AI usage trong khoảng lọc.</p>}
          </div>
        </section>
      </div>

      {activeModal === "quota" ? (
        <Modal title="Quota Config" size="max-w-4xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="freeDailyRequestLimit" type="number" value={quotaDraft.freeDailyRequestLimit} error={quotaErrors.freeDailyRequestLimit} onChange={(event) => setQuotaDraft((prev) => ({ ...prev, freeDailyRequestLimit: event.target.value }))} />
            <Input label="proDailyRequestLimit" type="number" value={quotaDraft.proDailyRequestLimit} error={quotaErrors.proDailyRequestLimit} onChange={(event) => setQuotaDraft((prev) => ({ ...prev, proDailyRequestLimit: event.target.value }))} />
            <Input label="enterpriseDailyRequestLimit" type="number" value={quotaDraft.enterpriseDailyRequestLimit} error={quotaErrors.enterpriseDailyRequestLimit} onChange={(event) => setQuotaDraft((prev) => ({ ...prev, enterpriseDailyRequestLimit: event.target.value }))} />
            <Input label="monthlyTokenLimit" type="number" value={quotaDraft.monthlyTokenLimit} error={quotaErrors.monthlyTokenLimit} onChange={(event) => setQuotaDraft((prev) => ({ ...prev, monthlyTokenLimit: event.target.value }))} />
            <Input label="monthlyCostBudget" type="number" value={quotaDraft.monthlyCostBudget} error={quotaErrors.monthlyCostBudget} onChange={(event) => setQuotaDraft((prev) => ({ ...prev, monthlyCostBudget: event.target.value }))} />
            <Input label="warningThreshold" type="number" value={quotaDraft.warningThreshold} error={quotaErrors.warningThreshold} onChange={(event) => setQuotaDraft((prev) => ({ ...prev, warningThreshold: event.target.value }))} />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Toggle checked={Boolean(quotaDraft.autoBlockOnExceeded)} onChange={(event) => setQuotaDraft((prev) => ({ ...prev, autoBlockOnExceeded: event.target.checked }))} label="autoBlockOnExceeded" />
            <Toggle checked={Boolean(quotaDraft.adminBypassQuota)} onChange={(event) => setQuotaDraft((prev) => ({ ...prev, adminBypassQuota: event.target.checked }))} label="adminBypassQuota" />
            <Toggle checked={Boolean(quotaDraft.enableCache)} onChange={(event) => setQuotaDraft((prev) => ({ ...prev, enableCache: event.target.checked }))} label="enableCache" />
          </div>
          {quotaErrors.autoBlockOnExceeded ? <p className="mt-3 text-sm text-red-400">{quotaErrors.autoBlockOnExceeded}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setActiveModal(null)}>Hủy</Button>
            <Button variant="primary" onClick={handleSaveQuotaConfig} disabled={isSaving}>{isSaving ? "Đang lưu..." : "Lưu quota config"}</Button>
          </div>
        </Modal>
      ) : null}

      {activeModal === "confirmBlock" ? (
        <Modal title="Xác nhận tạm chặn AI toàn hệ thống" size="max-w-xl">
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">Không cho tạm chặn AI toàn hệ thống nếu chưa xác nhận. Hành động này sẽ ghi setting backend và chặn các API AI cho user thường.</p>
            <Input className="mt-4" label="reason" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setActiveModal(null)}>Hủy</Button>
            <Button variant="danger" onClick={() => handleBlockAISystem(true)} disabled={isSaving}>{isSaving ? "Đang chặn..." : "Xác nhận chặn AI"}</Button>
          </div>
        </Modal>
      ) : null}
    </main>
  );

  function TableCard({ title, children, empty, rowCount = 0 }) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            {children}
          </table>
          {!rowCount ? <p className="mt-4 text-sm text-slate-400">{empty}</p> : null}
        </div>
      </div>
    );
  }
}
