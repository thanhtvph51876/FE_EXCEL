/* ==========================================================================
   EXCELAI BOT - AUTHENTICATION AND ROLE SERVICE (MOCK)
   ========================================================================== */

export const authService = {
    getCurrentUser() {
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = localStorage.getItem("excelai_current_user");
                if (data) {
                    try {
                        resolve(JSON.parse(data));
                        return;
                    } catch (e) {
                        console.error("Lỗi parse current user", e);
                    }
                }
                const defaultUser = {
                    id: 1,
                    name: "Trần Minh Trí",
                    email: "trinh@excelai.com",
                    tier: "free",
                    usageCount: 12,
                    usageLimit: 20,
                    status: "Hoạt động"
                };
                localStorage.setItem("excelai_current_user", JSON.stringify(defaultUser));
                resolve(defaultUser);
            }, 600);
        });
    },

    saveCurrentUser(user) {
        localStorage.setItem("excelai_current_user", JSON.stringify(user));
    },

    switchDemoRole(role) {
        return new Promise((resolve) => {
            setTimeout(() => {
                localStorage.setItem("excelai_demo_role", role);
                resolve({ success: true, role });
            }, 500);
        });
    },

    getDemoRole() {
        return localStorage.getItem("excelai_demo_role") || "user";
    }
};

export default authService;
