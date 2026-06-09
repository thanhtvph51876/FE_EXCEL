import React, { useEffect, useMemo, useState } from "react";
import { adminService } from "./services/adminService.js";

const emptyStats = {
  totalTemplates: 0,
  activeTemplates: 0,
  pendingTemplates: 0,
  errorTemplates: 0,
  premiumTemplates: 0,
  totalDownloads: 0,
  monthlyUsage: 0,
  newTemplatesThisMonth: 0,
  needUpdateTemplates: 0,
  totalStorage: 0,
  totalStorageLabel: "0 B",
};

const emptyFilters = {
  search: "",
  categoryFilter: "all",
  fileTypeFilter: "all",
  statusFilter: "all",
  accessFilter: "all",
  createdDateFrom: "",
  createdDateTo: "",
};

const emptyTemplateForm = {
  templateName: "",
  templateCode: "",
  category: "",
  description: "",
  fileUpload: null,
  fileName: "",
  fileType: "",
  fileSize: 0,
  fileSizeLabel: "",
  storagePath: "",
  icon: "XL",
  tags: [],
  version: "1.0.0",
  status: "Active",
  accessLevel: "Public",
  allowedDepartments: [],
  allowedPlans: [],
  allowDownload: true,
  allowAIBuilder: true,
  allowClone: true,
  internalNote: "",
};

const defaultPermissions = {
  accessLevel: "Public",
  permissions: {
    viewTemplate: true,
    downloadTemplate: true,
    useWithAI: true,
    editTemplate: false,
    deleteTemplate: false,
    shareTemplate: true,
  },
};

const allowedFileTypes = [".xlsx", ".xls", ".xlsm", ".csv"];
const departmentOptions = ["Kế toán", "Nhân sự", "Quản trị", "Bán hàng", "Kho vận", "Tài chính", "Dự án", "Báo cáo"];
const planOptions = ["free", "pro", "business", "enterprise"];

