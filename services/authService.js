import { apiFetch, clearAuth, getAccessToken, setAuthTokens } from "./config.js";

export const authService = {
    async getCurrentUser() {
        const token = getAccessToken();
        if (!token) return null;
        const user = await apiFetch("/api/auth/me");
        localStorage.setItem("excelai_current_user", JSON.stringify(user));
        return user;
    },

    async login(email, password) {
        const data = await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        setAuthTokens(data);
        return data;
    },

    async register(name, email, password) {
        const data = await apiFetch("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password })
        });
        setAuthTokens(data);
        return data;
    },

    async getGoogleConfig() {
        return apiFetch("/api/auth/google/config", { skipAuthRefresh: true });
    },

    async loginWithGoogle(credential) {
        const data = await apiFetch("/api/auth/google", {
            method: "POST",
            skipAuthRefresh: true,
            body: JSON.stringify({ credential })
        });
        setAuthTokens(data);
        return data;
    },

    async forgotPassword(email) {
        return apiFetch("/api/auth/forgot-password", {
            method: "POST",
            skipAuthRefresh: true,
            body: JSON.stringify({ email })
        });
    },

    async resetPassword(token, password) {
        return apiFetch("/api/auth/reset-password", {
            method: "POST",
            skipAuthRefresh: true,
            body: JSON.stringify({ token, password })
        });
    },

    async logout() {
        try {
            await apiFetch("/api/auth/logout", { method: "POST" });
        } finally {
            clearAuth();
        }
    },

    saveCurrentUser(user) {
        localStorage.setItem("excelai_current_user", JSON.stringify(user));
    }
};

export default authService;
