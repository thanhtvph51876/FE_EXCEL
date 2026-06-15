window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        const openWorkspaceFallback = () => {
            const landing = document.getElementById("landing-view");
            const workspace = document.getElementById("workspace-view");
            const headerActions = document.getElementById("header-user-actions");
            const goWorkspace = document.getElementById("go-workspace-btn");
            document.querySelectorAll(".modal-backdrop.active").forEach((modal) => {
                modal.classList.remove("active");
            });
            const featureModal = document.getElementById("feature-detail-modal");
            if (featureModal) featureModal.style.display = "none";
            landing?.classList.remove("active");
            workspace?.classList.add("active");
            if (headerActions) headerActions.style.display = "flex";
            if (goWorkspace) goWorkspace.style.display = "none";
            window.scrollTo(0, 0);
        };
        if (!window.__excelAiAuthReady && localStorage.getItem("excelai_token")) {
            openWorkspaceFallback();
        }
        if (window.__excelAiAuthReady) return;
        const modal = document.getElementById("auth-modal");
        const openBtn = document.getElementById("auth-open-btn");
        const closeBtn = document.getElementById("auth-close-btn");
        const form = document.getElementById("auth-form");
        const submitBtn = document.getElementById("auth-submit-btn");
        const title = document.getElementById("auth-modal-title");
        const nameGroup = document.getElementById("auth-name-group");
        const toggleBtn = document.getElementById("auth-toggle-btn");
        const toastBox = document.getElementById("toast-container");
        let mode = "login";

        const toast = (message, type = "info") => {
            if (!toastBox) {
                alert(message);
                return;
            }
            const item = document.createElement("div");
            item.className = `toast ${type}`;
            item.textContent = message;
            toastBox.appendChild(item);
            setTimeout(() => item.remove(), 3500);
        };
        const syncMode = () => {
            const isRegister = mode === "register";
            if (title) title.textContent = isRegister ? "Đăng ký ExcelAI" : "Đăng nhập ExcelAI";
            if (nameGroup) nameGroup.style.display = isRegister ? "block" : "none";
            if (submitBtn) submitBtn.textContent = isRegister ? "Đăng ký" : "Đăng nhập";
            if (toggleBtn) toggleBtn.textContent = isRegister ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký";
        };
        const openModal = () => {
            mode = "login";
            syncMode();
            modal?.classList.add("active");
            document.getElementById("auth-email-input")?.focus();
        };

        openBtn?.addEventListener("click", openModal);
        closeBtn?.addEventListener("click", () => modal?.classList.remove("active"));
        toggleBtn?.addEventListener("click", (event) => {
            event.preventDefault();
            mode = mode === "login" ? "register" : "login";
            syncMode();
        });
        form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const email = document.getElementById("auth-email-input")?.value.trim() || "";
            const password = document.getElementById("auth-password-input")?.value || "";
            const name = document.getElementById("auth-name-input")?.value.trim() || email.split("@")[0];
            if (!email || !password) {
                toast("Vui lòng nhập email và mật khẩu", "error");
                return;
            }
            const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
            const body = mode === "register" ? { name, email, password } : { email, password };
            submitBtn.disabled = true;
            try {
                const apiBase = window.EXCELAI_API_BASE || "http://127.0.0.1:8002";
                const apiBases = apiBase.includes("127.0.0.1")
                    ? [apiBase, apiBase.replace("127.0.0.1", "localhost")]
                    : [apiBase, apiBase.replace("localhost", "127.0.0.1")];
                let res = null;
                for (const base of [...new Set(apiBases)]) {
                    try {
                        res = await fetch(`${base}${path}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body)
                        });
                        break;
                    } catch (error) {
                        res = null;
                    }
                }
                if (!res) throw new Error(`Không kết nối được backend tại ${[...new Set(apiBases)].join(" hoặc ")}. Hãy kiểm tra server API đang chạy trên port 8002.`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || data.detail || `Lỗi ${res.status}`);
                if (data.token) localStorage.setItem("excelai_token", data.token);
                if (data.refreshToken) localStorage.setItem("excelai_refresh_token", data.refreshToken);
                if (data.user) localStorage.setItem("excelai_current_user", JSON.stringify(data.user));
                modal?.classList.remove("active");
                toast(mode === "register" ? "Đăng ký thành công" : "Đăng nhập thành công", "success");
                openWorkspaceFallback();
            } catch (error) {
                toast(error.message || "Không thể đăng nhập", "error");
            } finally {
                submitBtn.disabled = false;
                syncMode();
            }
        });
    }, 800);
});
