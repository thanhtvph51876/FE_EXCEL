import React, { useEffect, useMemo, useState } from "react";
import { adminService } from "./services/adminService.js";

const emptyCouponForm = {
  code: "",
  campaignName: "",
  discountType: "percent",
  discountValue: 10,
  applicablePlans: ["pro"],
  maxUsage: 100,
  usagePerUser: 1,
  startDate: "",
  endDate: "",
  minimumOrderValue: 0,
  newUsersOnly: false,
  firstPurchaseOnly: false,
  status: "active",
};

const emptyManualUpgradeForm = {
  selectedUser: "",
  currentPlan: "",
  targetPlan: "pro",
  duration: "30",
  startDate: "",
  expiryDate: "",
  reason: "",
  paymentNote: "",
  notifyUser: true,
  bypassExternalPayment: true,
  recordBillingLog: true,
};

const emptyPlanForm = {
  planName: "",
  planCode: "",
  monthlyPrice: 0,
  yearlyPrice: 0,
  description: "",
  monthlyUsageLimit: 0,
  monthlyTokenLimit: 0,
  workspaceLimit: 1,
  storageLimit: 0,
  uploadLimit: 0,
  enabledFeatures: [],
  status: "active",
  publicPurchaseEnabled: true,
  manualUpgradeEnabled: true,
  highlighted: false,
};

const defaultBillingSettings = {
  defaultCurrency: "VND",
  vatPercent: 0,
  allowFreeTrial: false,
  trialDays: 14,
  autoLockExpiredPlan: true,
  expirationWarningDays: 7,
  sendRenewalEmail: true,
  allowCouponStacking: false,
  allowMidCycleUpgrade: true,
  allowDowngrade: true,
  refundPolicy: "manual_review",
  billingNotificationEmail: "billing@excelai.local",
};

const planOptions = ["free", "pro", "business", "enterprise"];

