/* ==========================================================================
   EXCELAI BOT - BILLING AND SUBSCRIPTION SERVICE
   ========================================================================== */

import { initialUsers, initialCoupons } from './mockData.js';

export const billingService = {
    loadUsers() {
        const data = localStorage.getItem("excelai_users");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse users", e);
            }
        }
        localStorage.setItem("excelai_users", JSON.stringify(initialUsers));
        return initialUsers;
    },

    saveUsers(users) {
        localStorage.setItem("excelai_users", JSON.stringify(users));
    },

    loadCoupons() {
        const data = localStorage.getItem("excelai_coupons");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Lỗi parse coupons", e);
            }
        }
        localStorage.setItem("excelai_coupons", JSON.stringify(initialCoupons));
        return initialCoupons;
    },

    saveCoupons(coupons) {
        localStorage.setItem("excelai_coupons", JSON.stringify(coupons));
    },

    validateCoupon(code) {
        const coupons = this.loadCoupons();
        const coupon = coupons.find(c => c.code === code.trim().toUpperCase());
        if (coupon) {
            return { valid: true, percent: coupon.percent };
        }
        return { valid: false };
    },

    calculateDiscount(basePriceStr, discountPercent) {
        let numVal = parseInt(basePriceStr.replace(/[^0-9]/g, ""));
        if (isNaN(numVal)) return basePriceStr;
        
        if (discountPercent > 0) {
            numVal = Math.round(numVal * (1 - discountPercent / 100));
        }
        return numVal.toLocaleString("vi-VN") + "đ";
    },

    updateUserTier(userId, newTier) {
        const users = this.loadUsers();
        const user = users.find(u => u.id === userId);
        if (user) {
            user.tier = newTier;
            if (newTier === "free") {
                user.usageLimit = 20;
            } else if (newTier === "pro") {
                user.usageLimit = 500;
            } else if (newTier === "enterprise" || newTier === "business") {
                user.usageLimit = Infinity;
            }
            this.saveUsers(users);
            return user;
        }
        return null;
    }
};
export default billingService;