export default function ExcelTemplateManagementDashboard() {
  const [templates, setTemplates] = useState([]);
  const [templateStats, setTemplateStats] = useState(emptyStats);
  const [filters, setFilters] = useState(emptyFilters);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateCategories, setTemplateCategories] = useState([]);
  const [templateTags, setTemplateTags] = useState([]);
  const [templateVersions, setTemplateVersions] = useState({});
  const [templateLogs, setTemplateLogs] = useState([]);
  const [templateAlerts, setTemplateAlerts] = useState([]);
  const [templatePermissions, setTemplatePermissions] = useState({});
  const [templateValidationResult, setTemplateValidationResult] = useState({});

  const [templateAnalytics, setTemplateAnalytics] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState(defaultPermissions);
  const [bulkValue, setBulkValue] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [activeModal, setActiveModal] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    handleRefresh();
  }, []);

  const visibleTemplates = useMemo(() => filterTemplates(), [templates, filters]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function formatFileSize(value) {
    const bytes = Number(value || 0);
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  function getTemplateStatusBadge(status) {
    const badges = {
      Active: "border-green-500/30 bg-green-500/20 text-green-400",
      Pending: "border-yellow-500/30 bg-yellow-500/20 text-yellow-400",
      Error: "border-red-500/30 bg-red-500/20 text-red-400",
      NeedUpdate: "border-orange-500/30 bg-orange-500/20 text-orange-400",
      Draft: "border-slate-500/30 bg-slate-500/20 text-slate-300",
    };
    return badges[status] || badges.Draft;
  }

  function getAccessBadge(access) {
    const badges = {
      Public: "border-green-500/30 bg-green-500/20 text-green-400",
      Internal: "border-blue-500/30 bg-blue-500/20 text-blue-400",
      Department: "border-purple-500/30 bg-purple-500/20 text-purple-400",
      "Plan-based": "border-yellow-500/30 bg-yellow-500/20 text-yellow-400",
      "Role-based": "border-red-500/30 bg-red-500/20 text-red-400",
      Private: "border-red-500/30 bg-red-500/20 text-red-400",
    };
    return badges[access] || badges.Public;
  }

  function getFileTypeBadge(fileType) {
    const type = String(fileType || "").toLowerCase();
    if (type === ".xlsm") return "border-red-500/30 bg-red-500/20 text-red-400";
    if (type === ".csv") return "border-blue-500/30 bg-blue-500/20 text-blue-400";
    if (type === ".xls") return "border-yellow-500/30 bg-yellow-500/20 text-yellow-400";
    return "border-green-500/30 bg-green-500/20 text-green-400";
  }

  function filterTemplates() {
    return templates.filter((template) => {
      const text = `${template.templateName} ${template.templateCode} ${template.fileName} ${(template.tags || []).join(" ")}`.toLowerCase();
      if (filters.search && !text.includes(filters.search.toLowerCase())) return false;
      if (filters.categoryFilter !== "all" && template.category !== filters.categoryFilter) return false;
      if (filters.fileTypeFilter !== "all" && template.fileType !== filters.fileTypeFilter) return false;
      if (filters.statusFilter !== "all" && template.status !== filters.statusFilter) return false;
      if (filters.accessFilter !== "all" && template.accessLevel !== filters.accessFilter) return false;
      if (filters.createdDateFrom && new Date(template.createdAt || 0) < new Date(filters.createdDateFrom)) return false;
      if (filters.createdDateTo && new Date(template.createdAt || 0) > new Date(`${filters.createdDateTo}T23:59:59`)) return false;
      return true;
    });
  }

  function validateTemplateForm(form = templateForm) {
    const errors = {};
    const code = String(form.templateCode || "").trim();
    if (!String(form.templateName || "").trim()) errors.templateName = "templateName không được rỗng.";
    if (!code) errors.templateCode = "templateCode không được rỗng.";
    if (!selectedTemplate && templates.some((item) => String(item.templateCode) === code)) errors.templateCode = "templateCode không được trùng.";
    const fileType = String(form.fileType || (form.fileName ? `.${form.fileName.split(".").pop()}` : "")).toLowerCase();
    if (form.fileName && !allowedFileTypes.includes(fileType)) errors.fileUpload = "File upload phải là .xlsx, .xls, .xlsm hoặc .csv.";
    if (Number(form.fileSize || 0) > 50 * 1024 * 1024) errors.fileUpload = "File không được vượt quá dung lượng cho phép.";
    if (!String(form.category || "").trim()) errors.category = "Category không được rỗng.";
    if (form.accessLevel === "Department" && !(form.allowedDepartments || []).length) errors.allowedDepartments = "Phải chọn ít nhất 1 phòng ban.";
    if (form.accessLevel === "Plan-based" && !(form.allowedPlans || []).length) errors.allowedPlans = "Phải chọn ít nhất 1 gói.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleRefresh() {
    setIsLoading(true);
    try {
      const payload = await adminService.getTemplateDashboard();
      setTemplates(Array.isArray(payload.templates) ? payload.templates : []);
      setTemplateStats({ ...emptyStats, ...(payload.templateStats || {}) });
      setTemplateCategories(Array.isArray(payload.templateCategories) ? payload.templateCategories : departmentOptions);
      setTemplateTags(Array.isArray(payload.templateTags) ? payload.templateTags : []);
      setTemplateVersions(payload.templateVersions || {});
      setTemplateLogs(Array.isArray(payload.templateLogs) ? payload.templateLogs : []);
      setTemplateAlerts(Array.isArray(payload.templateAlerts) ? payload.templateAlerts : []);
      setTemplatePermissions(payload.templatePermissions || {});
      setTemplateValidationResult(payload.templateValidationResult || {});
      setTemplateAnalytics(payload.templateAnalytics || {});
    } catch (error) {
      showToast(error.message || "Không thể tải dữ liệu template thật.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUploadTemplate(file) {
    if (!file) return null;
    const fileType = `.${file.name.split(".").pop()}`.toLowerCase();
    if (!allowedFileTypes.includes(fileType)) {
      setFormErrors((prev) => ({ ...prev, fileUpload: "File upload phải là .xlsx, .xls, .xlsm hoặc .csv." }));
      return null;
    }
    setIsSaving(true);
    try {
      const payload = await adminService.uploadTemplateFile(file, templateForm.templateCode || selectedTemplate?.templateCode || "");
      const fileMeta = payload.file || {};
      setTemplateForm((prev) => ({ ...prev, fileUpload: file, ...fileMeta }));
      showToast("Đã upload file template thật vào backend storage.");
      return fileMeta;
    } catch (error) {
      showToast(error.message || "Không thể upload template.", "error");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddTemplate() {
    if (!validateTemplateForm()) return;
    setIsSaving(true);
    try {
      const payload = { ...templateForm, tags: templateForm.tags || [] };
      if (selectedTemplate) {
        await adminService.updateTemplateAdvanced(selectedTemplate.id, payload);
        showToast("Đã cập nhật template.");
      } else {
        await adminService.createTemplateAdvanced(payload);
        showToast("Đã thêm template mới.");
      }
      setTemplateForm(emptyTemplateForm);
      setSelectedTemplate(null);
      setActiveModal(null);
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể lưu template.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditTemplate(template) {
    setSelectedTemplate(template);
    setTemplateForm({ ...emptyTemplateForm, ...template, tags: template.tags || [] });
    setActiveModal("edit");
  }

  async function handleDeleteTemplate(template, force = false) {
    if (!force && Number(template.usedByActiveWorkflows || 0) > 0) {
      setConfirmAction({ type: "delete", payload: template, forceRequired: true });
      setActiveModal("confirm");
      return;
    }
    setIsSaving(true);
    try {
      await adminService.deleteTemplateAdvanced(template.id, force);
      showToast("Đã xóa template.");
      setActiveModal(null);
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể xóa template.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePreviewTemplate(template) {
    setSelectedTemplate(template);
    setIsSaving(true);
    try {
      const payload = await adminService.previewTemplate(template.id);
      setPreviewData(payload.preview || null);
      setActiveModal("preview");
    } catch (error) {
      showToast(error.message || "Không thể preview template.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleValidateTemplate(template = selectedTemplate) {
    if (!template) return;
    setSelectedTemplate(template);
    setIsSaving(true);
    try {
      const payload = await adminService.validateTemplate(template.id);
      setTemplateValidationResult((prev) => ({ ...prev, [template.id]: payload.validation }));
      setActiveModal("validator");
      showToast("Đã kiểm tra cấu trúc template.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể validate template.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateTemplateVersion(template = selectedTemplate) {
    if (!template) return;
    setIsSaving(true);
    try {
      const payload = await adminService.updateTemplateVersion(template.id, { ...templateForm, changeNote: templateForm.internalNote || "Update file version" });
      setTemplateVersions((prev) => ({ ...prev, [template.id]: payload.versions || [] }));
      showToast("Đã cập nhật version template.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể cập nhật version.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRollbackTemplateVersion(template, versionIndex) {
    setIsSaving(true);
    try {
      await adminService.rollbackTemplateVersion(template.id, versionIndex);
      showToast("Đã rollback template version.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể rollback version.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateTemplatePermissions(template = selectedTemplate) {
    if (!template) return;
    setIsSaving(true);
    try {
      const payload = await adminService.updateTemplatePermissions(template.id, permissionDraft);
      setTemplatePermissions((prev) => ({ ...prev, [template.id]: payload.permissions }));
      showToast("Đã cập nhật phân quyền template.");
      setActiveModal(null);
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể cập nhật permissions.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkAction(action, idsOverride = null) {
    const ids = idsOverride || selectedIds;
    if (!ids.length) {
      showToast("Chưa chọn template nào.", "error");
      return;
    }
    setIsSaving(true);
    try {
      await adminService.bulkTemplateAction(action, ids, bulkValue);
      showToast(`Đã thực hiện bulk action: ${action} cho ${ids.length} template.`);
      setSelectedIds([]);
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể thực hiện bulk action.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleExportTemplateList() {
    const rows = [
      ["Template Name", "Code", "Category", "File Name", "Version", "File Size", "Downloads", "Access", "Status"],
      ...visibleTemplates.map((item) => [item.templateName, item.templateCode, item.category, item.fileName, item.version, item.fileSizeLabel, item.downloads, item.accessLevel, item.status]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `excel-templates-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Đã xuất danh sách template.");
  }

  function handleDownloadTemplate(template) {
    window.open(adminService.getTemplateDownloadUrl(template.id), "_blank", "noopener,noreferrer");
  }

  async function runConfirmAction() {
    if (confirmAction?.type === "delete") await handleDeleteTemplate(confirmAction.payload, true);
    setConfirmAction(null);
  }

  function openPermissions(template) {
    setSelectedTemplate(template);
    setPermissionDraft(templatePermissions[template.id] || { accessLevel: template.accessLevel || "Public", permissions: template.permissions || defaultPermissions.permissions });
    setActiveModal("permissions");
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
  const Textarea = ({ label, error, className = "", ...props }) => <label className={`space-y-2 ${className}`}><span className="text-xs font-semibold uppercase text-slate-400">{label}</span><textarea className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-green-500" {...props} />{error ? <span className="text-xs text-red-400">{error}</span> : null}</label>;
  const Select = ({ label, children, error, className = "", ...props }) => <label className={`space-y-2 ${className}`}><span className="text-xs font-semibold uppercase text-slate-400">{label}</span><select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-green-500" {...props}>{children}</select>{error ? <span className="text-xs text-red-400">{error}</span> : null}</label>;
  const Toggle = ({ label, checked, onChange }) => <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200"><input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-green-600" />{label}</label>;
  const Card = ({ title, children }) => <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow"><h2 className="text-lg font-bold text-white">{title}</h2><div className="mt-4">{children}</div></section>;
  const Modal = ({ title, children }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur"><div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"><div className="mb-5 flex justify-between gap-4"><h3 className="text-xl font-bold text-white">{title}</h3><Button onClick={() => setActiveModal(null)}>Close</Button></div>{children}</div></div>;

  const stats = [
    ["totalTemplates", templateStats.totalTemplates],
    ["activeTemplates", templateStats.activeTemplates],
    ["pendingTemplates", templateStats.pendingTemplates],
    ["errorTemplates", templateStats.errorTemplates],
    ["premiumTemplates", templateStats.premiumTemplates],
    ["totalDownloads", templateStats.totalDownloads],
    ["monthlyUsage", templateStats.monthlyUsage],
    ["newTemplatesThisMonth", templateStats.newTemplatesThisMonth],
    ["needUpdateTemplates", templateStats.needUpdateTemplates],
    ["totalStorage", templateStats.totalStorageLabel || formatFileSize(templateStats.totalStorage)],
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      {toast ? <div className={`fixed right-4 top-4 z-[60] rounded-2xl border px-4 py-3 text-sm shadow-2xl ${toast.type === "error" ? "border-red-500/40 bg-red-500/15 text-red-200" : "border-green-500/40 bg-green-500/15 text-green-200"}`}>{toast.message}</div> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Quản lý Kho Biểu Mẫu Excel 📊</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">Quản trị thư viện file mẫu Excel, phân loại theo phòng ban, kiểm tra cấu trúc, phân quyền tải và theo dõi lượt sử dụng.</p>
              {isLoading ? <p className="mt-3 text-sm text-blue-300">Đang tải template thật từ backend...</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => { setSelectedTemplate(null); setTemplateForm(emptyTemplateForm); setActiveModal("edit"); }}>Thêm Template Mới</Button>
              <Button variant="info" onClick={() => setActiveModal("import")}>Import Template</Button>
              <Button onClick={handleExportTemplateList}>Xuất danh sách</Button>
              <Button onClick={() => handleBulkAction("validate", visibleTemplates.map((template) => template.id))}>Kiểm tra toàn bộ template</Button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold text-white">{Number.isFinite(value) ? Number(value || 0).toLocaleString("vi-VN") : value}</p></div>)}
        </section>

        <Card title="Filters">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="search" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
            <Select label="categoryFilter" value={filters.categoryFilter} onChange={(event) => setFilters((prev) => ({ ...prev, categoryFilter: event.target.value }))}><option value="all">all</option>{templateCategories.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
            <Select label="fileTypeFilter" value={filters.fileTypeFilter} onChange={(event) => setFilters((prev) => ({ ...prev, fileTypeFilter: event.target.value }))}><option value="all">all</option>{allowedFileTypes.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
            <Select label="statusFilter" value={filters.statusFilter} onChange={(event) => setFilters((prev) => ({ ...prev, statusFilter: event.target.value }))}><option value="all">all</option>{["Active", "Pending", "Error", "NeedUpdate", "Draft"].map((item) => <option key={item}>{item}</option>)}</Select>
            <Select label="accessFilter" value={filters.accessFilter} onChange={(event) => setFilters((prev) => ({ ...prev, accessFilter: event.target.value }))}><option value="all">all</option>{["Public", "Internal", "Department", "Plan-based", "Role-based", "Private"].map((item) => <option key={item}>{item}</option>)}</Select>
            <Input label="createdDateFrom" type="date" value={filters.createdDateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, createdDateFrom: event.target.value }))} />
            <Input label="createdDateTo" type="date" value={filters.createdDateTo} onChange={(event) => setFilters((prev) => ({ ...prev, createdDateTo: event.target.value }))} />
            <div className="flex items-end"><Button className="w-full" onClick={() => setFilters(emptyFilters)}>Reset filter</Button></div>
          </div>
        </Card>

        <Card title="Bulk Actions">
          <div className="flex flex-wrap items-end gap-3">
            <Select label="value" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)}><option value="">Không đổi</option>{templateCategories.map((item) => <option key={item} value={item}>{item}</option>)}{["Public", "Internal", "Department", "Plan-based", "Role-based", "Private"].map((item) => <option key={item} value={item}>{item}</option>)}</Select>
            <Button onClick={() => handleBulkAction("activate")}>Activate selected</Button>
            <Button onClick={() => handleBulkAction("lock")}>Lock selected</Button>
            <Button variant="danger" onClick={() => handleBulkAction("delete")}>Delete selected</Button>
            <Button onClick={() => handleBulkAction("change_category")}>Change category</Button>
            <Button onClick={() => handleBulkAction("change_access")}>Change access level</Button>
            <Button onClick={() => handleBulkAction("validate")}>Validate selected</Button>
            <Button onClick={handleExportTemplateList}>Export list</Button>
            <Button onClick={() => showToast("Download ZIP cần backend zip bundle, danh sách hiện đã export CSV.")}>Download ZIP</Button>
          </div>
          <p className="mt-3 text-sm text-slate-400">Đã chọn {selectedIds.length} template.</p>
        </Card>

        <Card title="Templates Table">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr>{["", "Icon", "Template Name", "Category", "File Name", "Version", "File Size", "Created By", "Updated At", "Downloads", "Access", "Status", "Actions"].map((item) => <th key={item || "checkbox"} className="px-4 py-3">{item}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-800">
                {visibleTemplates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(template.id)} onChange={(event) => setSelectedIds((prev) => event.target.checked ? [...prev, template.id] : prev.filter((id) => id !== template.id))} className="h-4 w-4 accent-green-600" /></td>
                    <td className="px-4 py-4 font-semibold text-green-300">{template.icon}</td>
                    <td className="px-4 py-4 font-semibold text-white">{template.templateName}</td>
                    <td className="px-4 py-4 text-slate-300">{template.category}</td>
                    <td className="px-4 py-4"><Badge className={getFileTypeBadge(template.fileType)}>{template.fileName || "N/A"}</Badge></td>
                    <td className="px-4 py-4 text-slate-300">{template.version}</td>
                    <td className="px-4 py-4 text-slate-300">{template.fileSizeLabel || formatFileSize(template.fileSize)}</td>
                    <td className="px-4 py-4 text-slate-300">{template.createdBy}</td>
                    <td className="px-4 py-4 text-slate-300">{template.updatedAt ? new Date(template.updatedAt).toLocaleString("vi-VN") : "N/A"}</td>
                    <td className="px-4 py-4 text-slate-300">{Number(template.downloads || 0).toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-4"><Badge className={getAccessBadge(template.accessLevel)}>{template.accessLevel}</Badge></td>
                    <td className="px-4 py-4"><Badge className={getTemplateStatusBadge(template.status)}>{template.status}</Badge></td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button className="px-3 py-1 text-xs" onClick={() => setSelectedTemplate(template)}>View Detail</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => handleDownloadTemplate(template)}>Download</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => handlePreviewTemplate(template)}>Preview</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => handleEditTemplate(template)}>Edit</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => { handleEditTemplate(template); setActiveModal("import"); }}>Update File</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => { setSelectedTemplate(null); setTemplateForm({ ...template, templateCode: `${template.templateCode}_copy`, templateName: `${template.templateName} Copy` }); setActiveModal("edit"); }}>Duplicate</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => handleValidateTemplate(template)}>Validate Structure</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => openPermissions(template)}>Permissions</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => { setSelectedTemplate(template); setActiveModal("versions"); }}>Version History</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => adminService.updateTemplateAdvanced(template.id, { ...template, status: template.status === "Active" ? "Draft" : "Active" }).then(handleRefresh)}>Lock/Unlock</Button>
                        <Button className="px-3 py-1 text-xs" variant="danger" onClick={() => handleDeleteTemplate(template)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleTemplates.length ? <p className="mt-4 text-sm text-slate-400">Chưa có template thật từ backend.</p> : null}
          </div>
        </Card>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Categories & Tags">
            <div className="space-y-4"><div className="flex flex-wrap gap-2">{templateCategories.map((item) => <Badge key={item} className={getAccessBadge("Internal")}>{item}</Badge>)}</div><div className="flex flex-wrap gap-2">{templateTags.map((item) => <Badge key={item} className="border-slate-500/30 bg-slate-500/20 text-slate-300">{item}</Badge>)}</div></div>
          </Card>
          <Card title="Template Alerts">
            <div className="space-y-3">{templateAlerts.length ? templateAlerts.map((alert, index) => <div key={`${alert.title}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-white">{alert.title}</p><Badge className={getTemplateStatusBadge(alert.severity)}>{alert.severity}</Badge></div><p className="mt-2 text-sm text-slate-400">{alert.template} · {alert.detail}</p></div>) : <p className="text-sm text-slate-400">Không có cảnh báo template.</p>}</div>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Template Analytics">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><AnalyticsList title="Most downloaded templates" rows={templateAnalytics.mostDownloadedTemplates || []} valueKey="downloads" /><AnalyticsList title="Most used templates with AI" rows={templateAnalytics.mostUsedTemplatesWithAI || []} valueKey="aiUses" /><AnalyticsList title="Least used templates" rows={templateAnalytics.leastUsedTemplates || []} valueKey="downloads" /><AnalyticsList title="Templates need update" rows={templateAnalytics.templatesNeedUpdate || []} valueKey="status" /></div>
          </Card>
          <Card title="Template Logs">
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr>{["Time", "User", "Action", "Template", "IP", "Status"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{templateLogs.map((row, index) => <tr key={`${row.time}-${index}`}><td className="px-4 py-4 text-slate-300">{row.time ? new Date(row.time).toLocaleString("vi-VN") : "N/A"}</td><td className="px-4 py-4 text-slate-300">{row.user}</td><td className="px-4 py-4 font-semibold text-white">{row.action}</td><td className="px-4 py-4 text-slate-300">{row.template}</td><td className="px-4 py-4 text-slate-300">{row.ip}</td><td className="px-4 py-4 text-slate-300">{row.status}</td></tr>)}</tbody></table></div>
          </Card>
        </section>
      </div>

      {activeModal === "edit" ? <Modal title={selectedTemplate ? "Sửa Template" : "Thêm Template Mới"}><TemplateForm /></Modal> : null}
      {activeModal === "import" ? <Modal title="Import Template"><UploadDropZone /><div className="mt-6 flex justify-end gap-2"><Button onClick={() => setActiveModal(null)}>Hủy</Button><Button variant="primary" onClick={selectedTemplate ? () => handleUpdateTemplateVersion(selectedTemplate) : handleAddTemplate} disabled={isSaving}>Lưu file template</Button></div></Modal> : null}
      {activeModal === "preview" ? <Modal title="Preview Template"><PreviewModal /></Modal> : null}
      {activeModal === "validator" ? <Modal title="Template Validator"><ValidatorModal /></Modal> : null}
      {activeModal === "permissions" ? <Modal title="Template Permissions"><PermissionsModal /></Modal> : null}
      {activeModal === "versions" ? <Modal title="Version History"><VersionModal /></Modal> : null}
      {activeModal === "confirm" ? <Modal title="Xác nhận xóa template"><p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{confirmAction?.forceRequired ? "Không cho xóa template đang được sử dụng nếu chưa xác nhận đặc biệt." : "Bạn có chắc muốn xóa template này?"}</p><div className="mt-6 flex justify-end gap-2"><Button onClick={() => setActiveModal(null)}>Hủy</Button><Button variant="danger" onClick={runConfirmAction} disabled={isSaving}>Xác nhận xóa</Button></div></Modal> : null}
    </main>
  );

  function UploadDropZone() {
    return (
      <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleUploadTemplate(event.dataTransfer.files?.[0]); }} className={`rounded-2xl border border-dashed p-8 text-center ${isDragging ? "border-green-500 bg-green-500/10" : "border-slate-700 bg-slate-950"}`}>
        <p className="text-lg font-semibold text-white">Drag & drop upload file Excel/CSV</p>
        <p className="mt-2 text-sm text-slate-400">Hỗ trợ .xlsx, .xls, .xlsm, .csv. File được upload vào backend storage thật.</p>
        <input type="file" accept=".xlsx,.xls,.xlsm,.csv" className="mt-4 text-sm text-slate-300" onChange={(event) => handleUploadTemplate(event.target.files?.[0])} />
        {templateForm.fileName ? <p className="mt-3 text-sm text-green-300">{templateForm.fileName} · {templateForm.fileSizeLabel || formatFileSize(templateForm.fileSize)}</p> : null}
        {formErrors.fileUpload ? <p className="mt-2 text-sm text-red-400">{formErrors.fileUpload}</p> : null}
      </div>
    );
  }

  function TemplateForm() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="templateName" value={templateForm.templateName} error={formErrors.templateName} onChange={(event) => setTemplateForm((prev) => ({ ...prev, templateName: event.target.value }))} /><Input label="templateCode" value={templateForm.templateCode} disabled={Boolean(selectedTemplate)} error={formErrors.templateCode} onChange={(event) => setTemplateForm((prev) => ({ ...prev, templateCode: event.target.value }))} /><Select label="category" value={templateForm.category} error={formErrors.category} onChange={(event) => setTemplateForm((prev) => ({ ...prev, category: event.target.value }))}><option value="">Chọn category</option>{templateCategories.map((item) => <option key={item} value={item}>{item}</option>)}</Select><Input label="icon" value={templateForm.icon} onChange={(event) => setTemplateForm((prev) => ({ ...prev, icon: event.target.value }))} /><Input label="tags" value={(templateForm.tags || []).join(", ")} onChange={(event) => setTemplateForm((prev) => ({ ...prev, tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} /><Input label="version" value={templateForm.version} onChange={(event) => setTemplateForm((prev) => ({ ...prev, version: event.target.value }))} /><Select label="status" value={templateForm.status} onChange={(event) => setTemplateForm((prev) => ({ ...prev, status: event.target.value }))}>{["Active", "Pending", "Error", "NeedUpdate", "Draft"].map((item) => <option key={item}>{item}</option>)}</Select><Select label="accessLevel" value={templateForm.accessLevel} onChange={(event) => setTemplateForm((prev) => ({ ...prev, accessLevel: event.target.value }))}>{["Public", "Internal", "Department", "Plan-based", "Role-based", "Private"].map((item) => <option key={item}>{item}</option>)}</Select><Input label="allowedDepartments" value={(templateForm.allowedDepartments || []).join(", ")} error={formErrors.allowedDepartments} onChange={(event) => setTemplateForm((prev) => ({ ...prev, allowedDepartments: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} /><Input label="allowedPlans" value={(templateForm.allowedPlans || []).join(", ")} error={formErrors.allowedPlans} onChange={(event) => setTemplateForm((prev) => ({ ...prev, allowedPlans: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} /></div>
        <Textarea label="description" value={templateForm.description} onChange={(event) => setTemplateForm((prev) => ({ ...prev, description: event.target.value }))} />
        <UploadDropZone />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><Toggle label="allowDownload" checked={templateForm.allowDownload} onChange={(event) => setTemplateForm((prev) => ({ ...prev, allowDownload: event.target.checked }))} /><Toggle label="allowAIBuilder" checked={templateForm.allowAIBuilder} onChange={(event) => setTemplateForm((prev) => ({ ...prev, allowAIBuilder: event.target.checked }))} /><Toggle label="allowClone" checked={templateForm.allowClone} onChange={(event) => setTemplateForm((prev) => ({ ...prev, allowClone: event.target.checked }))} /></div>
        <Textarea label="internalNote" value={templateForm.internalNote} onChange={(event) => setTemplateForm((prev) => ({ ...prev, internalNote: event.target.value }))} />
        <div className="flex justify-end gap-2"><Button onClick={() => setActiveModal(null)}>Hủy</Button><Button variant="primary" onClick={handleAddTemplate} disabled={isSaving}>Lưu template</Button></div>
      </div>
    );
  }

  function PreviewModal() {
    const preview = previewData || {};
    return (
      <div className="space-y-5"><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><Info label="Sheet list" value={(preview.sheets || []).join(", ") || "N/A"} /><Info label="Row count" value={preview.rowCount || 0} /><Info label="Column count" value={preview.columnCount || 0} /><Info label="Macro warning" value={preview.macroWarning ? "Yes" : "No"} /><Info label="Column names" value={(preview.columnNames || []).join(", ") || "N/A"} /><Info label="Formula cells" value={(preview.formulaCells || []).length} /><Info label="Sensitive data warning" value={preview.sensitiveDataWarning ? "Yes" : "No"} /></div><div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-left text-sm"><tbody>{(preview.firstRows || []).slice(0, 20).map((row, index) => <tr key={index} className="border-b border-slate-800">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2 text-slate-300">{cell}</td>)}</tr>)}</tbody></table></div><div className="flex flex-wrap gap-2"><Button onClick={() => selectedTemplate && handleDownloadTemplate(selectedTemplate)}>Download button</Button><Button onClick={() => selectedTemplate && handleValidateTemplate(selectedTemplate)}>Validate button</Button><Button variant="primary" onClick={() => showToast("Use template được ghi nhận trong dashboard.")}>Use template button</Button></div></div>
    );
  }

  function ValidatorModal() {
    const result = selectedTemplate ? templateValidationResult[selectedTemplate.id] : null;
    return <div className="space-y-3"><p className="text-sm text-slate-400">Overall: {result?.overallStatus || "Not validated"}</p>{(result?.checks || []).map((check) => <div key={check.key} className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"><div><p className="font-semibold text-white">{check.label}</p><p className="mt-1 text-sm text-slate-400">{check.detail}</p></div><Badge className={getTemplateStatusBadge(check.status === "Passed" ? "Active" : check.status === "Warning" ? "NeedUpdate" : "Error")}>{check.status}</Badge></div>)}</div>;
  }

  function PermissionsModal() {
    const permissions = permissionDraft.permissions || {};
    return <div className="space-y-5"><Select label="accessLevel" value={permissionDraft.accessLevel} onChange={(event) => setPermissionDraft((prev) => ({ ...prev, accessLevel: event.target.value }))}>{["Public", "Internal", "Department", "Plan-based", "Role-based", "Private"].map((item) => <option key={item}>{item}</option>)}</Select><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{["viewTemplate", "downloadTemplate", "useWithAI", "editTemplate", "deleteTemplate", "shareTemplate"].map((key) => <Toggle key={key} label={key} checked={Boolean(permissions[key])} onChange={(event) => setPermissionDraft((prev) => ({ ...prev, permissions: { ...(prev.permissions || {}), [key]: event.target.checked } }))} />)}</div><div className="flex justify-end gap-2"><Button onClick={() => setActiveModal(null)}>Hủy</Button><Button variant="primary" onClick={() => handleUpdateTemplatePermissions(selectedTemplate)} disabled={isSaving}>Lưu permissions</Button></div></div>;
  }

  function VersionModal() {
    const rows = selectedTemplate ? (templateVersions[selectedTemplate.id] || []) : [];
    return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr>{["Version", "File Name", "Updated By", "Updated At", "Change Note", "File Size", "Status", "Actions"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.map((row, index) => <tr key={`${row.version}-${index}`}><td className="px-4 py-4 font-semibold text-white">{row.version}</td><td className="px-4 py-4 text-slate-300">{row.fileName}</td><td className="px-4 py-4 text-slate-300">{row.updatedBy}</td><td className="px-4 py-4 text-slate-300">{row.updatedAt ? new Date(row.updatedAt).toLocaleString("vi-VN") : "N/A"}</td><td className="px-4 py-4 text-slate-300">{row.changeNote}</td><td className="px-4 py-4 text-slate-300">{formatFileSize(row.fileSize)}</td><td className="px-4 py-4 text-slate-300">{row.status}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button className="px-3 py-1 text-xs" onClick={() => setPreviewData({ firstRows: [], sheets: [row.fileName], rowCount: 0, columnCount: 0 })}>View Version</Button><Button className="px-3 py-1 text-xs" onClick={() => selectedTemplate && handleDownloadTemplate(selectedTemplate)}>Download Version</Button><Button className="px-3 py-1 text-xs" onClick={() => selectedTemplate && handleRollbackTemplateVersion(selectedTemplate, index)}>Rollback</Button><Button className="px-3 py-1 text-xs" onClick={() => showToast("Compare metadata version đã sẵn trong history.")}>Compare</Button><Button className="px-3 py-1 text-xs" variant="danger" onClick={() => showToast("Delete old version cần endpoint dọn version riêng.")}>Delete Old Version</Button></div></td></tr>)}</tbody></table>{!rows.length ? <p className="mt-4 text-sm text-slate-400">Chưa có version history.</p> : null}</div>;
  }

  function Info({ label, value }) {
    return <div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold text-white">{value}</p></div>;
  }

  function AnalyticsList({ title, rows, valueKey }) {
    return <div className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="font-semibold text-white">{title}</p><div className="mt-3 space-y-2">{rows.length ? rows.slice(0, 5).map((row) => <div key={row.id} className="flex justify-between gap-3 text-sm"><span className="text-slate-300">{row.templateName}</span><span className="text-slate-500">{row[valueKey]}</span></div>) : <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>}</div></div>;
  }
}
