import React, { useEffect, useMemo, useState } from "react";
import { adminService } from "./services/adminService.js";

const emptyPrompt = {
  promptName: "",
  promptKey: "",
  feature: "chatbot",
  description: "",
  systemPrompt: "",
  promptTemplate: "",
  allowedVariables: [],
  outputFormatRules: "",
  defaultLanguage: "vi",
  tone: "professional",
  status: "Draft",
  environment: "Development",
  changeNote: "",
};

const defaultRouting = {
  freeChatLimitPerDay: 20,
  proChatLimitPerDay: 300,
  enterpriseChatLimitPerDay: 99999,
  defaultModel: "gemini-1.5-flash",
  fallbackModel: "gemini-1.5-flash",
  temperature: 0.4,
  maxTokens: 4096,
  topP: 0.95,
  timeoutSeconds: 45,
  retryCount: 2,
  enableStreaming: true,
  enableCache: true,
  cacheTTL: 3600,
  enablePromptLogging: true,
  enableOutputModeration: true,
};

const defaultPlayground = {
  selectedPrompt: "",
  sampleInput: "",
  selectedModel: "gemini-1.5-flash",
  temperature: 0.4,
  maxTokens: 2048,
  outputLanguage: "vi",
  output: "",
  inputTokens: 0,
  outputTokens: 0,
  latency: 0,
  estimatedCost: 0,
  testStatus: "idle",
};

const featureTabs = ["Chatbot", "Formula Generator", "VBA/Macro", "AI Checker", "Data Reconciliation", "Table Builder", "Document Builder", "Autopilot", "Report Generator"];

