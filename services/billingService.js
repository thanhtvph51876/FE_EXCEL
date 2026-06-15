/* ==========================================================================
   EXCELAI BOT - BILLING AND SUBSCRIPTION SERVICE
   ========================================================================== */

import { apiFetch } from "./config.js";

const cache = {
    users: [],
    coupons: [],
    pricing: {
        monthly: { pro: "149,000đ", business: "299,000đ", enterprise: "399,000đ", period: "/tháng" },
        annual: { pro: "119,000đ", business: "239,000đ", enterprise: "319,000đ", period: "/tháng (trả năm)" }
    }
};

export const billingService = {
    loadUsers() {
        return cache.users;
    },

    saveUsers(users) {
        cache.users = Array.isArray(users) ? users : [];
        return Promise.resolve({ success: true, users: cache.users });
    },

    loadCoupons() {
        return cache.coupons;
    },

    saveCoupons(coupons) {
        cache.coupons = Array.isArray(coupons) ? coupons : [];
        return Promise.resolve({ success: true, coupons: cache.coupons });
    },

    loadPricing() {
        return cache.pricing;
    },

    async refreshPricing() {
        const payload = await apiFetch("/api/billing/plans");
        if (Array.isArray(payload.plans)) {
            const pro = payload.plans.find(plan => plan.id === "pro");
            if (pro) {
                cache.pricing.monthly.pro = Number(pro.monthlyPrice || 0).toLocaleString("vi-VN") + "đ";
                cache.pricing.annual.pro = Number(pro.yearlyPrice || 0).toLocaleString("vi-VN") + "đ";
            }
            return { ...cache.pricing, plans: payload.plans, providers: payload.providers || [], paymentConfigured: Boolean(payload.paymentConfigured) };
        }
        cache.pricing = {
            monthly: { ...cache.pricing.monthly, ...(payload.monthly || {}) },
            annual: { ...cache.pricing.annual, ...(payload.annual || {}) }
        };
        return cache.pricing;
    },

    async refreshCoupons() {
        const payload = await apiFetch("/api/admin/coupons");
        cache.coupons = Array.isArray(payload.coupons) ? payload.coupons : [];
        return cache.coupons;
    },

    async createCoupon(code, percent) {
        const payload = await apiFetch("/api/admin/coupons", {
            method: "POST",
            body: JSON.stringify({ code, percent })
        });
        if (payload?.coupon) {
            const index = cache.coupons.findIndex(coupon => coupon.code === payload.coupon.code);
            if (index >= 0) cache.coupons[index] = payload.coupon;
            else cache.coupons.unshift(payload.coupon);
        }
        return payload?.coupon;
    },

    async deleteCoupon(code) {
        await apiFetch(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: "DELETE" });
        cache.coupons = cache.coupons.filter(coupon => coupon.code !== code);
        return { success: true };
    },

    async validateCoupon(code) {
        const payload = await apiFetch(`/api/billing/coupons/${encodeURIComponent(code.trim().toUpperCase())}/validate`);
        return payload || { valid: false };
    },

    calculateDiscount(basePriceStr, discountPercent) {
        let numVal = parseInt(basePriceStr.replace(/[^0-9]/g, ""));
        if (isNaN(numVal)) return basePriceStr;
        
        if (discountPercent > 0) {
            numVal = Math.round(numVal * (1 - discountPercent / 100));
        }
        return numVal.toLocaleString("vi-VN") + "đ";
    },

    async getOwnTier() {
        return apiFetch("/api/billing/tier");
    },

    async getEntitlements() {
        return apiFetch("/api/billing/entitlements");
    },

    async getCheckoutRequests() {
        return apiFetch("/api/billing/checkout-requests");
    },

    async createCheckout(tier, billingCycle, couponCode = "", provider = "") {
        return apiFetch("/api/billing/checkout", {
            method: "POST",
            body: JSON.stringify({ planId: tier, billingCycle, couponCode, provider })
        });
    },

    async getPlans() {
        return apiFetch("/api/billing/plans");
    },

    async getAccount() {
        return apiFetch("/api/billing/account");
    },

    async getOrderStatus(orderId) {
        return apiFetch(`/api/billing/orders/${encodeURIComponent(orderId)}/status`);
    },

    async getBillingHistory() {
        return apiFetch("/api/billing/history");
    },

    async createEnterpriseLead(payload) {
        return apiFetch("/api/billing/enterprise-leads", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    },

    async updateOwnTier() {
        throw new Error("User không được tự cập nhật gói tài khoản. Hãy tạo checkout hoặc dùng API admin.");
    },

    updateUserTier(userId, newTier) {
        const user = cache.users.find(u => String(u.id) === String(userId));
        if (user) {
            user.tier = newTier;
            if (newTier === "free") {
                user.usageLimit = 20;
            } else if (newTier === "pro") {
                user.usageLimit = 500;
            } else if (newTier === "enterprise" || newTier === "business") {
                user.usageLimit = Infinity;
            }
        }
        return user || null;
    },

    updateUserUsage(userId, usageCount) {
        const user = cache.users.find(u => String(u.id) === String(userId));
        if (user) user.usageCount = usageCount;
        return user || null;
    }
};

export default billingService;