export default function BillingPricingManagementDashboard() {
  const [pricingPlans, setPricingPlans] = useState([]);
  const [couponForm, setCouponForm] = useState(emptyCouponForm);
  const [coupons, setCoupons] = useState([]);
  const [manualUpgradeForm, setManualUpgradeForm] = useState(emptyManualUpgradeForm);
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [billingSettings, setBillingSettings] = useState(defaultBillingSettings);
  const [billingAlerts, setBillingAlerts] = useState([]);
  const [billingLogs, setBillingLogs] = useState([]);

  const [billingKpis, setBillingKpis] = useState({});
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [editingPlanCode, setEditingPlanCode] = useState("");
  const [editingCouponCode, setEditingCouponCode] = useState("");
  const [activeModal, setActiveModal] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    handleRefresh();
  }, []);

  const activeSubscriptionsByPlan = useMemo(() => {
    return subscriptions.reduce((acc, row) => {
      const key = row.currentPlan || "free";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [subscriptions]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function formatCurrency(value, currency = billingSettings.defaultCurrency || "VND") {
    const amount = Number(value || 0);
    if (currency === "VND") return `${amount.toLocaleString("vi-VN")}đ`;
    return `${currency} ${amount.toLocaleString("vi-VN")}`;
  }

  function getPlanBadge(plan) {
    const badges = {
      free: "border-slate-500/30 bg-slate-500/20 text-slate-300",
      pro: "border-blue-500/30 bg-blue-500/20 text-blue-400",
      business: "border-green-500/30 bg-green-500/20 text-green-400",
      enterprise: "border-purple-500/30 bg-purple-500/20 text-purple-400",
    };
    return badges[String(plan || "").toLowerCase()] || badges.free;
  }

  function getBillingStatusBadge(status) {
    const value = String(status || "").toLowerCase();
    if (["active", "paid", "confirmed", "success", "succeeded"].includes(value)) return "border-green-500/30 bg-green-500/20 text-green-400";
    if (["pending", "draft"].includes(value)) return "border-yellow-500/30 bg-yellow-500/20 text-yellow-400";
    if (["failed", "cancelled", "rejected"].includes(value)) return "border-red-500/30 bg-red-500/20 text-red-400";
    if (["expired", "inactive"].includes(value)) return "border-slate-500/30 bg-slate-500/20 text-slate-300";
    return "border-slate-500/30 bg-slate-500/20 text-slate-300";
  }

  function calculateDiscountedPrice(price, coupon = couponForm) {
    const amount = Number(price || 0);
    const value = Number(coupon.discountValue || 0);
    if (coupon.discountType === "percent") return Math.max(0, Math.round(amount * (1 - value / 100)));
    if (coupon.discountType === "fixed_amount") return Math.max(0, amount - value);
    if (coupon.discountType === "first_month_free") return 0;
    return amount;
  }

  function validatePricingForm(form = planForm) {
    const errors = {};
    if (!String(form.planName || "").trim()) errors.planName = "Plan name không được rỗng.";
    const code = String(form.planCode || "").trim().toLowerCase();
    if (!code) errors.planCode = "Plan code không được rỗng.";
    if (!editingPlanCode && pricingPlans.some((plan) => String(plan.planCode).toLowerCase() === code)) errors.planCode = "Plan code không được trùng.";
    if (Number(form.monthlyPrice) < 0) errors.monthlyPrice = "Monthly price phải >= 0.";
    if (Number(form.yearlyPrice) < 0) errors.yearlyPrice = "Yearly price phải >= 0.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateCouponForm(form = couponForm) {
    const errors = {};
    if (!String(form.code || "").trim()) errors.code = "Coupon code không được rỗng.";
    if (form.discountType === "percent" && (Number(form.discountValue) < 1 || Number(form.discountValue) > 100)) errors.discountValue = "Discount percent phải từ 1 đến 100.";
    if (form.discountType === "fixed_amount" && Number(form.discountValue) <= 0) errors.discountValue = "Fixed amount phải lớn hơn 0.";
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) errors.endDate = "End date phải lớn hơn start date.";
    if (Number(form.maxUsage) <= 0) errors.maxUsage = "Max usage phải lớn hơn 0.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateManualUpgrade(form = manualUpgradeForm) {
    const errors = {};
    if (!String(form.selectedUser || "").trim()) errors.selectedUser = "User cấp gói thủ công không được rỗng.";
    if (!String(form.reason || "").trim()) errors.reason = "Lý do cấp gói thủ công không được rỗng.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleRefresh() {
    setIsLoading(true);
    try {
      const payload = await adminService.getBillingAdvancedDashboard();
      setPricingPlans(Array.isArray(payload.pricingPlans) ? payload.pricingPlans : []);
      setCoupons(Array.isArray(payload.coupons) ? payload.coupons : []);
      setPendingPurchases(Array.isArray(payload.pendingPurchases) ? payload.pendingPurchases : []);
      setSubscriptions(Array.isArray(payload.subscriptions) ? payload.subscriptions : []);
      setPaymentHistory(Array.isArray(payload.paymentHistory) ? payload.paymentHistory : []);
      setBillingSettings({ ...defaultBillingSettings, ...(payload.billingSettings || {}) });
      setBillingAlerts(Array.isArray(payload.billingAlerts) ? payload.billingAlerts : []);
      setBillingLogs(Array.isArray(payload.billingLogs) ? payload.billingLogs : []);
      setBillingKpis(payload.billingKpis || {});
    } catch (error) {
      showToast(error.message || "Không thể tải dữ liệu billing thật.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdatePricing() {
    setIsSaving(true);
    try {
      await Promise.all(pricingPlans.map((plan) => adminService.updatePricingPlan(plan.planCode, plan)));
      showToast("Đã cập nhật bảng giá vào backend.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể cập nhật pricing.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreatePlan() {
    if (!validatePricingForm()) return;
    setIsSaving(true);
    try {
      const action = editingPlanCode
        ? adminService.updatePricingPlan(editingPlanCode, planForm)
        : adminService.createPricingPlan(planForm);
      await action;
      setActiveModal(null);
      setPlanForm(emptyPlanForm);
      setEditingPlanCode("");
      showToast(editingPlanCode ? "Đã sửa gói dịch vụ." : "Đã tạo gói mới.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể lưu gói dịch vụ.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditPlan(plan) {
    setPlanForm({ ...emptyPlanForm, ...plan });
    setEditingPlanCode(plan.planCode);
    setActiveModal("plan");
  }

  async function handleDeletePlan(plan, force = false) {
    if (!force && Number(plan.activeSubscriptions || activeSubscriptionsByPlan[plan.planCode] || 0) > 0) {
      setConfirmAction({ type: "deletePlan", payload: plan, forceRequired: true });
      setActiveModal("confirm");
      return;
    }
    setIsSaving(true);
    try {
      await adminService.deletePricingPlan(plan.planCode, force);
      showToast("Đã xóa gói dịch vụ.");
      setActiveModal(null);
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể xóa gói.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateCoupon() {
    if (!validateCouponForm()) return;
    setIsSaving(true);
    try {
      const action = editingCouponCode
        ? adminService.updateBillingCoupon(editingCouponCode, couponForm)
        : adminService.createBillingCoupon({ ...couponForm, code: couponForm.code.toUpperCase() });
      await action;
      setCouponForm(emptyCouponForm);
      setEditingCouponCode("");
      showToast(editingCouponCode ? "Đã sửa coupon." : "Đã tạo coupon.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể lưu coupon.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditCoupon(coupon) {
    setCouponForm({ ...emptyCouponForm, ...coupon });
    setEditingCouponCode(coupon.code);
    showToast(`Đang sửa coupon ${coupon.code}.`);
  }

  async function handleDeleteCoupon(coupon) {
    setConfirmAction({ type: "deleteCoupon", payload: coupon });
    setActiveModal("confirm");
  }

  function handleGenerateCouponCode() {
    const code = `EXCEL${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setCouponForm((prev) => ({ ...prev, code }));
  }

  function handlePreviewCoupon() {
    if (!validateCouponForm()) return;
    const proPlan = pricingPlans.find((plan) => plan.planCode === "pro");
    const original = proPlan?.monthlyPrice || 0;
    const discounted = calculateDiscountedPrice(original);
    showToast(`Preview: Pro monthly ${formatCurrency(original)} -> ${formatCurrency(discounted)}.`);
  }

  async function handleManualUpgrade() {
    if (!validateManualUpgrade()) return;
    setIsSaving(true);
    try {
      await adminService.manualUpgradeUser(manualUpgradeForm);
      setManualUpgradeForm(emptyManualUpgradeForm);
      showToast("Đã cấp gói thủ công và ghi billing log.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể cấp gói thủ công.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApprovePurchase(purchase) {
    setConfirmAction({ type: "approvePurchase", payload: purchase });
    setActiveModal("confirm");
  }

  async function handleRejectPurchase(purchase) {
    setConfirmAction({ type: "rejectPurchase", payload: purchase });
    setActiveModal("confirm");
  }

  async function handleRequestMoreInfo(purchase) {
    setIsSaving(true);
    try {
      await adminService.requestCheckoutMoreInfo(purchase.id, "Admin yêu cầu bổ sung thông tin thanh toán.");
      showToast("Đã ghi yêu cầu bổ sung thông tin.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể yêu cầu thêm thông tin.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangeSubscriptionPlan(subscription, targetPlan = manualUpgradeForm.targetPlan) {
    setIsSaving(true);
    try {
      await adminService.changeSubscriptionPlan(subscription.id, targetPlan);
      showToast("Đã đổi gói subscription.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể đổi gói subscription.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancelSubscription(subscription) {
    setConfirmAction({ type: "cancelSubscription", payload: subscription });
    setActiveModal("confirm");
  }

  async function handleSaveBillingSettings() {
    setIsSaving(true);
    try {
      await adminService.saveBillingSettings(billingSettings);
      showToast("Đã lưu billing settings.");
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể lưu billing settings.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleExportRevenueReport() {
    const rows = [
      ["section", "id", "user", "plan", "amount", "status", "time"],
      ...pendingPurchases.map((row) => ["purchase", row.id, row.email, row.requestedPlan, row.amount, row.status, row.createdAt]),
      ...subscriptions.map((row) => ["subscription", row.id, row.email, row.currentPlan, row.amount, row.status, row.expiryDate]),
      ...paymentHistory.map((row) => ["payment", row.transactionId, row.user, row.plan, row.amount, row.status, row.paidAt]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `billing-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Đã xuất báo cáo doanh thu.");
  }

  async function runConfirmAction() {
    if (!confirmAction) return;
    const { type, payload } = confirmAction;
    setIsSaving(true);
    try {
      if (type === "deletePlan") await handleDeletePlan(payload, true);
      if (type === "deleteCoupon") await adminService.deleteBillingCoupon(payload.code);
      if (type === "approvePurchase") await adminService.confirmCheckoutRequest(payload.id, "admin_approved_from_react_dashboard");
      if (type === "rejectPurchase") await adminService.rejectCheckoutRequest(payload.id, "admin_rejected_from_react_dashboard");
      if (type === "cancelSubscription") await adminService.cancelSubscription(payload.id, "admin_cancel_from_react_dashboard");
      if (type === "deletePurchase") await adminService.deleteCheckoutRequest(payload.id);
      showToast("Đã thực hiện thao tác billing.");
      setActiveModal(null);
      setConfirmAction(null);
      await handleRefresh();
    } catch (error) {
      showToast(error.message || "Không thể thực hiện thao tác.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const Button = ({ children, variant = "secondary", className = "", ...props }) => {
    const variants = {
      primary: "bg-green-600 hover:bg-green-700 text-white border border-green-600",
      secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700",
      warning: "bg-orange-600 hover:bg-orange-700 text-white border border-orange-600",
      danger: "bg-transparent border border-red-500 text-red-400 hover:bg-red-500/10",
    };
    return <button className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>{children}</button>;
  };
  const Badge = ({ children, className }) => <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;
  const Input = ({ label, error, className = "", ...props }) => <label className={`space-y-2 ${className}`}><span className="text-xs font-semibold uppercase text-slate-400">{label}</span><input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-green-500" {...props} />{error ? <span className="text-xs text-red-400">{error}</span> : null}</label>;
  const Select = ({ label, children, className = "", ...props }) => <label className={`space-y-2 ${className}`}><span className="text-xs font-semibold uppercase text-slate-400">{label}</span><select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-green-500" {...props}>{children}</select></label>;
  const Toggle = ({ label, checked, onChange }) => <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200"><input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-green-600" />{label}</label>;
  const Card = ({ title, children }) => <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow"><h2 className="text-lg font-bold text-white">{title}</h2><div className="mt-4">{children}</div></section>;
  const Modal = ({ title, children }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"><div className="mb-5 flex justify-between gap-4"><h3 className="text-xl font-bold text-white">{title}</h3><Button onClick={() => setActiveModal(null)}>Close</Button></div>{children}</div></div>;

  const kpis = [
    ["monthlyRevenue", formatCurrency(billingKpis.monthlyRevenue)],
    ["todayRevenue", formatCurrency(billingKpis.todayRevenue)],
    ["paidUsers", billingKpis.paidUsers || 0],
    ["activeSubscriptions", billingKpis.activeSubscriptions || subscriptions.length],
    ["pendingPurchases", billingKpis.pendingPurchases || pendingPurchases.filter((row) => row.status === "pending").length],
    ["activeCoupons", billingKpis.activeCoupons || coupons.filter((row) => row.status === "active").length],
    ["freeToPaidConversion", `${Number(billingKpis.freeToPaidConversion || 0).toFixed(2)}%`],
    ["couponDiscountAmount", formatCurrency(billingKpis.couponDiscountAmount)],
    ["topPlan", billingKpis.topPlan || "N/A"],
    ["expiringSubscriptions", billingKpis.expiringSubscriptions || 0],
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      {toast ? <div className={`fixed right-4 top-4 z-[60] rounded-2xl border px-4 py-3 text-sm shadow-2xl ${toast.type === "error" ? "border-red-500/40 bg-red-500/15 text-red-200" : "border-green-500/40 bg-green-500/15 text-green-200"}`}>{toast.message}</div> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Cấu hình Giá cước & Coupons Khuyến mãi 💳</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">Quản lý bảng giá SaaS, mã giảm giá, đăng ký gói, yêu cầu thanh toán và doanh thu.</p>
              {isLoading ? <p className="mt-3 text-sm text-blue-300">Đang tải dữ liệu billing thật từ backend...</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => document.getElementById("coupon-form")?.scrollIntoView({ behavior: "smooth" })}>Tạo Coupon</Button>
              <Button onClick={() => { setPlanForm(emptyPlanForm); setEditingPlanCode(""); setActiveModal("plan"); }}>Tạo Gói Mới</Button>
              <Button variant="warning" onClick={handleExportRevenueReport}>Xuất báo cáo doanh thu</Button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold text-white">{value}</p></div>)}
        </section>

        <Card title="Pricing Plans">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Monthly Price</th><th className="px-4 py-3">Yearly Price</th><th className="px-4 py-3">Usage Limit</th><th className="px-4 py-3">Token Limit</th><th className="px-4 py-3">Workspace Limit</th><th className="px-4 py-3">Storage Limit</th><th className="px-4 py-3">Features</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {pricingPlans.map((plan) => (
                  <tr key={plan.planCode} className="hover:bg-slate-800/40">
                    <td className="px-4 py-4"><Badge className={getPlanBadge(plan.planCode)}>{plan.planName}</Badge></td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(plan.monthlyPrice)}</td>
                    <td className="px-4 py-4 text-slate-300">{formatCurrency(plan.yearlyPrice)}</td>
                    <td className="px-4 py-4 text-slate-300">{Number(plan.monthlyUsageLimit || 0).toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-4 text-slate-300">{Number(plan.monthlyTokenLimit || 0).toLocaleString("vi-VN")}</td>
                    <td className="px-4 py-4 text-slate-300">{plan.workspaceLimit}</td>
                    <td className="px-4 py-4 text-slate-300">{plan.storageLimit} MB</td>
                    <td className="max-w-xs px-4 py-4 text-slate-300">{(plan.enabledFeatures || []).slice(0, 4).join(", ")}</td>
                    <td className="px-4 py-4"><Badge className={getBillingStatusBadge(plan.status)}>{plan.status}</Badge></td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button className="px-3 py-1 text-xs" onClick={() => handleEditPlan(plan)}>Edit</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => adminService.updatePricingPlan(plan.planCode, { ...plan, status: plan.status === "active" ? "disabled" : "active" }).then(handleRefresh)}>Enable/Disable</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => { setPlanForm({ ...plan, planName: `${plan.planName} Copy`, planCode: `${plan.planCode}_copy` }); setEditingPlanCode(""); setActiveModal("plan"); }}>Duplicate</Button>
                        <Button className="px-3 py-1 text-xs" onClick={() => showToast(`${activeSubscriptionsByPlan[plan.planCode] || plan.activeSubscriptions || 0} user/subscription dùng gói này.`)}>View Users</Button>
                        <Button className="px-3 py-1 text-xs" variant="danger" onClick={() => handleDeletePlan(plan)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end"><Button variant="primary" onClick={handleUpdatePricing} disabled={isSaving}>Cập nhật toàn bộ pricing</Button></div>
        </Card>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Create Coupon">
            <div id="coupon-form" className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="code" value={couponForm.code} error={formErrors.code} onChange={(event) => setCouponForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))} />
              <Input label="campaignName" value={couponForm.campaignName} onChange={(event) => setCouponForm((prev) => ({ ...prev, campaignName: event.target.value }))} />
              <Select label="discountType" value={couponForm.discountType} onChange={(event) => setCouponForm((prev) => ({ ...prev, discountType: event.target.value }))}><option value="percent">percent</option><option value="fixed_amount">fixed_amount</option><option value="first_month_free">first_month_free</option><option value="trial_extension">trial_extension</option></Select>
              <Input label="discountValue" type="number" value={couponForm.discountValue} error={formErrors.discountValue} onChange={(event) => setCouponForm((prev) => ({ ...prev, discountValue: event.target.value }))} />
              <Input label="applicablePlans" value={(couponForm.applicablePlans || []).join(",")} onChange={(event) => setCouponForm((prev) => ({ ...prev, applicablePlans: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} />
              <Input label="maxUsage" type="number" value={couponForm.maxUsage} error={formErrors.maxUsage} onChange={(event) => setCouponForm((prev) => ({ ...prev, maxUsage: event.target.value }))} />
              <Input label="usagePerUser" type="number" value={couponForm.usagePerUser} onChange={(event) => setCouponForm((prev) => ({ ...prev, usagePerUser: event.target.value }))} />
              <Input label="minimumOrderValue" type="number" value={couponForm.minimumOrderValue} onChange={(event) => setCouponForm((prev) => ({ ...prev, minimumOrderValue: event.target.value }))} />
              <Input label="startDate" type="date" value={couponForm.startDate} onChange={(event) => setCouponForm((prev) => ({ ...prev, startDate: event.target.value }))} />
              <Input label="endDate" type="date" value={couponForm.endDate} error={formErrors.endDate} onChange={(event) => setCouponForm((prev) => ({ ...prev, endDate: event.target.value }))} />
              <Select label="status" value={couponForm.status} onChange={(event) => setCouponForm((prev) => ({ ...prev, status: event.target.value }))}><option value="active">active</option><option value="paused">paused</option><option value="expired">expired</option></Select>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"><Toggle label="newUsersOnly" checked={couponForm.newUsersOnly} onChange={(event) => setCouponForm((prev) => ({ ...prev, newUsersOnly: event.target.checked }))} /><Toggle label="firstPurchaseOnly" checked={couponForm.firstPurchaseOnly} onChange={(event) => setCouponForm((prev) => ({ ...prev, firstPurchaseOnly: event.target.checked }))} /></div>
            <div className="mt-5 flex flex-wrap gap-2"><Button variant="primary" onClick={handleCreateCoupon} disabled={isSaving}>{editingCouponCode ? "Update Coupon" : "Create Coupon"}</Button><Button onClick={handlePreviewCoupon}>Preview Coupon</Button><Button onClick={handleGenerateCouponCode}>Generate Random Code</Button><Button onClick={() => { setCouponForm(emptyCouponForm); setEditingCouponCode(""); }}>Reset Form</Button></div>
          </Card>

          <Card title="Manual Upgrade">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="selectedUser" value={manualUpgradeForm.selectedUser} error={formErrors.selectedUser} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, selectedUser: event.target.value }))} />
              <Input label="currentPlan" value={manualUpgradeForm.currentPlan} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, currentPlan: event.target.value }))} />
              <Select label="targetPlan" value={manualUpgradeForm.targetPlan} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, targetPlan: event.target.value }))}>{planOptions.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
              <Input label="duration" type="number" value={manualUpgradeForm.duration} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, duration: event.target.value }))} />
              <Input label="startDate" type="date" value={manualUpgradeForm.startDate} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, startDate: event.target.value }))} />
              <Input label="expiryDate" type="date" value={manualUpgradeForm.expiryDate} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, expiryDate: event.target.value }))} />
              <Input className="md:col-span-2" label="reason" value={manualUpgradeForm.reason} error={formErrors.reason} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, reason: event.target.value }))} />
              <Input className="md:col-span-2" label="paymentNote" value={manualUpgradeForm.paymentNote} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, paymentNote: event.target.value }))} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"><Toggle label="notifyUser" checked={manualUpgradeForm.notifyUser} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, notifyUser: event.target.checked }))} /><Toggle label="bypassExternalPayment" checked={manualUpgradeForm.bypassExternalPayment} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, bypassExternalPayment: event.target.checked }))} /><Toggle label="recordBillingLog" checked={manualUpgradeForm.recordBillingLog} onChange={(event) => setManualUpgradeForm((prev) => ({ ...prev, recordBillingLog: event.target.checked }))} /></div>
            <div className="mt-5"><Button variant="primary" onClick={handleManualUpgrade} disabled={isSaving}>Cấp gói thủ công</Button></div>
          </Card>
        </section>

        <Table title="Coupons" headers={["Code", "Campaign", "Discount Type", "Discount Value", "Applicable Plans", "Used/Limit", "Start Date", "End Date", "Status", "Revenue Impact", "Actions"]}>
          {coupons.map((row) => <tr key={row.code} className="hover:bg-slate-800/40"><td className="px-4 py-4 font-semibold text-white">{row.code}</td><td className="px-4 py-4 text-slate-300">{row.campaignName}</td><td className="px-4 py-4 text-slate-300">{row.discountType}</td><td className="px-4 py-4 text-slate-300">{row.discountValue}</td><td className="px-4 py-4 text-slate-300">{(row.applicablePlans || []).join(", ")}</td><td className="px-4 py-4 text-slate-300">{row.used}/{row.maxUsage}</td><td className="px-4 py-4 text-slate-300">{row.startDate || "N/A"}</td><td className="px-4 py-4 text-slate-300">{row.endDate || "N/A"}</td><td className="px-4 py-4"><Badge className={getBillingStatusBadge(row.status)}>{row.status}</Badge></td><td className="px-4 py-4 text-slate-300">{formatCurrency(row.revenueImpact)}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button className="px-3 py-1 text-xs" onClick={() => handleEditCoupon(row)}>Edit</Button><Button className="px-3 py-1 text-xs" onClick={() => adminService.updateBillingCoupon(row.code, { ...row, status: row.status === "active" ? "paused" : "active" }).then(handleRefresh)}>{row.status === "active" ? "Pause" : "Reactivate"}</Button><Button className="px-3 py-1 text-xs" onClick={() => { setCouponForm({ ...row, code: `${row.code}_COPY` }); setEditingCouponCode(""); }}>Duplicate</Button><Button className="px-3 py-1 text-xs" onClick={() => showToast(`${row.used || 0} lượt dùng coupon ${row.code}.`)}>Usage History</Button><Button className="px-3 py-1 text-xs" variant="danger" onClick={() => handleDeleteCoupon(row)}>Delete</Button></div></td></tr>)}
        </Table>

        <Table title="Pending Purchases" headers={["User", "Email", "Requested Plan", "Billing Cycle", "Amount", "Coupon", "Payment Method", "Payment Status", "Created At", "User Note", "Actions"]}>
          {pendingPurchases.map((row) => <tr key={row.id} className="hover:bg-slate-800/40"><td className="px-4 py-4 font-semibold text-white">{row.user}</td><td className="px-4 py-4 text-slate-300">{row.email}</td><td className="px-4 py-4"><Badge className={getPlanBadge(row.requestedPlan)}>{row.requestedPlan}</Badge></td><td className="px-4 py-4 text-slate-300">{row.billingCycle}</td><td className="px-4 py-4 text-slate-300">{formatCurrency(row.amount, row.currency)}</td><td className="px-4 py-4 text-slate-300">{row.coupon || "-"}</td><td className="px-4 py-4 text-slate-300">{row.paymentMethod}</td><td className="px-4 py-4"><Badge className={getBillingStatusBadge(row.paymentStatus)}>{row.paymentStatus}</Badge></td><td className="px-4 py-4 text-slate-300">{row.createdAt ? new Date(row.createdAt).toLocaleString("vi-VN") : "N/A"}</td><td className="max-w-xs px-4 py-4 text-slate-300">{row.userNote}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button className="px-3 py-1 text-xs" onClick={() => { setSelectedPurchase(row); setActiveModal("purchase"); }}>View Detail</Button><Button className="px-3 py-1 text-xs" variant="primary" onClick={() => handleApprovePurchase(row)}>Approve</Button><Button className="px-3 py-1 text-xs" variant="danger" onClick={() => handleRejectPurchase(row)}>Reject</Button><Button className="px-3 py-1 text-xs" onClick={() => handleRequestMoreInfo(row)}>Request More Info</Button><Button className="px-3 py-1 text-xs" onClick={() => showToast(`Đã ghi reminder cho ${row.email}.`)}>Send Payment Reminder</Button><Button className="px-3 py-1 text-xs" variant="danger" onClick={() => { setConfirmAction({ type: "deletePurchase", payload: row }); setActiveModal("confirm"); }}>Delete</Button></div></td></tr>)}
        </Table>

        <Table title="Active Subscriptions" headers={["User", "Email", "Current Plan", "Billing Cycle", "Amount", "Start Date", "Expiry Date", "Auto Renew", "Status", "Actions"]}>
          {subscriptions.map((row) => <tr key={row.id} className="hover:bg-slate-800/40"><td className="px-4 py-4 font-semibold text-white">{row.user}</td><td className="px-4 py-4 text-slate-300">{row.email}</td><td className="px-4 py-4"><Badge className={getPlanBadge(row.currentPlan)}>{row.currentPlan}</Badge></td><td className="px-4 py-4 text-slate-300">{row.billingCycle}</td><td className="px-4 py-4 text-slate-300">{formatCurrency(row.amount)}</td><td className="px-4 py-4 text-slate-300">{row.startDate ? new Date(row.startDate).toLocaleDateString("vi-VN") : "N/A"}</td><td className="px-4 py-4 text-slate-300">{row.expiryDate ? new Date(row.expiryDate).toLocaleDateString("vi-VN") : "N/A"}</td><td className="px-4 py-4 text-slate-300">{row.autoRenew ? "Yes" : "No"}</td><td className="px-4 py-4"><Badge className={getBillingStatusBadge(row.status)}>{row.status}</Badge></td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button className="px-3 py-1 text-xs" onClick={() => showToast("Renewal reminder đã được ghi nhận.")}>Renew</Button><Button className="px-3 py-1 text-xs" onClick={() => handleChangeSubscriptionPlan(row)}>Change Plan</Button><Button className="px-3 py-1 text-xs" variant="danger" onClick={() => handleCancelSubscription(row)}>Cancel</Button><Button className="px-3 py-1 text-xs" onClick={() => adminService.cancelSubscription(row.id, "admin_suspend_subscription").then(handleRefresh)}>Suspend</Button><Button className="px-3 py-1 text-xs" onClick={() => showToast(`Invoice: ${row.id}`)}>View Invoice</Button><Button className="px-3 py-1 text-xs" onClick={() => showToast(`Đã ghi renewal reminder cho ${row.email}.`)}>Send Renewal Reminder</Button></div></td></tr>)}
        </Table>

        <Table title="Payment History" headers={["Transaction ID", "User", "Plan", "Amount", "Coupon", "Method", "Status", "Paid At", "Invoice", "Actions"]}>
          {paymentHistory.map((row) => <tr key={row.transactionId} className="hover:bg-slate-800/40"><td className="px-4 py-4 font-semibold text-white">{row.transactionId}</td><td className="px-4 py-4 text-slate-300">{row.user}</td><td className="px-4 py-4 text-slate-300">{row.plan}</td><td className="px-4 py-4 text-slate-300">{formatCurrency(row.amount)}</td><td className="px-4 py-4 text-slate-300">{row.coupon || "-"}</td><td className="px-4 py-4 text-slate-300">{row.method}</td><td className="px-4 py-4"><Badge className={getBillingStatusBadge(row.status)}>{row.status}</Badge></td><td className="px-4 py-4 text-slate-300">{row.paidAt ? new Date(row.paidAt).toLocaleString("vi-VN") : "N/A"}</td><td className="px-4 py-4 text-slate-300">{row.invoice}</td><td className="px-4 py-4"><Button className="px-3 py-1 text-xs" onClick={() => showToast(`Transaction ${row.transactionId}`)}>View</Button></td></tr>)}
        </Table>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Billing Settings">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="defaultCurrency" value={billingSettings.defaultCurrency} onChange={(event) => setBillingSettings((prev) => ({ ...prev, defaultCurrency: event.target.value }))} />
              <Input label="vatPercent" type="number" value={billingSettings.vatPercent} onChange={(event) => setBillingSettings((prev) => ({ ...prev, vatPercent: event.target.value }))} />
              <Input label="trialDays" type="number" value={billingSettings.trialDays} onChange={(event) => setBillingSettings((prev) => ({ ...prev, trialDays: event.target.value }))} />
              <Input label="expirationWarningDays" type="number" value={billingSettings.expirationWarningDays} onChange={(event) => setBillingSettings((prev) => ({ ...prev, expirationWarningDays: event.target.value }))} />
              <Input className="md:col-span-2" label="refundPolicy" value={billingSettings.refundPolicy} onChange={(event) => setBillingSettings((prev) => ({ ...prev, refundPolicy: event.target.value }))} />
              <Input className="md:col-span-2" label="billingNotificationEmail" value={billingSettings.billingNotificationEmail} onChange={(event) => setBillingSettings((prev) => ({ ...prev, billingNotificationEmail: event.target.value }))} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"><Toggle label="allowFreeTrial" checked={billingSettings.allowFreeTrial} onChange={(event) => setBillingSettings((prev) => ({ ...prev, allowFreeTrial: event.target.checked }))} /><Toggle label="autoLockExpiredPlan" checked={billingSettings.autoLockExpiredPlan} onChange={(event) => setBillingSettings((prev) => ({ ...prev, autoLockExpiredPlan: event.target.checked }))} /><Toggle label="sendRenewalEmail" checked={billingSettings.sendRenewalEmail} onChange={(event) => setBillingSettings((prev) => ({ ...prev, sendRenewalEmail: event.target.checked }))} /><Toggle label="allowCouponStacking" checked={billingSettings.allowCouponStacking} onChange={(event) => setBillingSettings((prev) => ({ ...prev, allowCouponStacking: event.target.checked }))} /><Toggle label="allowMidCycleUpgrade" checked={billingSettings.allowMidCycleUpgrade} onChange={(event) => setBillingSettings((prev) => ({ ...prev, allowMidCycleUpgrade: event.target.checked }))} /><Toggle label="allowDowngrade" checked={billingSettings.allowDowngrade} onChange={(event) => setBillingSettings((prev) => ({ ...prev, allowDowngrade: event.target.checked }))} /></div>
            <div className="mt-5"><Button variant="primary" onClick={handleSaveBillingSettings} disabled={isSaving}>Lưu billing settings</Button></div>
          </Card>
          <Card title="Billing Alerts">
            <div className="space-y-3">{billingAlerts.length ? billingAlerts.map((alert) => <div key={`${alert.title}-${alert.detail}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold text-white">{alert.title}</p><Badge className={getBillingStatusBadge(alert.severity)}>{alert.severity}</Badge></div><p className="mt-2 text-sm text-slate-400">{alert.detail}</p></div>) : <p className="text-sm text-slate-400">Không có billing alert từ backend.</p>}</div>
          </Card>
        </section>

        <Table title="Billing Logs" headers={["Time", "Admin", "Action", "Affected User", "Old Value", "New Value", "Reason", "Status"]}>
          {billingLogs.map((row, index) => <tr key={`${row.time}-${index}`} className="hover:bg-slate-800/40"><td className="px-4 py-4 text-slate-300">{row.time ? new Date(row.time).toLocaleString("vi-VN") : "N/A"}</td><td className="px-4 py-4 text-slate-300">{row.admin}</td><td className="px-4 py-4 font-semibold text-white">{row.action}</td><td className="px-4 py-4 text-slate-300">{row.affectedUser}</td><td className="px-4 py-4 text-slate-300">{row.oldValue}</td><td className="px-4 py-4 text-slate-300">{row.newValue}</td><td className="px-4 py-4 text-slate-300">{row.reason}</td><td className="px-4 py-4"><Badge className={getBillingStatusBadge(row.status)}>{row.status}</Badge></td></tr>)}
        </Table>
      </div>

      {activeModal === "plan" ? <Modal title={editingPlanCode ? "Edit Plan" : "Create Plan"}><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="planName" value={planForm.planName} error={formErrors.planName} onChange={(event) => setPlanForm((prev) => ({ ...prev, planName: event.target.value }))} /><Input label="planCode" value={planForm.planCode} disabled={Boolean(editingPlanCode)} error={formErrors.planCode} onChange={(event) => setPlanForm((prev) => ({ ...prev, planCode: event.target.value.toLowerCase() }))} /><Input label="monthlyPrice" type="number" value={planForm.monthlyPrice} error={formErrors.monthlyPrice} onChange={(event) => setPlanForm((prev) => ({ ...prev, monthlyPrice: event.target.value }))} /><Input label="yearlyPrice" type="number" value={planForm.yearlyPrice} error={formErrors.yearlyPrice} onChange={(event) => setPlanForm((prev) => ({ ...prev, yearlyPrice: event.target.value }))} /><Input className="md:col-span-2" label="description" value={planForm.description} onChange={(event) => setPlanForm((prev) => ({ ...prev, description: event.target.value }))} /><Input label="monthlyUsageLimit" type="number" value={planForm.monthlyUsageLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, monthlyUsageLimit: event.target.value }))} /><Input label="monthlyTokenLimit" type="number" value={planForm.monthlyTokenLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, monthlyTokenLimit: event.target.value }))} /><Input label="workspaceLimit" type="number" value={planForm.workspaceLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, workspaceLimit: event.target.value }))} /><Input label="storageLimit" type="number" value={planForm.storageLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, storageLimit: event.target.value }))} /><Input label="uploadLimit" type="number" value={planForm.uploadLimit} onChange={(event) => setPlanForm((prev) => ({ ...prev, uploadLimit: event.target.value }))} /><Input label="enabledFeatures" value={(planForm.enabledFeatures || []).join(",")} onChange={(event) => setPlanForm((prev) => ({ ...prev, enabledFeatures: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} /><Select label="status" value={planForm.status} onChange={(event) => setPlanForm((prev) => ({ ...prev, status: event.target.value }))}><option value="active">active</option><option value="disabled">disabled</option></Select></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"><Toggle label="publicPurchaseEnabled" checked={planForm.publicPurchaseEnabled} onChange={(event) => setPlanForm((prev) => ({ ...prev, publicPurchaseEnabled: event.target.checked }))} /><Toggle label="manualUpgradeEnabled" checked={planForm.manualUpgradeEnabled} onChange={(event) => setPlanForm((prev) => ({ ...prev, manualUpgradeEnabled: event.target.checked }))} /><Toggle label="highlighted" checked={planForm.highlighted} onChange={(event) => setPlanForm((prev) => ({ ...prev, highlighted: event.target.checked }))} /></div><div className="mt-6 flex justify-end gap-2"><Button onClick={() => setActiveModal(null)}>Hủy</Button><Button variant="primary" onClick={handleCreatePlan} disabled={isSaving}>Lưu gói</Button></div></Modal> : null}
      {activeModal === "purchase" && selectedPurchase ? <Modal title="Purchase Detail"><pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200">{JSON.stringify(selectedPurchase, null, 2)}</pre></Modal> : null}
      {activeModal === "confirm" ? <Modal title="Xác nhận thao tác billing"><p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{confirmAction?.forceRequired ? "Gói này đang có subscription/user active. Cần xác nhận đặc biệt để xóa." : "Bạn có chắc muốn thực hiện thao tác này?"}</p><div className="mt-6 flex justify-end gap-2"><Button onClick={() => setActiveModal(null)}>Hủy</Button><Button variant="danger" onClick={runConfirmAction} disabled={isSaving}>Xác nhận</Button></div></Modal> : null}
    </main>
  );

  function Table({ title, headers, children }) {
    return (
      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr>{headers.map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-800">{children}</tbody>
          </table>
          {!React.Children.count(children) ? <p className="mt-4 text-sm text-slate-400">Chưa có dữ liệu thật từ backend.</p> : null}
        </div>
      </section>
    );
  }
}