export default function SystemPromptsManagementDashboard() {
  const [prompts, setPrompts] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState(emptyPrompt);
  const [promptSettings, setPromptSettings] = useState({});
  const [aiRoutingSettings, setAiRoutingSettings] = useState(defaultRouting);
  const [promptVariables, setPromptVariables] = useState([]);
  const [promptVersions, setPromptVersions] = useState([]);
  const [safetyRules, setSafetyRules] = useState([]);
  const [promptAnalytics, setPromptAnalytics] = useState({});
  const [promptChangeLogs, setPromptChangeLogs] = useState([]);
  const [playgroundState, setPlaygroundState] = useState(defaultPlayground);

  const [filters, setFilters] = useState({ search: "", featureFilter: "all", statusFilter: "all", environmentFilter: "all", updatedByFilter: "" });
  const [abTestState, setAbTestState] = useState({ promptA: "", promptB: "", trafficSplit: 50, feature: "chatbot", testDuration: 7, metric: "success_rate", status: "draft" });
  const [activeModal, setActiveModal] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [promptStats, setPromptStats] = useState({});

  useEffect(() => {
    handleRefresh();
  }, []);

  const filteredPrompts = useMemo(() => {
    return prompts.filter((prompt) => {
      const text = `${prompt.promptName} ${prompt.promptKey} ${prompt.description}`.toLowerCase();
      if (filters.search && !text.includes(filters.search.toLowerCase())) return false;
      if (filters.featureFilter !== "all" && prompt.feature !== filters.featureFilter) return false;
      if (filters.statusFilter !== "all" && prompt.status !== filters.statusFilter) return false;
      if (filters.environmentFilter !== "all" && prompt.environment !== filters.environmentFilter) return false;
      if (filters.updatedByFilter && !String(prompt.updatedBy || "").toLowerCase().includes(filters.updatedByFilter.toLowerCase())) return false;
      return true;
    });
  }, [filters, prompts]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function countPromptTokens(text) {
    return String(text || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function highlightPromptVariables(text) {
    const escaped = String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.replace(/\{\{[^}]+\}\}/g, (match) => `<mark class="rounded bg-purple-500/20 px-1 text-purple-200">${match}</mark>`);
  }

  function getPromptStatusBadge(status) {
    const map = {
      Active: "border-green-500/30 bg-green-500/20 text-green-400",
      Draft: "border-yellow-500/30 bg-yellow-500/20 text-yellow-400",
      Testing: "border-blue-500/30 bg-blue-500/20 text-blue-400",
      Disabled: "border-red-500/30 bg-red-500/20 text-red-400",
      Deprecated: "border-slate-500/30 bg-slate-500/20 text-slate-300",
    };
    return map[status] || map.Draft;
  }

  function getEnvironmentBadge(environment) {
    const map = {
      Production: "border-purple-500/30 bg-purple-500/20 text-purple-400",
      Staging: "border-orange-500/30 bg-orange-500/20 text-orange-400",
      Development: "border-blue-500/30 bg-blue-500/20 text-blue-400",
    };
    return map[environment] || map.Development;
  }

  function validatePromptForm(prompt = selectedPrompt) {
    const errors = {};
    const key = String(prompt.promptKey || "").trim();
    if (!String(prompt.promptName || "").trim()) errors.promptName = "promptName không được rỗng.";
    if (!key) errors.promptKey = "promptKey không được rỗng.";
    if (prompts.some((item) => item.promptKey === key) && key !== selectedPrompt.promptKey) errors.promptKey = "promptKey không được trùng.";
    if (!String(prompt.systemPrompt || "").trim()) errors.systemPrompt = "systemPrompt không được rỗng.";
    if (prompt.status === "Active" && prompt.environment === "Production" && !prompt.lastTestedAt) errors.status = "Production prompt phải được test trước khi active.";
    const requiredMissing = promptVariables.filter((item) => item.required && !String(prompt.systemPrompt || "").includes(item.key));
    if (requiredMissing.length) errors.systemPrompt = `Prompt thiếu required variables: ${requiredMissing.map((item) => item.key).join(", ")}`;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateRoutingSettings(settings = aiRoutingSettings) {
    const errors = {};
    if (Number(settings.temperature) < 0 || Number(settings.temperature) > 2) errors.temperature = "Temperature phải từ 0 đến 2.";
    if (Number(settings.maxTokens) <= 0) errors.maxTokens = "Max tokens phải lớn hơn 0.";
    if (Number(settings.timeoutSeconds) <= 0) errors.timeoutSeconds = "Timeout phải lớn hơn 0.";
    if (Number(settings.freeChatLimitPerDay) < 0) errors.freeChatLimitPerDay = "Free chat limit phải >= 0.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleRefresh() {
    setIsLoading(true);
    try {
      const payload = await adminService.getPromptDashboard();
      setPrompts(Array.isArray(payload.prompts) ? payload.prompts : []);
      setSelectedPrompt(payload.selectedPrompt || emptyPrompt);
      setPromptSettings(payload.promptSettings || {});
      setAiRoutingSettings({ ...defaultRouting, ...(payload.aiRoutingSettings || {}) });
      setPromptVariables(Array.isArray(payload.promptVariables) ? payload.promptVariables : []);
      setPromptVersions(Array.isArray(payload.promptVersions) ? payload.promptVersions : []);
      setSafetyRules(Array.isArray(payload.safetyRules) ? payload.safetyRules : []);
      setPromptAnalytics(payload.promptAnalytics || {});
      setPromptChangeLogs(Array.isArray(payload.promptChangeLogs) ? payload.promptChangeLogs : []);
      setPlaygroundState({ ...defaultPlayground, ...(payload.playgroundState || {}) });
      setPromptStats(payload.promptStats || {});
    } catch (error) {
      showToast(error.message || "Không thể tải dữ liệu prompt thật.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreatePrompt() {
    const draft = { ...emptyPrompt, promptKey: `prompt_${Date.now()}`, promptName: "Prompt mới", updatedBy: "admin" };
    setSelectedPrompt(draft);
    setActiveModal("editor");
  }

  async function handleUpdatePrompt(confirmProduction = false) {
    if (!validatePromptForm()) return;
    if (selectedPrompt.environment === "Production" && !confirmProduction) {
      setConfirmAction({ type: "updateProduction" });
      setActiveModal("confirm");
      return;
    }
    setIsSaving(true);
    try {
      const exists = prompts.some((prompt) => prompt.promptKey === selectedPrompt.promptKey);
      const payload = exists
        ? await adminService.updatePrompt(selectedPrompt.promptKey, selectedPrompt)
        : await adminService.createPrompt(selectedPrompt);
      setSelectedPrompt(payload.prompt || selectedPrompt);
      setActiveModal(null);
      showToast("Đã lưu prompt vào backend.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể lưu prompt.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeletePrompt(prompt = selectedPrompt) {
    setConfirmAction({ type: "deletePrompt", payload: prompt });
    setActiveModal("confirm");
  }

  async function handleDuplicatePrompt(prompt = selectedPrompt) {
    setIsSaving(true);
    try {
      await adminService.duplicatePrompt(prompt.promptKey);
      showToast("Đã duplicate prompt.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể duplicate prompt.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestPrompt(nextPlayground = playgroundState) {
    setIsSaving(true);
    try {
      const result = await adminService.testPrompt(nextPlayground);
      setPlaygroundState((prev) => ({ ...prev, ...nextPlayground, ...result }));
      if (selectedPrompt.promptKey === nextPlayground.selectedPrompt) {
        setSelectedPrompt((prev) => ({ ...prev, lastTestedAt: new Date().toISOString() }));
      }
      showToast(result.testStatus === "success" ? "Prompt test thành công." : "Prompt test lỗi provider.", result.testStatus === "success" ? "success" : "error");
    } catch (error) {
      showToast(error.message || "Không thể test prompt.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleComparePromptVersion(version = promptVersions[0]) {
    if (!version) return;
    setPlaygroundState((prev) => ({ ...prev, output: JSON.stringify({ current: selectedPrompt, version: version.snapshot }, null, 2), testStatus: "diff" }));
  }

  async function handleRollbackVersion(version, confirmed = false) {
    if (!confirmed) {
      setConfirmAction({ type: "rollback", payload: version });
      setActiveModal("confirm");
      return;
    }
    setIsSaving(true);
    try {
      await adminService.rollbackPromptVersion(version.versionId);
      showToast("Đã rollback prompt version.");
      setActiveModal(null);
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể rollback.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetActiveVersion(version) {
    setIsSaving(true);
    try {
      await adminService.setActivePromptVersion(version.versionId);
      showToast("Đã set active version.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể set active version.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleExportPrompts() {
    const blob = new Blob([JSON.stringify({ prompts, promptSettings, aiRoutingSettings, safetyRules }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-prompts-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Đã export cấu hình JSON.");
  }

  async function handleImportPrompts(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.prompts)) throw new Error("JSON import thiếu prompts array.");
      await Promise.all(parsed.prompts.map((prompt) => adminService.updatePrompt(prompt.promptKey, prompt)));
      showToast("Đã import prompts và auto backup bằng version log.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "JSON import không hợp lệ.", "error");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSaveRoutingSettings() {
    if (!validateRoutingSettings()) return;
    setIsSaving(true);
    try {
      await adminService.savePromptRoutingSettings(aiRoutingSettings);
      showToast("Đã lưu routing settings.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể lưu routing settings.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleSafetyRule(rule) {
    setIsSaving(true);
    try {
      const nextRule = { ...rule, enabled: !rule.enabled };
      await adminService.togglePromptSafetyRule(rule.key, nextRule);
      setSafetyRules((prev) => prev.map((item) => item.key === rule.key ? nextRule : item));
      showToast("Đã cập nhật safety rule.");
    } catch (error) {
      showToast(error.message || "Không thể cập nhật safety rule.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStartABTest() {
    const payload = await adminService.updatePromptABTest("start", abTestState);
    setAbTestState(payload.abTest || { ...abTestState, status: "running" });
    showToast("Đã start A/B test.");
  }

  async function handleStopABTest() {
    const payload = await adminService.updatePromptABTest("stop", abTestState);
    setAbTestState(payload.abTest || { ...abTestState, status: "stopped" });
    showToast("Đã stop A/B test.");
  }

  async function handlePickABTestWinner() {
    const payload = await adminService.updatePromptABTest("winner", abTestState);
    setAbTestState(payload.abTest || { ...abTestState, status: "winner_selected" });
    showToast("Đã chọn winner cho A/B test.");
  }

  async function runConfirmAction() {
    if (confirmAction?.type === "updateProduction") await handleUpdatePrompt(true);
    if (confirmAction?.type === "deletePrompt") {
      await adminService.deletePrompt(confirmAction.payload.promptKey);
      showToast("Đã xóa prompt.");
      setActiveModal(null);
      await handleRefresh();
    }
    if (confirmAction?.type === "rollback") await handleRollbackVersion(confirmAction.payload, true);
    setConfirmAction(null);
  }

  const Button = ({ children, variant = "secondary", className = "", ...props }) => {
    const variants = {
      primary: "bg-green-600 hover:bg-green-700 text-white border border-green-600",
      secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700",
      info: "bg-blue-600 hover:bg-blue-700 text-white border border-blue-600",
      danger: "bg-transparent border border-red-500 text-red-400 hover:bg-red-500/10",
    };
    return <button className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>{children}</button>;
  };
  const Badge = ({ children, className }) => <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;
  const Input = ({ label, error, className = "", ...props }) => <label className={`space-y-2 ${className}`}><span className="text-xs font-semibold uppercase text-slate-400">{label}</span><input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-green-500" {...props} />{error ? <span className="text-xs text-red-400">{error}</span> : null}</label>;
  const Textarea = ({ label, error, className = "", ...props }) => <label className={`space-y-2 ${className}`}><span className="text-xs font-semibold uppercase text-slate-400">{label}</span><textarea className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-green-500" {...props} />{error ? <span className="text-xs text-red-400">{error}</span> : null}</label>;
  const Select = ({ label, children, className = "", ...props }) => <label className={`space-y-2 ${className}`}><span className="text-xs font-semibold uppercase text-slate-400">{label}</span><select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-green-500" {...props}>{children}</select></label>;
  const Toggle = ({ label, checked, onChange }) => <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200"><input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-green-600" />{label}</label>;
  const Card = ({ title, children }) => <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow"><h2 className="text-lg font-bold text-white">{title}</h2><div className="mt-4">{children}</div></section>;
  const Modal = ({ title, children }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur"><div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"><div className="mb-5 flex justify-between gap-4"><h3 className="text-xl font-bold text-white">{title}</h3><Button onClick={() => setActiveModal(null)}>Close</Button></div>{children}</div></div>;

  const stats = [
    ["totalPrompts", promptStats.totalPrompts || prompts.length],
    ["activePrompts", promptStats.activePrompts || prompts.filter((prompt) => prompt.status === "Active").length],
    ["draftPrompts", promptStats.draftPrompts || 0],
    ["testingPrompts", promptStats.testingPrompts || 0],
    ["errorPrompts", promptStats.errorPrompts || 0],
    ["savedVersions", promptStats.savedVersions || promptVersions.length],
    ["promptCallsToday", promptStats.promptCallsToday || 0],
    ["promptErrorRate", `${Number(promptStats.promptErrorRate || 0).toFixed(2)}%`],
    ["mostUsedPrompt", promptStats.mostUsedPrompt || "N/A"],
    ["lastUpdated", promptStats.lastUpdated ? new Date(promptStats.lastUpdated).toLocaleString("vi-VN") : "N/A"],
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      {toast ? <div className={`fixed right-4 top-4 z-[60] rounded-2xl border px-4 py-3 text-sm shadow-2xl ${toast.type === "error" ? "border-red-500/40 bg-red-500/15 text-red-200" : "border-green-500/40 bg-green-500/15 text-green-200"}`}>{toast.message}</div> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Cấu hình System Prompts AI Hệ thống ⚙️</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">Tùy chỉnh hành vi, phong cách trả lời, quy tắc an toàn và prompt riêng cho từng tính năng AI.</p>
              <div className="mt-4 flex flex-wrap gap-2"><Badge className={getPromptStatusBadge("Active")}>Prompt Engine Active</Badge><Badge className={getPromptStatusBadge("Active")}>Safety Guard Enabled</Badge><Badge className={getEnvironmentBadge("Production")}>Version Control On</Badge></div>
              {isLoading ? <p className="mt-3 text-sm text-blue-300">Đang tải prompt config thật từ backend...</p> : null}
            </div>
            <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={handleCreatePrompt}>Tạo Prompt Mới</Button><Button variant="info" onClick={handleTestPrompt}>Test Prompt</Button><Button onClick={handleExportPrompts}>Xuất cấu hình JSON</Button><label className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Import JSON<input type="file" accept="application/json" className="hidden" onChange={handleImportPrompts} /></label></div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold text-white">{value}</p></div>)}
        </section>

        <Card title="Filters">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5"><Input label="search" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} /><Select label="featureFilter" value={filters.featureFilter} onChange={(event) => setFilters((prev) => ({ ...prev, featureFilter: event.target.value }))}><option value="all">all</option>{prompts.map((prompt) => <option key={prompt.promptKey} value={prompt.feature}>{prompt.feature}</option>)}</Select><Select label="statusFilter" value={filters.statusFilter} onChange={(event) => setFilters((prev) => ({ ...prev, statusFilter: event.target.value }))}><option value="all">all</option>{["Active", "Draft", "Testing", "Disabled", "Deprecated"].map((item) => <option key={item}>{item}</option>)}</Select><Select label="environmentFilter" value={filters.environmentFilter} onChange={(event) => setFilters((prev) => ({ ...prev, environmentFilter: event.target.value }))}><option value="all">all</option>{["Development", "Staging", "Production"].map((item) => <option key={item}>{item}</option>)}</Select><Input label="updatedByFilter" value={filters.updatedByFilter} onChange={(event) => setFilters((prev) => ({ ...prev, updatedByFilter: event.target.value }))} /></div>
          <div className="mt-4"><Button onClick={() => setFilters({ search: "", featureFilter: "all", statusFilter: "all", environmentFilter: "all", updatedByFilter: "" })}>Reset filter</Button></div>
        </Card>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Prompt List">
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr>{["Name", "Key", "Feature", "Description", "Status", "Version", "Environment", "Updated By", "Updated At", "Actions"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{filteredPrompts.map((prompt) => <tr key={prompt.promptKey} className="hover:bg-slate-800/40"><td className="px-4 py-4 font-semibold text-white">{prompt.promptName}</td><td className="px-4 py-4 text-slate-300">{prompt.promptKey}</td><td className="px-4 py-4 text-slate-300">{prompt.feature}</td><td className="max-w-xs px-4 py-4 text-slate-300">{prompt.description}</td><td className="px-4 py-4"><Badge className={getPromptStatusBadge(prompt.status)}>{prompt.status}</Badge></td><td className="px-4 py-4 text-slate-300">v{prompt.version}</td><td className="px-4 py-4"><Badge className={getEnvironmentBadge(prompt.environment)}>{prompt.environment}</Badge></td><td className="px-4 py-4 text-slate-300">{prompt.updatedBy}</td><td className="px-4 py-4 text-slate-300">{prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleString("vi-VN") : "N/A"}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button className="px-3 py-1 text-xs" onClick={() => setSelectedPrompt(prompt)}>View Detail</Button><Button className="px-3 py-1 text-xs" onClick={() => { setSelectedPrompt(prompt); setActiveModal("editor"); }}>Edit</Button><Button className="px-3 py-1 text-xs" onClick={() => handleDuplicatePrompt(prompt)}>Duplicate</Button><Button className="px-3 py-1 text-xs" onClick={() => handleTestPrompt({ ...playgroundState, selectedPrompt: prompt.promptKey })}>Test</Button><Button className="px-3 py-1 text-xs" onClick={() => handleRollbackVersion(promptVersions.find((version) => version.promptKey === prompt.promptKey))}>Rollback</Button><Button className="px-3 py-1 text-xs" onClick={() => adminService.updatePrompt(prompt.promptKey, { ...prompt, status: "Active" }).then(handleRefresh)}>Activate</Button><Button className="px-3 py-1 text-xs" onClick={() => adminService.updatePrompt(prompt.promptKey, { ...prompt, status: "Disabled" }).then(handleRefresh)}>Disable</Button><Button className="px-3 py-1 text-xs" variant="danger" onClick={() => handleDeletePrompt(prompt)}>Delete</Button></div></td></tr>)}</tbody></table></div>
          </Card>

          <Card title="Prompt Editor">
            <EditorForm inline />
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Prompt Variables">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{promptVariables.map((variable) => <div key={variable.key} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-center justify-between gap-3"><p className="font-mono text-sm font-semibold text-purple-300">{variable.key}</p>{variable.required ? <Badge className={getPromptStatusBadge("Active")}>required</Badge> : null}</div><p className="mt-2 text-sm text-slate-400">{variable.description}</p><p className="mt-2 text-xs text-slate-500">{variable.dataType} · {variable.example}</p></div>)}</div>
          </Card>
          <Card title="Feature Prompt Tabs">
            <div className="flex flex-wrap gap-2">{featureTabs.map((tab) => <Button key={tab} onClick={() => setFilters((prev) => ({ ...prev, search: tab.split(" ")[0].toLowerCase() }))}>{tab}</Button>)}</div>
          </Card>
        </section>

        <Card title="Prompt Playground">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-4"><Select label="selectedPrompt" value={playgroundState.selectedPrompt} onChange={(event) => setPlaygroundState((prev) => ({ ...prev, selectedPrompt: event.target.value }))}>{prompts.map((prompt) => <option key={prompt.promptKey} value={prompt.promptKey}>{prompt.promptName}</option>)}</Select><Textarea label="sampleInput" value={playgroundState.sampleInput} onChange={(event) => setPlaygroundState((prev) => ({ ...prev, sampleInput: event.target.value }))} /><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Input label="selectedModel" value={playgroundState.selectedModel} onChange={(event) => setPlaygroundState((prev) => ({ ...prev, selectedModel: event.target.value }))} /><Input label="temperature" type="number" step="0.1" value={playgroundState.temperature} onChange={(event) => setPlaygroundState((prev) => ({ ...prev, temperature: event.target.value }))} /><Input label="maxTokens" type="number" value={playgroundState.maxTokens} onChange={(event) => setPlaygroundState((prev) => ({ ...prev, maxTokens: event.target.value }))} /><Input label="outputLanguage" value={playgroundState.outputLanguage} onChange={(event) => setPlaygroundState((prev) => ({ ...prev, outputLanguage: event.target.value }))} /></div><div className="flex flex-wrap gap-2"><Button variant="primary" onClick={handleTestPrompt} disabled={isSaving}>Run Test</Button><Button onClick={() => handleComparePromptVersion(promptVersions[0])}>Compare Previous Version</Button><Button onClick={() => setPlaygroundState(defaultPlayground)}>Clear</Button></div></div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="grid grid-cols-2 gap-3 text-sm text-slate-300"><p>inputTokens: {playgroundState.inputTokens}</p><p>outputTokens: {playgroundState.outputTokens}</p><p>latency: {playgroundState.latency}ms</p><p>estimatedCost: ${Number(playgroundState.estimatedCost || 0).toFixed(6)}</p><p>testStatus: {playgroundState.testStatus}</p><p>localCount: {countPromptTokens(playgroundState.sampleInput)}</p></div><pre className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-200">{playgroundState.output || "AI output preview"}</pre></div>
          </div>
        </Card>

        <Table title="Version Control" headers={["Version", "Prompt Name", "Updated By", "Updated At", "Environment", "Change Summary", "Status", "Actions"]}>
          {promptVersions.map((version) => <tr key={version.versionId} className="hover:bg-slate-800/40"><td className="px-4 py-4 font-semibold text-white">v{version.version}</td><td className="px-4 py-4 text-slate-300">{version.promptName}</td><td className="px-4 py-4 text-slate-300">{version.updatedBy}</td><td className="px-4 py-4 text-slate-300">{version.updatedAt ? new Date(version.updatedAt).toLocaleString("vi-VN") : "N/A"}</td><td className="px-4 py-4"><Badge className={getEnvironmentBadge(version.environment)}>{version.environment}</Badge></td><td className="px-4 py-4 text-slate-300">{version.changeSummary}</td><td className="px-4 py-4 text-slate-300">{version.status}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button className="px-3 py-1 text-xs" onClick={() => handleComparePromptVersion(version)}>View Diff</Button><Button className="px-3 py-1 text-xs" onClick={() => handleRollbackVersion(version)}>Rollback</Button><Button className="px-3 py-1 text-xs" onClick={() => setSelectedPrompt({ ...version.snapshot, promptKey: `${version.promptKey}_copy_${Date.now()}`, status: "Draft" })}>Duplicate Version</Button><Button className="px-3 py-1 text-xs" onClick={() => handleSetActiveVersion(version)}>Set Active</Button></div></td></tr>)}
        </Table>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Safety Guardrails">
            <div className="space-y-3">{safetyRules.map((rule) => <div key={rule.key} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-white">{rule.name}</p><p className="mt-1 text-xs text-slate-500">{rule.key}</p></div><Badge className={rule.severity === "Critical" ? getPromptStatusBadge("Disabled") : getPromptStatusBadge("Testing")}>{rule.severity}</Badge></div><div className="mt-3"><Toggle label={rule.enabled ? "enabled" : "disabled"} checked={Boolean(rule.enabled)} onChange={() => handleToggleSafetyRule(rule)} /></div></div>)}</div>
          </Card>
          <Card title="AI Routing Settings">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="freeChatLimitPerDay" type="number" value={aiRoutingSettings.freeChatLimitPerDay} error={formErrors.freeChatLimitPerDay} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, freeChatLimitPerDay: event.target.value }))} /><Input label="proChatLimitPerDay" type="number" value={aiRoutingSettings.proChatLimitPerDay} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, proChatLimitPerDay: event.target.value }))} /><Input label="enterpriseChatLimitPerDay" type="number" value={aiRoutingSettings.enterpriseChatLimitPerDay} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, enterpriseChatLimitPerDay: event.target.value }))} /><Input label="defaultModel" value={aiRoutingSettings.defaultModel} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, defaultModel: event.target.value }))} /><Input label="fallbackModel" value={aiRoutingSettings.fallbackModel} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, fallbackModel: event.target.value }))} /><Input label="temperature" type="number" step="0.1" value={aiRoutingSettings.temperature} error={formErrors.temperature} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, temperature: event.target.value }))} /><Input label="maxTokens" type="number" value={aiRoutingSettings.maxTokens} error={formErrors.maxTokens} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, maxTokens: event.target.value }))} /><Input label="topP" type="number" step="0.01" value={aiRoutingSettings.topP} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, topP: event.target.value }))} /><Input label="timeoutSeconds" type="number" value={aiRoutingSettings.timeoutSeconds} error={formErrors.timeoutSeconds} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, timeoutSeconds: event.target.value }))} /><Input label="retryCount" type="number" value={aiRoutingSettings.retryCount} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, retryCount: event.target.value }))} /><Input label="cacheTTL" type="number" value={aiRoutingSettings.cacheTTL} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, cacheTTL: event.target.value }))} /></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><Toggle label="enableStreaming" checked={aiRoutingSettings.enableStreaming} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, enableStreaming: event.target.checked }))} /><Toggle label="enableCache" checked={aiRoutingSettings.enableCache} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, enableCache: event.target.checked }))} /><Toggle label="enablePromptLogging" checked={aiRoutingSettings.enablePromptLogging} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, enablePromptLogging: event.target.checked }))} /><Toggle label="enableOutputModeration" checked={aiRoutingSettings.enableOutputModeration} onChange={(event) => setAiRoutingSettings((prev) => ({ ...prev, enableOutputModeration: event.target.checked }))} /></div><div className="mt-5"><Button variant="primary" onClick={handleSaveRoutingSettings} disabled={isSaving}>Lưu routing settings</Button></div>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="A/B Testing Prompt">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Select label="promptA" value={abTestState.promptA} onChange={(event) => setAbTestState((prev) => ({ ...prev, promptA: event.target.value }))}>{prompts.map((prompt) => <option key={prompt.promptKey} value={prompt.promptKey}>{prompt.promptName}</option>)}</Select><Select label="promptB" value={abTestState.promptB} onChange={(event) => setAbTestState((prev) => ({ ...prev, promptB: event.target.value }))}>{prompts.map((prompt) => <option key={prompt.promptKey} value={prompt.promptKey}>{prompt.promptName}</option>)}</Select><Input label="trafficSplit" type="number" value={abTestState.trafficSplit} onChange={(event) => setAbTestState((prev) => ({ ...prev, trafficSplit: event.target.value }))} /><Input label="feature" value={abTestState.feature} onChange={(event) => setAbTestState((prev) => ({ ...prev, feature: event.target.value }))} /><Input label="testDuration" type="number" value={abTestState.testDuration} onChange={(event) => setAbTestState((prev) => ({ ...prev, testDuration: event.target.value }))} /><Input label="metric" value={abTestState.metric} onChange={(event) => setAbTestState((prev) => ({ ...prev, metric: event.target.value }))} /><Input label="status" value={abTestState.status} onChange={(event) => setAbTestState((prev) => ({ ...prev, status: event.target.value }))} /></div><div className="mt-5 flex flex-wrap gap-2"><Button variant="primary" onClick={handleStartABTest}>Start Test</Button><Button onClick={handleStopABTest}>Stop Test</Button><Button variant="info" onClick={handlePickABTestWinner}>Pick Winner</Button></div>
          </Card>
          <Card title="Prompt Analytics">
            <div className="space-y-3">{(promptAnalytics.callsByPrompt || []).map((row) => <div key={row.promptKey} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-white">{row.promptKey}</p><Badge className={getPromptStatusBadge(row.errorRate >= 10 ? "Disabled" : "Active")}>{row.errorRate}% error</Badge></div><p className="mt-2 text-sm text-slate-400">calls {row.calls} · tokens {row.tokens} · cost ${Number(row.cost || 0).toFixed(6)} · latency {row.avgLatency}ms</p></div>)}{!(promptAnalytics.callsByPrompt || []).length ? <p className="text-sm text-slate-400">Chưa có analytics từ ai_usage_events.</p> : null}</div>
          </Card>
        </section>

        <Table title="Prompt Change Logs" headers={["Time", "Admin", "Prompt", "Action", "Old Value", "New Value", "Environment", "Reason", "Status"]}>
          {promptChangeLogs.map((row, index) => <tr key={`${row.time}-${index}`} className="hover:bg-slate-800/40"><td className="px-4 py-4 text-slate-300">{row.time ? new Date(row.time).toLocaleString("vi-VN") : "N/A"}</td><td className="px-4 py-4 text-slate-300">{row.admin}</td><td className="px-4 py-4 text-slate-300">{row.prompt}</td><td className="px-4 py-4 font-semibold text-white">{row.action}</td><td className="px-4 py-4 text-slate-300">{row.oldValue}</td><td className="px-4 py-4 text-slate-300">{row.newValue}</td><td className="px-4 py-4 text-slate-300">{row.environment}</td><td className="px-4 py-4 text-slate-300">{row.reason}</td><td className="px-4 py-4 text-slate-300">{row.status}</td></tr>)}
        </Table>
      </div>

      {activeModal === "editor" ? <Modal title="Prompt Editor"><EditorForm /><div className="mt-6 flex justify-end gap-2"><Button onClick={() => setActiveModal(null)}>Hủy</Button><Button variant="primary" onClick={() => handleUpdatePrompt(false)} disabled={isSaving}>Lưu prompt</Button></div></Modal> : null}
      {activeModal === "confirm" ? <Modal title="Xác nhận prompt action"><p className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 text-sm text-orange-100">{confirmAction?.type === "rollback" ? "Không cho rollback nếu chưa xác nhận modal." : confirmAction?.type === "updateProduction" ? "Không cho update production nếu chưa xác nhận modal." : "Bạn có chắc muốn xóa prompt này?"}</p><div className="mt-6 flex justify-end gap-2"><Button onClick={() => setActiveModal(null)}>Hủy</Button><Button variant="danger" onClick={runConfirmAction} disabled={isSaving}>Xác nhận</Button></div></Modal> : null}
    </main>
  );

  function EditorForm() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="promptName" value={selectedPrompt.promptName || ""} error={formErrors.promptName} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, promptName: event.target.value }))} /><Input label="promptKey" value={selectedPrompt.promptKey || ""} error={formErrors.promptKey} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, promptKey: event.target.value }))} /><Input label="feature" value={selectedPrompt.feature || ""} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, feature: event.target.value }))} /><Input label="description" value={selectedPrompt.description || ""} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, description: event.target.value }))} /></div>
        <Textarea label="systemPrompt" value={selectedPrompt.systemPrompt || ""} error={formErrors.systemPrompt} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, systemPrompt: event.target.value }))} />
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300" dangerouslySetInnerHTML={{ __html: highlightPromptVariables(selectedPrompt.systemPrompt || "") }} />
        <Textarea label="promptTemplate" value={selectedPrompt.promptTemplate || ""} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, promptTemplate: event.target.value }))} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="allowedVariables" value={(selectedPrompt.allowedVariables || []).join(",")} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, allowedVariables: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} /><Input label="outputFormatRules" value={selectedPrompt.outputFormatRules || ""} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, outputFormatRules: event.target.value }))} /><Input label="defaultLanguage" value={selectedPrompt.defaultLanguage || "vi"} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, defaultLanguage: event.target.value }))} /><Select label="tone" value={selectedPrompt.tone || "professional"} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, tone: event.target.value }))}>{["concise", "detailed", "professional", "friendly", "technical"].map((item) => <option key={item}>{item}</option>)}</Select><Select label="status" value={selectedPrompt.status || "Draft"} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, status: event.target.value }))}>{["Active", "Draft", "Testing", "Disabled", "Deprecated"].map((item) => <option key={item}>{item}</option>)}</Select><Select label="environment" value={selectedPrompt.environment || "Development"} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, environment: event.target.value }))}>{["Development", "Staging", "Production"].map((item) => <option key={item}>{item}</option>)}</Select><Input className="md:col-span-2" label="changeNote" value={selectedPrompt.changeNote || ""} onChange={(event) => setSelectedPrompt((prev) => ({ ...prev, changeNote: event.target.value }))} /></div>
        <div className="flex justify-end"><Button variant="primary" onClick={() => handleUpdatePrompt(false)} disabled={isSaving}>Cập nhật prompt</Button></div>
      </div>
    );
  }

  function Table({ title, headers, children }) {
    return (
      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr>{headers.map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{children}</tbody></table>{!React.Children.count(children) ? <p className="mt-4 text-sm text-slate-400">Chưa có dữ liệu thật từ backend.</p> : null}</div>
      </section>
    );
  }
}
