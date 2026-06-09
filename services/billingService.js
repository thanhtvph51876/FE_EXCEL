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
        const payload = await apiFetch("/api/billing/pricing");
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

    async createCheckout(tier, billingCycle, couponCode = "") {
        return apiFetch("/api/billing/checkout", {
            method: "POST",
            body: JSON.stringify({ tier, billingCycle, couponCode })
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
