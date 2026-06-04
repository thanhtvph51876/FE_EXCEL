/* ==========================================================================
   EXCELAI BOT - APPLICATION CONTROLLER (ES MODULE)
   ========================================================================== */

import { fileService } from './services/fileService.js';
import { aiService } from './services/aiService.js';
import { billingService } from './services/billingService.js';
import { adminService } from './services/adminService.js';
import { historyService } from './services/historyService.js';
import { autopilotService } from './services/autopilotService.js';
import { tableBuilderService } from './services/tableBuilderService.js';
import { documentBuilderService } from './services/documentBuilderService.js';

document.addEventListener("DOMContentLoaded", () => {
    // Helper to escape HTML characters (XSS protection)
    function escapeHTML(str) {
        if (str === null || str === undefined) return "";
        return str
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ----------------------------------------------------------------------
    // 1. APPLICATION STATE (SYNCED WITH SERVICES & LOCALSTORAGE)
    // ----------------------------------------------------------------------
    const users = billingService.loadUsers();

    function loadFeatureFlags() {
        const defaultFlags = {
            enable_autopilot: true,
            enable_table_builder: true,
            enable_document_builder: true,
            enable_data_checker: true,
            enable_reconciliation: true
        };
        const stored = localStorage.getItem("excelai_feature_flags");
        if (stored) {
            try {
                return { ...defaultFlags, ...JSON.parse(stored) };
            } catch (e) {
                console.error("Lỗi parse feature flags", e);
            }
        }
        return defaultFlags;
    }

    function saveFeatureFlags(flags) {
        localStorage.setItem("excelai_feature_flags", JSON.stringify(flags));
        state.featureFlags = flags;
        checkWorkspaceLocks();
    }
    const currentUserFromDb = users.find(u => u.id === 1) || {
        id: 1,
        name: "Trần Minh Trí",
        email: "trinh@excelai.com",
        tier: "free",
        usageCount: 12,
        usageLimit: 20,
        status: "Hoạt động"
    };

    const promptConfig = adminService.loadPromptConfig();

    const state = {
        currentUser: currentUserFromDb,
        billingCycle: "monthly", // "monthly" or "annual"
        selectedUpgradeTier: null,
        chartInstance: null,
        reportsChartInstance: null,
        uploadedFiles: [],
        users: users,
        systemPrompt: promptConfig.systemPrompt,
        freeLimit: promptConfig.freeLimit,
        systemLogs: adminService.loadSystemLogs(),
        chatThreads: historyService.loadChatThreads([
            {
                id: "default",
                title: "Hội thoại mặc định",
                messages: [
                    { sender: "bot", text: "Xin chào! Tôi là trợ lý Excel AI. Hôm nay tôi có thể hỗ trợ bạn điều gì về Excel, Google Sheets hay VBA?" }
                ]
            }
        ]),
        activeThreadId: "default",
        apiKeys: adminService.loadAPIKeys(),
        apiKeysChartInstance: null,
        coupons: billingService.loadCoupons(),
        activeDiscount: 0,
        activeCouponCode: "",
        featureFlags: loadFeatureFlags()
    };

    // Pricing values matching landing page
    const pricing = {
        monthly: { pro: "149,000đ", enterprise: "399,000đ", period: "/tháng" },
        annual: { pro: "119,000đ", enterprise: "319,000đ", period: "/tháng (trả năm)" }
    };

    // ----------------------------------------------------------------------
    // 2. DOM ELEMENT SELECTORS
    // ----------------------------------------------------------------------
    // Navigation / Routing
    const logoBtn = document.getElementById("logo-btn");
    const navFeatures = document.getElementById("nav-features");
    const navPricing = document.getElementById("nav-pricing");
    const goWorkspaceBtn = document.getElementById("go-workspace-btn");
    const heroStartBtn = document.getElementById("hero-start-btn");
    const heroDemoBtn = document.getElementById("hero-demo-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const roleUserBtn = document.getElementById("role-user-btn");
    const roleAdminBtn = document.getElementById("role-admin-btn");
    const headerUserActions = document.getElementById("header-user-actions");

    // Hamburger Menu (Mobile)
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const navLinks = document.getElementById("nav-links");

    // Views
    const landingView = document.getElementById("landing-view");
    const workspaceView = document.getElementById("workspace-view");
    const adminView = document.getElementById("admin-view");
    
    // User Profile Dropdown
    const avatarBtn = document.getElementById("avatar-btn");
    const avatarDropdown = document.getElementById("avatar-dropdown");
    const headerUserTier = document.getElementById("header-user-tier");
    const sidebarUserTierName = document.getElementById("sidebar-user-tier-name");
    const sidebarTierBox = document.getElementById("sidebar-tier-box");

    // Pricing page toggles
    const billingToggle = document.getElementById("billing-toggle");
    const billingMonthlyLabel = document.getElementById("billing-monthly-label");
    const billingAnnualLabel = document.getElementById("billing-annual-label");
    const priceProText = document.getElementById("price-pro");
    const periodProText = document.getElementById("period-pro");
    const priceEnterpriseText = document.getElementById("price-enterprise");
    const periodEnterpriseText = document.getElementById("period-enterprise");

    // Pricing purchase buttons
    const btnSelectFree = document.getElementById("btn-select-free");
    const btnSelectPro = document.getElementById("btn-select-pro");
    const btnSelectEnterprise = document.getElementById("btn-select-enterprise");
    const billingUpgradeBtn = document.getElementById("billing-upgrade-btn");
    const miniBtnPro = document.getElementById("mini-btn-pro");
    const miniBtnEnterprise = document.getElementById("mini-btn-enterprise");

    // Sidebar navigation
    const sidebarItems = document.querySelectorAll("#workspace-view .sidebar-item");
    const tabPanels = document.querySelectorAll("#workspace-view .tab-panel");
    const adminSidebarItems = document.querySelectorAll("#admin-view .sidebar-item");
    const adminTabPanels = document.querySelectorAll("#admin-view .tab-panel");
    const sidebarUsageCount = document.getElementById("sidebar-usage-count");
    const sidebarUsageProgress = document.getElementById("sidebar-usage-progress");
    const dashboardUsageRatio = document.getElementById("dashboard-usage-ratio");

    // Interactive Demo (Landing)
    const landingDemoInput = document.getElementById("landing-demo-input");
    const landingDemoGenerateBtn = document.getElementById("landing-demo-generate-btn");
    const landingDemoCode = document.getElementById("landing-demo-code");
    const landingDemoCopyBtn = document.getElementById("landing-demo-copy-btn");

    // Tab - Dashboard quick links
    const dashActionCards = document.querySelectorAll(".dash-action-card");

    // Tab - Chatbot
    const chatMessages = document.getElementById("chat-messages");
    const chatTextarea = document.getElementById("chat-textarea");
    const chatSendBtn = document.getElementById("chat-send-btn");
    const chatAttachFileBtn = document.getElementById("chat-attach-file-btn");
    const fileAttachedInfo = document.getElementById("file-attached-info");
    const removeFileBtn = document.getElementById("remove-file-btn");

    // Tab - Formula Lab
    const formulaPrompt = document.getElementById("formula-prompt");
    const formulaContextSelect = document.getElementById("formula-context");
    const formulaGenerateBtn = document.getElementById("formula-generate-btn");
    const formulaOutputContainer = document.getElementById("formula-output-container");
    const formulaResultCode = document.getElementById("formula-result-code");
    const formulaExplanationSteps = document.getElementById("formula-explanation-steps");
    const formulaInputExample = document.getElementById("formula-input-example");
    const formulaOutputExample = document.getElementById("formula-output-example");
    const formulaCopyBtn = document.getElementById("formula-copy-btn");
    const gridInputs = document.querySelectorAll(".grid-input");

    // Tab - VBA Writer
    const vbaPrompt = document.getElementById("vba-prompt");
    const vbaGenerateBtn = document.getElementById("vba-generate-btn");
    const vbaExplanationContainer = document.getElementById("vba-explanation-container");
    const vbaCodeDisplay = document.getElementById("vba-code-display");
    const vbaCopyBtn = document.getElementById("vba-copy-btn");

    // Tab - Data Analyzer
    const analyzerLockOverlay = document.getElementById("analyzer-lock-overlay");
    const csvDropzone = document.getElementById("csv-dropzone");
    const csvFileInput = document.getElementById("csv-file-input");
    const sampleSalesBtn = document.getElementById("sample-sales-btn");
    const sampleHrBtn = document.getElementById("sample-hr-btn");
    const analyzerTableCard = document.getElementById("analyzer-table-card");
    const parsedRowName = document.getElementById("parsed-row-count");
    const parsedDataTable = document.getElementById("parsed-data-table");
    const insightsPlaceholder = document.getElementById("insights-placeholder");
    const insightsResults = document.getElementById("insights-results");
    const insightStat1 = document.getElementById("insight-stat-1");
    const insightStat2 = document.getElementById("insight-stat-2");
    const insightStat3 = document.getElementById("insight-stat-3");
    const aiAnalysisNarrative = document.getElementById("ai-analysis-narrative");
    const unlockProBtn = document.getElementById("unlock-pro-btn");

    // File Manager & Workspace selectors
    const filesDropzone = document.getElementById("files-dropzone");
    const filesInput = document.getElementById("files-input");
    const filesTableBody = document.getElementById("files-table-body");
    const filesPreviewCard = document.getElementById("files-preview-card");
    const filesPreviewName = document.getElementById("files-preview-name");
    const filesPreviewTable = document.getElementById("files-preview-table");
    const filesPreviewPlaceholder = document.getElementById("files-preview-placeholder");

    // Checker selectors
    const checkerFileSelect = document.getElementById("checker-file-select");
    const checkerScanBtn = document.getElementById("checker-scan-btn");
    const checkerResultsBox = document.getElementById("checker-results-box");
    const checkerStatRows = document.getElementById("checker-stat-rows");
    const checkerStatErrors = document.getElementById("checker-stat-errors");
    const checkerStatHealth = document.getElementById("checker-stat-health");
    const checkerTableBody = document.getElementById("checker-table-body");
    const checkerPlaceholder = document.getElementById("checker-placeholder");
    const checkerLockOverlay = document.getElementById("checker-lock-overlay");

    // Data Cleaning selectors
    const cleanFileSelect = document.getElementById("clean-file-select");
    const cleanColumnSelect = document.getElementById("clean-column-select");
    const cleanRuleSelect = document.getElementById("clean-rule-select");
    const cleanApplyBtn = document.getElementById("clean-apply-btn");
    const cleanPreviewContainer = document.getElementById("clean-preview-container");
    const cleanSaveFileBtn = document.getElementById("clean-save-file-btn");
    const cleanFormulaCode = document.getElementById("clean-formula-code");
    const cleanPreviewTableBody = document.getElementById("clean-preview-table-body");
    const cleanPlaceholder = document.getElementById("clean-placeholder");
    const cleaningLockOverlay = document.getElementById("cleaning-lock-overlay");

    // Reconciliation selectors
    const reconcileFileASelect = document.getElementById("reconcile-filea-select");
    const reconcileFileBSelect = document.getElementById("reconcile-fileb-select");
    const reconcileKeyASelect = document.getElementById("reconcile-keya-select");
    const reconcileKeyBSelect = document.getElementById("reconcile-keyb-select");
    const reconcileValASelect = document.getElementById("reconcile-vala-select");
    const reconcileValBSelect = document.getElementById("reconcile-valb-select");
    const reconcileRunBtn = document.getElementById("reconcile-run-btn");
    const reconcileResultsBox = document.getElementById("reconcile-results-box");
    const reconcileStatMatched = document.getElementById("reconcile-stat-matched");
    const reconcileStatMismatch = document.getElementById("reconcile-stat-mismatched");
    const reconcileStatMissingB = document.getElementById("reconcile-stat-missingb");
    const reconcileStatMissingA = document.getElementById("reconcile-stat-missinga");
    const reconcileTableBody = document.getElementById("reconcile-table-body");
    const reconcileAiNarrative = document.getElementById("reconcile-ai-narrative");
    const reconcilePlaceholder = document.getElementById("reconcile-placeholder");
    const reconciliationLockOverlay = document.getElementById("reconcile-lock-overlay");

    const reconcileFilterAll = document.getElementById("reconcile-filter-all");
    const reconcileFilterMismatch = document.getElementById("reconcile-filter-mismatch");
    const reconcileFilterMissingB = document.getElementById("reconcile-filter-missingb");
    const reconcileFilterMissingA = document.getElementById("reconcile-filter-missinga");

    // Reports selectors
    const reportsFileSelect = document.getElementById("reports-file-select");
    const reportsSalesBtn = document.getElementById("reports-sales-btn");
    const reportsHrBtn = document.getElementById("reports-hr-btn");
    const reportsParsedRowCount = document.getElementById("reports-parsed-row-count");
    const reportsParsedDataTable = document.getElementById("reports-parsed-data-table");
    const reportsTableCard = document.getElementById("reports-table-card");
    const reportsInsightsPlaceholder = document.getElementById("reports-insights-placeholder");
    const reportsInsightsResults = document.getElementById("reports-insights-results");
    const reportsInsightStat1 = document.getElementById("reports-insight-stat-1");
    const reportsInsightStat2 = document.getElementById("reports-insight-stat-2");
    const reportsInsightStat3 = document.getElementById("reports-insight-stat-3");
    const reportsChart = document.getElementById("reports-chart");
    const reportsAiAnalysisNarrative = document.getElementById("reports-ai-analysis-narrative");
    const reportsMainContent = document.getElementById("reports-main-content");
    const reportsActiveSheetBtn = document.getElementById("reports-active-sheet-btn");

    // Tab - AI Autopilot selectors
    const autopilotGoalInput = document.getElementById("autopilot-goal-input");
    const autopilotFileSelect = document.getElementById("autopilot-file-select");
    const autopilotRunBtn = document.getElementById("autopilot-run-btn");
    const autopilotPlanBox = document.getElementById("autopilot-plan-box");
    const autopilotPlanUnderstanding = document.getElementById("autopilot-plan-understanding");
    const autopilotStepsContainer = document.getElementById("autopilot-steps-container");
    const autopilotPlanInputs = document.getElementById("autopilot-plan-inputs");
    const autopilotPlanOutputs = document.getElementById("autopilot-plan-outputs");
    const autopilotGenerateBtn = document.getElementById("autopilot-generate-btn");
    const autopilotPreviewPlaceholder = document.getElementById("autopilot-preview-placeholder");
    const autopilotPreviewResults = document.getElementById("autopilot-preview-results");
    const autopilotPreviewContentBox = document.getElementById("autopilot-preview-content-box");
    const autopilotWarningsBox = document.getElementById("autopilot-warnings-box");
    const autopilotWarningsList = document.getElementById("autopilot-warnings-list");
    const autopilotCopyBtn = document.getElementById("autopilot-copy-btn");
    const autopilotExportBtn = document.getElementById("autopilot-export-btn");

    // Tab - AI Table Builder selectors
    const tableBuilderDesc = document.getElementById("table-builder-desc");
    const tableBuilderType = document.getElementById("table-builder-type");
    const tableBuilderFormula = document.getElementById("table-builder-formula");
    const tableBuilderSample = document.getElementById("table-builder-sample");
    const tableBuilderRunBtn = document.getElementById("table-builder-run-btn");
    const tableBuilderSpecBox = document.getElementById("table-builder-spec-box");
    const tableBuilderColsList = document.getElementById("table-builder-cols-list");
    const tableBuilderPreviewTitle = document.getElementById("table-builder-preview-title");
    const tableBuilderPlaceholder = document.getElementById("table-builder-placeholder");
    const tableBuilderResults = document.getElementById("table-builder-results");
    const tableBuilderPreviewGrid = document.getElementById("table-builder-preview-grid");
    const tableBuilderFormulaList = document.getElementById("table-builder-formula-list");
    const tableBuilderNotes = document.getElementById("table-builder-notes");
    const tableBuilderCopyBtn = document.getElementById("table-builder-copy-btn");
    const tableBuilderExportBtn = document.getElementById("table-builder-export-btn");

    // Tab - AI Document Builder selectors
    const docBuilderType = document.getElementById("doc-builder-type");
    const docBuilderFileSelect = document.getElementById("doc-builder-file-select");
    const docBuilderFacts = document.getElementById("doc-builder-facts");
    const docBuilderTone = document.getElementById("doc-builder-tone");
    const docBuilderRunBtn = document.getElementById("doc-builder-run-btn");
    const docBuilderPlaceholder = document.getElementById("doc-builder-placeholder");
    const docBuilderResults = document.getElementById("doc-builder-results");
    const docBuilderPreviewText = document.getElementById("doc-builder-preview-text");
    const docBuilderFactsUsed = document.getElementById("doc-builder-facts-used");
    const docBuilderCopyBtn = document.getElementById("doc-builder-copy-btn");
    const docBuilderExportBtn = document.getElementById("doc-builder-export-btn");

    // Admin Feature Flags selectors
    const flagEnableAutopilot = document.getElementById("flag-enable-autopilot");
    const flagEnableTableBuilder = document.getElementById("flag-enable-table-builder");
    const flagEnableDocumentBuilder = document.getElementById("flag-enable-document-builder");
    const flagEnableDataChecker = document.getElementById("flag-enable-data-checker");
    const flagEnableReconciliation = document.getElementById("flag-enable-reconciliation");
    const adminSaveFlagsBtn = document.getElementById("admin-save-flags-btn");

    // Tab - Cấu hình & Cài đặt (Settings)
    const settingsWorkspaceName = document.getElementById("settings-workspace-name");
    const settingsRetention = document.getElementById("settings-retention");
    const settingsSaveBtn = document.getElementById("settings-save-btn");
    const settingsPurgeBtn = document.getElementById("settings-purge-btn");

    // Modals
    const checkoutModal = document.getElementById("checkout-modal");
    const checkoutCloseBtn = document.getElementById("checkout-close-btn");
    const checkoutTierTitle = document.getElementById("checkout-tier-title");
    const checkoutTierPrice = document.getElementById("checkout-tier-price");
    const checkoutForm = document.getElementById("checkout-form");
    
    // Admin user edit modal
    const adminUserModal = document.getElementById("admin-user-modal");
    const adminUserCloseBtn = document.getElementById("admin-user-close-btn");
    const adminUserForm = document.getElementById("admin-user-form");
    const editUserIdInput = document.getElementById("edit-user-id");
    const editUserNameInput = document.getElementById("edit-user-name");
    const editUserEmailInput = document.getElementById("edit-user-email");
    const editUserTierSelect = document.getElementById("edit-user-tier");
    const editUserStatusSelect = document.getElementById("edit-user-status");

    // Admin Configurations
    const adminSystemPrompt = document.getElementById("admin-system-prompt");
    const adminSystemLimit = document.getElementById("admin-system-limit");
    const adminSavePromptBtn = document.getElementById("admin-save-prompt-btn");
    const adminSystemLogs = document.getElementById("admin-system-logs");
    const adminUserTableBody = document.getElementById("admin-user-table-body");
    const adminAddUserBtn = document.getElementById("admin-add-user-btn");
    
    // Stats in Admin
    const adminStatMrr = document.getElementById("admin-stat-mrr");
    const adminStatUsers = document.getElementById("admin-stat-users");

    // Toast Container
    const toastContainer = document.getElementById("toast-container");

    // Excel Add-in buttons
    const formulaInsertExcelBtn = document.getElementById("formula-insert-excel-btn");
    const vbaInsertExcelBtn = document.getElementById("vba-insert-excel-btn");
    const sampleActiveSheetBtn = document.getElementById("sample-active-sheet-btn");

    // ----------------------------------------------------------------------
    // 3. TOAST NOTIFICATION HELPER
    // ----------------------------------------------------------------------
    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        let iconSvg = "";
        if (type === "success") {
            iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === "error") {
            iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" class="cross-icon"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        } else {
            iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        toast.innerHTML = `
            ${iconSvg}
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Remove after 3.5s
        setTimeout(() => {
            toast.classList.add("removing");
            toast.addEventListener("transitionend", () => {
                toast.remove();
            });
        }, 3500);
    }

    // ----------------------------------------------------------------------
    // 4. ROUTING & NAVIGATION
    // ----------------------------------------------------------------------
    function showView(viewName) {
        // Deactivate all
        landingView.classList.remove("active");
        workspaceView.classList.remove("active");
        adminView.classList.remove("active");
        
        // Remove active states from nav links
        navFeatures.classList.remove("active");
        navPricing.classList.remove("active");
        
        // Hide/Show header elements based on view
        if (viewName === "landing") {
            landingView.classList.add("active");
            headerUserActions.style.display = "none";
            goWorkspaceBtn.style.display = "block";
        } else if (viewName === "workspace") {
            workspaceView.classList.add("active");
            headerUserActions.style.display = "flex";
            goWorkspaceBtn.style.display = "none";
            
            // Toggle active role tab
            roleUserBtn.classList.add("active");
            roleAdminBtn.classList.remove("active");
            
            // Set up limits & widgets
            updateWorkspaceSidebarUI();
            checkWorkspaceLocks();
        } else if (viewName === "admin") {
            adminView.classList.add("active");
            headerUserActions.style.display = "flex";
            goWorkspaceBtn.style.display = "none";
            
            // Toggle active role tab
            roleUserBtn.classList.remove("active");
            roleAdminBtn.classList.add("active");
            
            renderAdminPanel();
            switchAdminTab("overview");
        }
        
        // Scroll to top
        window.scrollTo(0, 0);
    }

    logoBtn.addEventListener("click", () => showView("landing"));
    goWorkspaceBtn.addEventListener("click", () => showView("workspace"));
    heroStartBtn.addEventListener("click", () => {
        showView("workspace");
        switchWorkspaceTab("chat");
    });
    heroDemoBtn.addEventListener("click", () => {
        showView("landing");
        const howItWorks = document.getElementById("how-it-works");
        if (howItWorks) {
            howItWorks.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    });

    roleUserBtn.addEventListener("click", () => showView("workspace"));
    roleAdminBtn.addEventListener("click", () => showView("admin"));
    logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        state.currentUser.tier = "free"; // Reset tier for demo
        billingService.updateUserTier(1, "free");
        showToast("Đã đăng xuất khỏi hệ thống thành công (Reset về Free)", "info");
        showView("landing");
    });

    // Mobile Hamburger Toggle
    if (hamburgerBtn && navLinks) {
        hamburgerBtn.addEventListener("click", () => {
            hamburgerBtn.classList.toggle("active");
            navLinks.classList.toggle("active");
        });

        navLinks.querySelectorAll(".nav-item, button").forEach(item => {
            item.addEventListener("click", () => {
                hamburgerBtn.classList.remove("active");
                navLinks.classList.remove("active");
            });
        });
    }

    // ----------------------------------------------------------------------
    // 5. USER PROFILE DROPDOWN
    // ----------------------------------------------------------------------
    avatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        avatarDropdown.classList.toggle("active");
    });

    document.addEventListener("click", () => {
        avatarDropdown.classList.remove("active");
    });

    document.getElementById("dropdown-billing-link").addEventListener("click", (e) => {
        e.preventDefault();
        showView("workspace");
        switchWorkspaceTab("billing");
    });

    // ----------------------------------------------------------------------
    // 6. PRICING SaaS TIERS LOGIC
    // ----------------------------------------------------------------------
    // Monthly / Annual toggle switch
    billingToggle.addEventListener("click", toggleBillingCycle);
    billingMonthlyLabel.addEventListener("click", () => {
        if (state.billingCycle === "annual") toggleBillingCycle();
    });
    billingAnnualLabel.addEventListener("click", () => {
        if (state.billingCycle === "monthly") toggleBillingCycle();
    });

    function toggleBillingCycle() {
        if (state.billingCycle === "monthly") {
            state.billingCycle = "annual";
            billingToggle.classList.add("annual");
            billingMonthlyLabel.classList.remove("active");
            billingAnnualLabel.classList.add("active");
        } else {
            state.billingCycle = "monthly";
            billingToggle.classList.remove("annual");
            billingMonthlyLabel.classList.add("active");
            billingAnnualLabel.classList.remove("active");
        }
        
        // Update prices visually
        const cycle = state.billingCycle;
        priceProText.innerText = pricing[cycle].pro;
        periodProText.innerText = pricing[cycle].period;
        priceEnterpriseText.innerText = pricing[cycle].enterprise;
        periodEnterpriseText.innerText = pricing[cycle].period;
    }

    // Modal popup triggers for buying
    btnSelectPro.addEventListener("click", () => triggerPayment("pro"));
    btnSelectEnterprise.addEventListener("click", () => triggerPayment("enterprise"));
    billingUpgradeBtn.addEventListener("click", () => triggerPayment("pro"));
    miniBtnPro.addEventListener("click", () => triggerPayment("pro"));
    miniBtnEnterprise.addEventListener("click", () => triggerPayment("enterprise"));

    function triggerPayment(tier) {
        state.selectedUpgradeTier = tier;
        
        let priceStr = "";
        let tierName = "";
        
        if (tier === "pro") {
            priceStr = pricing[state.billingCycle].pro;
            tierName = `Pro (${state.billingCycle === "monthly" ? "Tháng" : "Năm - Ưu đãi"})`;
        } else if (tier === "enterprise") {
            priceStr = pricing[state.billingCycle].enterprise;
            tierName = `Business (${state.billingCycle === "monthly" ? "Tháng" : "Năm - Ưu đãi"})`;
        }

        // Reset coupon fields
        const couponInput = document.getElementById("checkout-coupon-input");
        if (couponInput) couponInput.value = "";
        const couponMsg = document.getElementById("coupon-message");
        if (couponMsg) {
            couponMsg.style.display = "none";
            couponMsg.innerText = "";
        }
        state.activeDiscount = 0;
        state.activeCouponCode = "";

        checkoutTierTitle.innerText = tierName;
        checkoutTierPrice.innerText = priceStr;
        checkoutModal.classList.add("active");
    }

    // Close checkout
    checkoutCloseBtn.addEventListener("click", () => {
        checkoutModal.classList.remove("active");
    });
    
    // Simulate Card Form checkout submission
    checkoutForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById("checkout-submit-btn");
        const originalText = submitBtn.innerText;
        
        submitBtn.disabled = true;
        submitBtn.innerText = "Đang xác thực thanh toán...";
        
        // Mock processing delay
        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
            checkoutModal.classList.remove("active");
            
            // Update User state
            const oldTier = state.currentUser.tier;
            const newTier = state.selectedUpgradeTier;
            
            const updatedUser = billingService.updateUserTier(1, newTier);
            if (updatedUser) {
                state.currentUser = updatedUser;
            }
            
            // Log this in system API logs (Admin Panel)
            let logMsg = `Billing: User 'Trần Minh Trí' upgraded successfully from ${oldTier.toUpperCase()} to ${newTier.toUpperCase()}`;
            if (state.activeCouponCode) {
                logMsg += ` using coupon ${state.activeCouponCode} (-${state.activeDiscount}%)`;
            }
            adminService.addSystemLog("success", logMsg);
            historyService.addOperation("payment", `Nâng cấp gói tài khoản lên: ${newTier.toUpperCase()}`);
            
            // Update local state list
            state.users = billingService.loadUsers();

            showToast(`Thanh toán thành công! Bạn đã nâng cấp lên gói ${newTier.toUpperCase()}`, "success");
            
            // Update workspace UI
            updateWorkspaceSidebarUI();
            checkAnalyzerLock();
            checkAPIKeysLock();
            
            // Redirection to Dashboard tab
            showView("workspace");
            switchWorkspaceTab("dashboard");
        }, 1500);
    });

    // ----------------------------------------------------------------------
    // 7. USER WORKSPACE SIDEBAR TAB TRANSITIONS
    // ----------------------------------------------------------------------
    sidebarItems.forEach(item => {
        item.addEventListener("click", () => {
            const tabId = item.getAttribute("data-tab");
            switchWorkspaceTab(tabId);
        });
    });

    function switchWorkspaceTab(tabId) {
        // Toggle Sidebar Nav Buttons
        sidebarItems.forEach(btn => {
            btn.classList.remove("active");
            if (btn.getAttribute("data-tab") === tabId) {
                btn.classList.add("active");
            }
        });

        // Toggle Tab content panels
        tabPanels.forEach(panel => {
            panel.classList.remove("active");
        });
        const targetPanel = document.getElementById(`tab-${tabId}`);
        if (targetPanel) {
            targetPanel.classList.add("active");
        }
        
        // Tab-specific handlers
        checkWorkspaceLocks();
        if (tabId === "apikeys") {
            checkAPIKeysLock();
            renderAPIKeysChart();
        } else if (tabId === "history") {
            renderOperationsHistory();
        }
    }

    // Expose routing globally to support lock screens billing redirection
    window.switchWorkspaceTab = switchWorkspaceTab;
    window.showView = showView;
    window.switchAdminTab = switchAdminTab;

    // Dashboard quick action clicks redirecting to respective tabs
    dashActionCards.forEach(card => {
        card.addEventListener("click", () => {
            const action = card.getAttribute("data-action");
            if (action === "go-chat") switchWorkspaceTab("chat");
            else if (action === "go-formula") switchWorkspaceTab("formula");
            else if (action === "go-vba") switchWorkspaceTab("vba");
            else if (action === "go-checker") switchWorkspaceTab("checker");
            else if (action === "go-analyzer") switchWorkspaceTab("reports");
        });
    });

    function updateWorkspaceSidebarUI() {
        const u = state.currentUser;
        
        // Update user badge
        headerUserTier.innerText = u.tier.toUpperCase();
        headerUserTier.className = `user-tier-badge tier-${u.tier}`;
        
        // Update avatar initial
        document.getElementById("avatar-initial").innerText = u.name.charAt(0);
        
        // Sidebar Indicators
        sidebarUserTierName.innerText = u.tier === "free" ? "Free" : u.tier === "pro" ? "Pro" : "Business";
        
        // Billing overview within app
        document.getElementById("billing-current-tier-text").innerText = `${u.tier.toUpperCase()} (${u.tier === "free" ? "Miễn phí" : "SaaS Premium"})`;
        
        // Upgrade current cards inside billing
        document.querySelectorAll(".pricing-mini-card").forEach(c => c.classList.remove("active-tier"));
        const miniCard = document.getElementById(`mini-card-${u.tier}`);
        if (miniCard) miniCard.classList.add("active-tier");

        // Limits calculations
        if (u.tier === "free") {
            sidebarUsageCount.innerText = `${u.usageCount} / ${state.freeLimit}`;
            const percentage = (u.usageCount / state.freeLimit) * 100;
            sidebarUsageProgress.style.width = `${Math.min(percentage, 100)}%`;
            dashboardUsageRatio.innerText = `${u.usageCount} / ${state.freeLimit}`;
        } else if (u.tier === "pro") {
            sidebarUsageCount.innerText = `${u.usageCount} / 500`;
            const percentage = (u.usageCount / 500) * 100;
            sidebarUsageProgress.style.width = `${Math.min(percentage, 100)}%`;
            dashboardUsageRatio.innerText = `${u.usageCount} / 500`;
        } else {
            sidebarUsageCount.innerText = `${u.usageCount} / Không giới hạn`;
            sidebarUsageProgress.style.width = "100%";
            dashboardUsageRatio.innerText = `${u.usageCount} / ∞`;
        }

        // Update Time Saved dynamically
        const timeSavedText = document.getElementById("dashboard-time-saved");
        if (timeSavedText) {
            const ops = historyService.loadOperationsHistory();
            let hours = 4.8; // Baseline hours
            ops.forEach(op => {
                if (op.type.toLowerCase() === "formula") hours += 0.5;
                else if (op.type.toLowerCase() === "vba") hours += 1.5;
                else if (op.type.toLowerCase() === "file") hours += 0.3;
                else if (op.type.toLowerCase() === "checker") hours += 1.0;
                else if (op.type.toLowerCase() === "cleaning") hours += 0.8;
                else if (op.type.toLowerCase() === "reconciliation") hours += 2.0;
                else if (op.type.toLowerCase() === "chat") hours += 0.4;
            });
            timeSavedText.innerText = `${hours.toFixed(1)} Giờ`;
        }

        // Update Dashboard Mini Logs
        const miniLogsBox = document.getElementById("dashboard-mini-logs");
        if (miniLogsBox) {
            const ops = historyService.loadOperationsHistory();
            if (ops.length === 0) {
                miniLogsBox.innerHTML = `
                    <div class="mini-log-item" style="color: var(--color-text-muted); font-size: 0.75rem;">
                        <span>Chưa có hoạt động nào</span>
                        <small>--</small>
                    </div>
                `;
            } else {
                // Show latest 3 operations
                const latestOps = ops.slice(0, 3);
                miniLogsBox.innerHTML = latestOps.map(op => {
                    let friendlyAction = op.action;
                    if (friendlyAction.length > 30) {
                        friendlyAction = friendlyAction.substring(0, 30) + "...";
                    }
                    return `
                        <div class="mini-log-item">
                            <span>${friendlyAction}</span>
                            <small>${op.time || "Vừa xong"}</small>
                        </div>
                    `;
                }).join("");
            }
        }
    }

    // ----------------------------------------------------------------------
    // 8. INTERACTIVE DEMO (LANDING PAGE - 6 TABS)
    // ----------------------------------------------------------------------
    window.switchDemoTab = function(tabId) {
        // Find all buttons in the demo sidebar
        const demoButtons = document.querySelectorAll("#how-it-works .sidebar-item");
        demoButtons.forEach(btn => {
            btn.classList.remove("active");
        });
        
        // Add active class to selected tab button
        const activeBtn = document.getElementById(`demo-tab-${tabId}`);
        if (activeBtn) {
            activeBtn.classList.add("active");
        }
        
        // Hide all panels
        const panels = document.querySelectorAll("#how-it-works .demo-tab-panel");
        panels.forEach(panel => {
            panel.style.display = "none";
        });
        
        // Show selected panel
        const targetPanel = document.getElementById(`demo-panel-${tabId}`);
        if (targetPanel) {
            targetPanel.style.display = "flex";
        }
    };

    window.processDemoSelfInput = function() {
        const btn = document.getElementById("demo-self-input-btn");
        const result = document.getElementById("demo-self-input-result");
        if (btn && result) {
            btn.disabled = true;
            btn.innerText = "AI đang xử lý và phân tích...";
            setTimeout(() => {
                btn.style.display = "none";
                result.style.display = "block";
                showToast("AI đã chuẩn hóa dữ liệu thành công!", "success");
            }, 800);
        }
    };

    // ----------------------------------------------------------------------
    // 9. AI CHATBOT INTERACTIVITY
    // ----------------------------------------------------------------------
    // Handle suggestion chips
    document.querySelectorAll(".suggest-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            chatTextarea.value = btn.innerText;
            sendMessage();
        });
    });

    // Textarea auto resizing
    chatTextarea.addEventListener("input", () => {
        chatTextarea.style.height = "auto";
        chatTextarea.style.height = `${Math.min(chatTextarea.scrollHeight, 120)}px`;
    });

    chatTextarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatSendBtn.addEventListener("click", sendMessage);

    // Attach sample CSV file indicator
    chatAttachFileBtn.addEventListener("click", () => {
        fileAttachedInfo.style.display = "inline-flex";
        showToast("Đã đính kèm tệp dữ liệu 'sales_preview.csv' để hỏi AI.", "info");
    });
    
    removeFileBtn.addEventListener("click", () => {
        fileAttachedInfo.style.display = "none";
    });

    // Thread Event Listeners
    const newThreadBtn = document.getElementById("new-thread-btn");
    const deleteThreadBtn = document.getElementById("delete-thread-btn");

    if (newThreadBtn) {
        newThreadBtn.addEventListener("click", createNewThread);
    }
    if (deleteThreadBtn) {
        deleteThreadBtn.addEventListener("click", () => deleteThread(state.activeThreadId));
    }

    function renderThreadsList() {
        const threadsList = document.getElementById("threads-list");
        if (!threadsList) return;
        threadsList.innerHTML = "";
        
        state.chatThreads.forEach(thread => {
            const item = document.createElement("div");
            item.className = `thread-item ${thread.id === state.activeThreadId ? "active" : ""}`;
            item.setAttribute("data-thread-id", thread.id);
            
            item.innerHTML = `
                <span class="thread-title" title="${thread.title}">${thread.title}</span>
                <button class="thread-del-icon" title="Xóa hội thoại">&times;</button>
            `;
            
            item.addEventListener("click", (e) => {
                if (e.target.classList.contains("thread-del-icon")) {
                    e.stopPropagation();
                    deleteThread(thread.id);
                } else {
                    switchThread(thread.id);
                }
            });
            
            threadsList.appendChild(item);
        });
        
        const activeThread = state.chatThreads.find(t => t.id === state.activeThreadId);
        if (activeThread) {
            document.getElementById("active-thread-title").innerText = activeThread.title;
        }
    }

    function switchThread(threadId) {
        state.activeThreadId = threadId;
        renderThreadsList();
        
        const activeThread = state.chatThreads.find(t => t.id === threadId);
        chatMessages.innerHTML = "";
        if (activeThread) {
            activeThread.messages.forEach(msg => {
                appendChatMessageUI(msg.sender, msg.text);
            });
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function createNewThread() {
        const newId = "thread_" + Date.now();
        const newThread = {
            id: newId,
            title: "Cuộc chat mới",
            messages: [
                { sender: "bot", text: "Tôi đã tạo hội thoại mới. Hãy gửi câu hỏi của bạn để bắt đầu!" }
            ]
        };
        state.chatThreads.push(newThread);
        state.activeThreadId = newId;
        historyService.saveChatThreads(state.chatThreads);
        switchThread(newId);
        showToast("Đã tạo cuộc hội thoại mới!");
    }

    function deleteThread(threadId) {
        if (state.chatThreads.length <= 1) {
            showToast("Bạn cần giữ ít nhất một cuộc hội thoại!", "error");
            return;
        }
        
        const index = state.chatThreads.findIndex(t => t.id === threadId);
        if (index === -1) return;
        
        state.chatThreads.splice(index, 1);
        
        if (state.activeThreadId === threadId) {
            state.activeThreadId = state.chatThreads[0].id;
        }
        
        historyService.saveChatThreads(state.chatThreads);
        switchThread(state.activeThreadId);
        showToast("Đã xóa cuộc hội thoại!");
    }

    function sendMessage() {
        const text = chatTextarea.value.trim();
        const hasAttachment = fileAttachedInfo.style.display === "inline-flex";
        
        if (!text && !hasAttachment) return;
        
        // Usage limits validation
        if (state.currentUser.tier === "free" && state.currentUser.usageCount >= state.freeLimit) {
            showToast("Bạn đã hết lượt sử dụng miễn phí trong ngày. Vui lòng nâng cấp gói Pro!", "error");
            return;
        }

        // Find active thread
        const activeThread = state.chatThreads.find(t => t.id === state.activeThreadId);
        if (!activeThread) return;
        
        const currentThreadId = state.activeThreadId;

        // Push message to state
        let messageText = text;
        if (hasAttachment && !text) {
            messageText = "[Gửi đính kèm sales_preview.csv] Hãy phân tích tóm tắt dữ liệu tệp này.";
        }
        activeThread.messages.push({ sender: "user", text: messageText });
        
        // Update thread title if default
        if (activeThread.title === "Cuộc chat mới" || activeThread.title === "Hội thoại mặc định") {
            activeThread.title = messageText.length > 25 ? messageText.substring(0, 25) + "..." : messageText;
            renderThreadsList();
        }

        // Render user bubble
        if (state.activeThreadId === currentThreadId) {
            appendChatMessageUI("user", messageText);
        }
        
        chatTextarea.value = "";
        chatTextarea.style.height = "auto";

        // Increment count & save
        state.currentUser.usageCount++;
        state.users.find(u => u.id === 1).usageCount = state.currentUser.usageCount;
        billingService.saveUsers(state.users);
        
        updateWorkspaceSidebarUI();

        // Create system logs
        adminService.addSystemLog("success", `API Call: User 'Trần Minh Trí' sent query chat - ${messageText.substring(0, 20)}...`);
        historyService.addOperation("chat", `AI Chat: "${messageText.substring(0, 40)}..."`);

        // Append typing indicator
        let indicator = null;
        if (state.activeThreadId === currentThreadId) {
            indicator = appendTypingIndicator();
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Mock Bot streaming reply delay
        setTimeout(() => {
            if (indicator) indicator.remove();
            
            let queryText = text;
            if (hasAttachment) queryText = "orders.csv";
            
            const reply = aiService.generateChatResponse(queryText, activeThread.messages, state.systemPrompt);

            // Push bot reply to state
            const targetThread = state.chatThreads.find(t => t.id === currentThreadId);
            if (targetThread) {
                targetThread.messages.push({ sender: "bot", text: reply });
                historyService.saveChatThreads(state.chatThreads);
            }

            // Render bot bubble
            if (state.activeThreadId === currentThreadId) {
                appendChatMessageUI("bot", reply);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            // Clean up attachment
            fileAttachedInfo.style.display = "none";
        }, 1500);
    }

    function appendChatMessageUI(sender, text) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `chat-message ${sender}`;
        
        const avatar = sender === "user" ? "Me" : "AI";
        
        // Parse codes inside chat for styling
        let formattedText = parseMarkdown(text);

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-bubble">
                <div class="message-text">${formattedText}</div>
            </div>
        `;
        
        // Add copy event handlers for codes inside the bubble
        messageDiv.querySelectorAll(".btn-copy-chat").forEach(btn => {
            btn.addEventListener("click", () => {
                const codeElement = btn.nextElementSibling.querySelector("code");
                navigator.clipboard.writeText(codeElement.innerText);
                showToast("Đã sao chép mã code!");
            });
        });

        chatMessages.appendChild(messageDiv);
    }

    function appendTypingIndicator() {
        const messageDiv = document.createElement("div");
        messageDiv.className = "chat-message bot";
        messageDiv.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-bubble">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        return messageDiv;
    }

    function parseMarkdown(text) {
        // Safe html tags escape
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Code blocks: ```language ... ```
        html = html.replace(/```(excel|vba|python|javascript)?([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || "code";
            return `
                <div class="chat-code-block">
                    <div class="code-block-header">
                        <span>${language.toUpperCase()}</span>
                        <button class="btn-copy-chat btn-copy">Copy</button>
                    </div>
                    <div class="code-container">
                        <pre><code>${code.trim()}</code></pre>
                    </div>
                </div>
            `;
        });

        // Inline codes: `code`
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Strong tags
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

        // New lines to br
        html = html.replace(/\n/g, "<br>");

        return html;
    }

    // ----------------------------------------------------------------------
    // 10. FORMULA GENERATOR WORKSPACE
    // ----------------------------------------------------------------------
    formulaGenerateBtn.addEventListener("click", () => {
        const desc = formulaPrompt.value.trim();
        if (!desc) {
            showToast("Vui lòng nhập mô tả công thức", "error");
            return;
        }

        formulaGenerateBtn.disabled = true;
        formulaGenerateBtn.innerText = "AI đang phân tích...";

        setTimeout(() => {
            const context = formulaContextSelect.value;
            const config = adminService.loadPromptConfig();
            
            const result = aiService.generateFormula(desc, context, config);
            
            formulaResultCode.innerText = result.formula;
            
            // Populating explanation list
            const steps = result.explanation.split('\n').filter(s => s.trim().length > 0);
            formulaExplanationSteps.innerHTML = steps.map(s => `<li>${s}</li>`).join("");
            
            // Input/output examples
            formulaInputExample.innerText = result.inputExample || "Không có";
            formulaOutputExample.innerText = result.outputExample || "Không có";
            
            formulaOutputContainer.style.display = "block";
            formulaGenerateBtn.disabled = false;
            formulaGenerateBtn.innerText = "Tạo Công Thức";

            // Increment usage
            state.currentUser.usageCount++;
            state.users.find(u => u.id === 1).usageCount = state.currentUser.usageCount;
            billingService.saveUsers(state.users);
            
            updateWorkspaceSidebarUI();
            
            adminService.addSystemLog("success", `API Call: User generated Excel formula for context [${context}]`);
            historyService.addOperation("formula", `Sinh công thức [${context}]: "${desc.substring(0, 30)}..."`);
            showToast("Công thức đã được sinh!");
        }, 1200);
    });

    formulaCopyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(formulaResultCode.innerText);
        showToast("Đã sao chép công thức!");
    });

    // Simulated Table Grid inputs calculations (TRIM + UPPER demo)
    gridInputs.forEach(input => {
        input.addEventListener("input", recalculateGrid);
    });

    // Spreadsheet Editor Event Listeners
    const addRowBtn = document.getElementById("sheet-add-row-btn");
    const addColBtn = document.getElementById("sheet-add-col-btn");
    const exportCsvBtn = document.getElementById("sheet-export-csv-btn");

    if (addRowBtn) addRowBtn.addEventListener("click", addRow);
    if (addColBtn) addColBtn.addEventListener("click", addColumn);
    if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCSV);

    function recalculateGrid() {
        const table = document.querySelector(".excel-grid");
        if (!table) return;
        const rows = table.querySelectorAll("tbody tr");
        rows.forEach(tr => {
            const firstInput = tr.querySelector(".grid-input");
            const resultTd = tr.querySelector(".grid-result");
            if (firstInput && resultTd) {
                resultTd.innerText = firstInput.value.trim().toUpperCase();
            }
        });
    }

    function getColumnLabel(index) {
        let label = "";
        let temp = index;
        while (temp >= 0) {
            label = String.fromCharCode((temp % 26) + 65) + label;
            temp = Math.floor(temp / 26) - 1;
        }
        return label;
    }

    function addRow() {
        const table = document.querySelector(".excel-grid");
        if (!table) return;
        const tbody = table.querySelector("tbody");
        const headerCols = table.querySelectorAll("thead th").length;
        const newRowNum = tbody.querySelectorAll("tr").length + 1;
        
        const tr = document.createElement("tr");
        
        // Row label
        const tdNum = document.createElement("td");
        tdNum.className = "row-num";
        tdNum.innerText = newRowNum;
        tr.appendChild(tdNum);
        
        // Data inputs
        for (let i = 1; i < headerCols - 1; i++) {
            const td = document.createElement("td");
            const input = document.createElement("input");
            input.type = "text";
            input.className = "grid-input";
            input.value = "";
            input.addEventListener("input", recalculateGrid);
            td.appendChild(input);
            tr.appendChild(td);
        }
        
        // Formula output cell
        const tdRes = document.createElement("td");
        tdRes.className = "grid-result";
        tdRes.innerText = "";
        tr.appendChild(tdRes);
        
        tbody.appendChild(tr);
        showToast("Đã thêm dòng mới vào bảng tính!");
    }

    function addColumn() {
        const table = document.querySelector(".excel-grid");
        if (!table) return;
        const theadRow = table.querySelector("thead tr");
        const ths = theadRow.querySelectorAll("th");
        const lastTh = ths[ths.length - 1];
        
        const dataColCount = ths.length - 2;
        const newColLabel = getColumnLabel(dataColCount);
        
        // Insert header
        const newTh = document.createElement("th");
        newTh.innerText = newColLabel;
        theadRow.insertBefore(newTh, lastTh);
        
        // Rename last header
        const nextColLabel = getColumnLabel(dataColCount + 1);
        lastTh.innerText = `${nextColLabel} (Kết quả thử)`;
        
        // Add column cells to each row
        const tbodyRows = table.querySelectorAll("tbody tr");
        tbodyRows.forEach(tr => {
            const tds = tr.querySelectorAll("td");
            const lastTd = tds[tds.length - 1];
            
            const newTd = document.createElement("td");
            const input = document.createElement("input");
            input.type = "text";
            input.className = "grid-input";
            input.value = "";
            input.addEventListener("input", recalculateGrid);
            newTd.appendChild(input);
            
            tr.insertBefore(newTd, lastTd);
        });
        
        showToast("Đã thêm cột mới vào bảng tính!");
    }

    function exportCSV() {
        const table = document.querySelector(".excel-grid");
        if (!table) return;
        const headers = [];
        table.querySelectorAll("thead th").forEach((th, index) => {
            if (index > 0) {
                headers.push(th.innerText);
            }
        });
        
        const rows = [];
        table.querySelectorAll("tbody tr").forEach(tr => {
            const rowData = [];
            const tds = tr.querySelectorAll("td");
            tds.forEach((td, index) => {
                if (index > 0) {
                    const input = td.querySelector("input");
                    if (input) {
                        rowData.push(`"${input.value.replace(/"/g, '""')}"`);
                    } else {
                        rowData.push(`"${td.innerText.replace(/"/g, '""')}"`);
                    }
                }
            });
            rows.push(rowData.join(","));
        });
        
        const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "excelai_data_grid.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Đã xuất và tải xuống tệp dữ liệu CSV!", "success");
    }

    // ----------------------------------------------------------------------
    // 11. VBA & MACROS GENERATOR
    // ----------------------------------------------------------------------
    vbaGenerateBtn.addEventListener("click", () => {
        const promptText = vbaPrompt.value.trim();
        if (!promptText) {
            showToast("Vui lòng điền mô tả tác vụ tự động hóa", "error");
            return;
        }

        vbaGenerateBtn.disabled = true;
        vbaGenerateBtn.innerText = "Đang sinh mã lệnh VBA...";

        setTimeout(() => {
            const config = adminService.loadPromptConfig();
            const vbaCode = aiService.generateVBA(promptText, config);

            vbaCodeDisplay.innerText = vbaCode;
            vbaExplanationContainer.style.display = "block";
            vbaGenerateBtn.disabled = false;
            vbaGenerateBtn.innerText = "Tạo Code VBA";

            // VBA explanations card hooks dynamically
            const explanationBlock = document.querySelector(".vba-explanation-box");
            if (explanationBlock) {
                explanationBlock.innerHTML = `
                    <h5>Hướng dẫn sử dụng mã VBA này:</h5>
                    <ol>
                        <li>Mở file Excel của bạn, nhấn tổ hợp phím <code>ALT + F11</code> để mở cửa sổ VBA.</li>
                        <li>Chọn <code>Insert > Module</code> để tạo Module mới.</li>
                        <li>Dán đoạn mã bên cạnh vào khung soạn thảo.</li>
                        <li>Nhấn phím <code>F5</code> hoặc quay lại Excel chạy Macro này.</li>
                    </ol>
                    <div class="dropdown-divider" style="margin: 0.75rem 0;"></div>
                    <h5>💡 Giải thích chi tiết mã lệnh:</h5>
                    <p style="font-size: 0.8rem; line-height: 1.5; color: var(--color-text-muted); white-space: pre-wrap;">${aiService.explainVBA(vbaCode)}</p>
                `;
            }

            state.currentUser.usageCount++;
            state.users.find(u => u.id === 1).usageCount = state.currentUser.usageCount;
            billingService.saveUsers(state.users);

            updateWorkspaceSidebarUI();
            
            adminService.addSystemLog("success", "API Call: User generated VBA code macro");
            historyService.addOperation("vba", `Tạo Macro VBA: "${promptText.substring(0, 30)}..."`);
            showToast("Mã lệnh VBA đã được tạo thành công!");
        }, 1500);
    });

    vbaCopyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(vbaCodeDisplay.innerText);
        showToast("Mã VBA đã được sao chép vào bộ nhớ tạm!");
    });

    // ----------------------------------------------------------------------
    // 12. SMART DATA ANALYZER (CSV PARSER & CHART.JS - OBSOLETE)
    // ----------------------------------------------------------------------
    function checkAnalyzerLock() {
        const tier = state.currentUser.tier;
        if (analyzerLockOverlay) {
            if (tier === "free") {
                analyzerLockOverlay.style.display = "flex";
            } else {
                analyzerLockOverlay.style.display = "none";
            }
        }
    }

    if (unlockProBtn) {
        unlockProBtn.addEventListener("click", () => {
            triggerPayment("pro");
        });
    }

    if (csvDropzone) {
        // Trigger local file selection
        csvDropzone.addEventListener("click", () => {
            if (csvFileInput) csvFileInput.click();
        });

        // Drag over effects
        csvDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            csvDropzone.style.borderColor = "var(--color-accent)";
            csvDropzone.style.background = "rgba(6, 182, 212, 0.05)";
        });

        csvDropzone.addEventListener("dragleave", () => {
            csvDropzone.style.borderColor = "var(--border-glass)";
            csvDropzone.style.background = "transparent";
        });

        csvDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            csvDropzone.style.borderColor = "var(--border-glass)";
            csvDropzone.style.background = "transparent";
            
            const file = e.dataTransfer.files[0];
            if (file) {
                handleUploadedCSV(file);
            }
        });
    }

    if (csvFileInput) {
        csvFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                handleUploadedCSV(file);
            }
        });
    }

    async function handleUploadedCSV(file) {
        const validation = fileService.validateFile(file);
        if (!validation.valid) {
            showToast(validation.error, "error");
            return;
        }
        
        showToast(`Đã nhận tệp: ${file.name}. Đang phân tích...`, "info");
        
        try {
            const data = await fileService.parseCSV(file);
            
            // Render table view
            renderTable(data.headers, data.rows);
            
            // Render statistics
            const stats = data.statistics;
            insightStat1.innerText = `${data.rowCount} dòng`;
            insightStat2.innerText = `${data.colCount} cột`;
            insightStat3.innerText = `${stats.missingValues} ô trống`;
            
            insightsPlaceholder.style.display = "none";
            insightsResults.style.display = "flex";
            
            // Render chart (automatically pick first numerical column or row count)
            const numCols = stats.columns.filter(c => c.type === "Số");
            let valueColName = numCols.length > 0 ? numCols[0].name : data.headers[0];
            
            let chartLabels = [];
            let chartValues = [];
            
            const labelColIndex = 0;
            const valueColIndex = numCols.length > 0 ? data.headers.indexOf(valueColName) : 0;
            
            // Get data from data.rows preview (up to 5)
            data.rows.forEach(r => {
                chartLabels.push(r[labelColIndex] || "Dòng");
                const val = parseFloat(r[valueColIndex]);
                chartValues.push(isNaN(val) ? 1 : val);
            });
            
            const chartData = {
                labels: chartLabels,
                datasets: [
                    {
                        label: `${valueColName} (Xem trước)`,
                        data: chartValues,
                        borderColor: "#06b6d4",
                        backgroundColor: "rgba(6, 182, 212, 0.1)",
                        borderWidth: 2
                    }
                ]
            };
            
            renderChart("line", chartData);
            
            // Generate AI suggestions
            const suggestions = aiService.generateDataAnalysisSuggestions(stats);
            let suggestionsText = suggestions.map(s => `• <strong>[${s.type}]</strong> ${s.text}`).join("<br>");
            aiAnalysisNarrative.innerHTML = `<strong>Phân tích tệp ${data.name}:</strong><br>${suggestionsText}`;
            
            historyService.addOperation("file", `Tải lên & phân tích file CSV: "${data.name}" (${data.rowCount} dòng, ${data.colCount} cột)`);
            adminService.addSystemLog("success", `Data Analyzer: User parsed uploaded file '${file.name}'`);
            showToast("Phân tích dữ liệu hoàn tất!", "success");
            
        } catch (error) {
            console.error(error);
            showToast(error.toString(), "error");
        }
    }

    // Sample database loading
    if (sampleSalesBtn) {
        sampleSalesBtn.addEventListener("click", () => {
            showToast("Đang tải dữ liệu mẫu Doanh Thu Bán Hàng...", "info");
            setTimeout(() => {
                const headers = ["Tháng", "Mục tiêu (Mđ)", "Thực tế (Mđ)", "Tỷ lệ đạt (%)"];
                const rows = [
                    ["Tháng 1", "50", "48", "96%"],
                    ["Tháng 2", "55", "58", "105%"],
                    ["Tháng 3", "60", "64", "106%"],
                    ["Tháng 4", "65", "62", "95%"],
                    ["Tháng 5", "70", "78", "111%"]
                ];
                renderTable(headers, rows);
                
                if (insightStat1) insightStat1.innerText = "310Mđ";
                if (insightStat2) insightStat2.innerText = "62Mđ";
                if (insightStat3) insightStat3.innerText = "Tháng 5 (+11%)";

                if (insightsPlaceholder) insightsPlaceholder.style.display = "none";
                if (insightsResults) insightsResults.style.display = "flex";

                const chartData = {
                    labels: ["T1", "T2", "T3", "T4", "T5"],
                    datasets: [
                        { label: "Doanh thu thực tế (Mđ)", data: [48, 58, 64, 62, 78], backgroundColor: "rgba(16, 124, 65, 0.5)", borderColor: "#107c41", borderWidth: 1 }
                    ]
                };
                renderChart("bar", chartData);
                
                if (aiAnalysisNarrative) aiAnalysisNarrative.innerText = "Doanh thu tích lũy 5 tháng đầu năm đạt 310 triệu đồng, vượt chỉ tiêu đề ra trung bình 2.5%. Trong đó Tháng 5 ghi nhận kết quả rực rỡ nhất (78 triệu đồng, đạt 111% mục tiêu đề ra). Xu hướng phát triển chung đang có dấu hiệu đi lên khá ổn định.";

                historyService.addOperation("file", "Phân tích dữ liệu mẫu: Doanh thu bán hàng");
                adminService.addSystemLog("success", "Data Analyzer: Loaded sales sample data set");
            }, 600);
        });
    }

    if (sampleHrBtn) {
        sampleHrBtn.addEventListener("click", () => {
            showToast("Đang tải dữ liệu mẫu Nhân Sự & Lương Bổng...", "info");
            setTimeout(() => {
                const headers = ["Phòng ban", "Số nhân sự", "Quỹ lương (Mđ)", "Lương trung bình"];
                const rows = [
                    ["Kinh doanh", "25", "350", "14Mđ"],
                    ["Kỹ thuật", "18", "420", "23.3Mđ"],
                    ["Marketing", "8", "110", "13.75Mđ"],
                    ["Nhân sự", "4", "52", "13Mđ"],
                    ["Tài chính", "3", "54", "18Mđ"]
                ];
                renderTable(headers, rows);
                
                if (insightStat1) insightStat1.innerText = "58 Người";
                if (insightStat2) insightStat2.innerText = "986Mđ";
                if (insightStat3) insightStat3.innerText = "Kỹ thuật (23.3Mđ)";

                if (insightsPlaceholder) insightsPlaceholder.style.display = "none";
                if (insightsResults) insightsResults.style.display = "flex";

                const chartData = {
                    labels: ["Kinh doanh", "Kỹ thuật", "Marketing", "Nhân sự", "Tài chính"],
                    datasets: [
                        { label: "Quỹ lương (Mđ)", data: [350, 420, 110, 52, 54], backgroundColor: "rgba(139, 92, 246, 0.5)", borderColor: "#8b5cf6", borderWidth: 1 }
                    ]
                };
                renderChart("bar", chartData);
                
                if (aiAnalysisNarrative) aiAnalysisNarrative.innerText = "Phòng Kỹ thuật chiếm tỷ trọng quỹ lương lớn nhất hệ thống với 420 triệu đồng (42.5%), mặc dù số lượng nhân sự ít hơn phòng Kinh doanh (18 so với 25 người). Điều này lý giải mức thu nhập trung bình của kỹ sư công nghệ thông tin cao hơn đáng kể so với mặt bằng chung (đạt 23.3 triệu đồng).";

                historyService.addOperation("file", "Phân tích dữ liệu mẫu: Nhân sự & Lương bổng");
                adminService.addSystemLog("success", "Data Analyzer: Loaded HR sample data set");
            }, 600);
        });
    }

    function renderTable(headers, rows) {
        parsedRowName.innerText = rows.length;
        
        let html = `<thead><tr>`;
        headers.forEach(h => html += `<th>${h}</th>`);
        html += `</tr></thead><tbody>`;
        
        rows.forEach(r => {
            html += `<tr>`;
            r.forEach(val => html += `<td>${val}</td>`);
            html += `</tr>`;
        });
        html += `</tbody>`;
        
        parsedDataTable.innerHTML = html;
        analyzerTableCard.style.display = "block";
    }

    function renderChart(type, data) {
        if (state.chartInstance) {
            state.chartInstance.destroy();
        }

        const canvas = document.getElementById("analyzer-chart");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#f3f4f6", font: { family: "Outfit" } } }
            },
            scales: {
                y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9ca3af", font: { family: "Outfit" } } },
                x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { family: "Outfit" } } }
            }
        };

        state.chartInstance = new Chart(ctx, {
            type: type,
            data: data,
            options: options
        });
    }

    // ----------------------------------------------------------------------
    // 13. ADMIN CONTROL PANEL MANAGEMENT
    // ----------------------------------------------------------------------
    function renderAdminPanel() {
        const metrics = adminService.getSystemDashboardMetrics(state.users);
        adminStatUsers.innerText = metrics.totalUsers.toLocaleString();
        
        let totalRevenue = 0;
        state.users.forEach(u => {
            if (u.status === "Hoạt động") {
                if (u.tier === "pro") totalRevenue += 149000;
                else if (u.tier === "enterprise" || u.tier === "business") totalRevenue += 399000;
            }
        });
        adminStatMrr.innerText = totalRevenue.toLocaleString() + "đ";

        // Bind admin sidebar items click listeners once
        if (!state.adminListenersBound) {
            adminSidebarItems.forEach(item => {
                item.addEventListener("click", () => {
                    const tabId = item.getAttribute("data-admin-tab");
                    switchAdminTab(tabId);
                });
            });
            state.adminListenersBound = true;
        }

        // Load active admin tab
        const activeTab = document.querySelector("#admin-view .sidebar-item.active");
        const activeTabId = activeTab ? activeTab.getAttribute("data-admin-tab") : "overview";
        switchAdminTab(activeTabId);
    }

    function switchAdminTab(tabId) {
        adminSidebarItems.forEach(btn => {
            btn.classList.remove("active");
            if (btn.getAttribute("data-admin-tab") === tabId) {
                btn.classList.add("active");
            }
        });

        adminTabPanels.forEach(panel => {
            panel.classList.remove("active");
        });
        const targetPanel = document.getElementById(`admin-tab-${tabId}`);
        if (targetPanel) {
            targetPanel.classList.add("active");
        }

        if (tabId === "overview") {
            renderAdminOverview();
        } else if (tabId === "users") {
            renderAdminUsers();
        } else if (tabId === "workspaces") {
            renderAdminWorkspaces();
        } else if (tabId === "jobs") {
            renderAdminJobs();
        } else if (tabId === "quota") {
            // Static token progress charts
        } else if (tabId === "billing") {
            renderAdminBilling();
        } else if (tabId === "prompts") {
            renderAdminPrompts();
        } else if (tabId === "templates") {
            renderAdminTemplates();
        } else if (tabId === "feedback") {
            renderAdminFeedbacks();
        } else if (tabId === "audit") {
            renderAdminAudits();
        } else if (tabId === "system-logs") {
            renderLogs();
        } else if (tabId === "security") {
            renderAdminSecurity();
        } else if (tabId === "features") {
            renderAdminFeatures();
        }
    }

    function renderAdminOverview() {
        const metrics = adminService.getSystemDashboardMetrics(state.users);
        adminStatUsers.innerText = metrics.totalUsers.toLocaleString();
        
        let totalRevenue = 0;
        state.users.forEach(u => {
            if (u.status === "Hoạt động") {
                if (u.tier === "pro") totalRevenue += 149000;
                else if (u.tier === "enterprise" || u.tier === "business") totalRevenue += 399000;
            }
        });
        adminStatMrr.innerText = totalRevenue.toLocaleString() + "đ";
        document.getElementById("admin-uptime-value").innerText = `Hoạt động tốt (${metrics.uptime})`;
    }

    function renderAdminUsers() {
        let userRowsHtml = "";
        state.users.forEach(user => {
            const badgeClass = user.status === "Hoạt động" ? "badge-active" : "badge-banned";
            const banBtnText = user.status === "Hoạt động" ? "Khóa" : "Mở khóa";
            
            userRowsHtml += `
                <tr>
                    <td style="font-weight: 600; cursor: pointer; text-decoration: underline;" onclick="window.viewUserAudit(${user.id})" title="Click để xem chi tiết">${user.name} ${user.id === 1 ? " (Bạn)" : ""}</td>
                    <td>${user.email}</td>
                    <td><span class="user-tier-badge tier-${user.tier}">${user.tier.toUpperCase()}</span></td>
                    <td>${user.usageCount} lượt chat</td>
                    <td><span class="admin-badge ${badgeClass}">${user.status}</span></td>
                    <td class="admin-actions-btns">
                        <button class="admin-btn admin-btn-edit" onclick="window.editUser(${user.id})">Sửa</button>
                        <button class="admin-btn admin-btn-ban" onclick="window.toggleUserBan(${user.id})">${banBtnText}</button>
                    </td>
                </tr>
            `;
        });
        adminUserTableBody.innerHTML = userRowsHtml;
    }

    function renderAdminWorkspaces() {
        const tbody = document.getElementById("admin-workspaces-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        state.users.forEach(u => {
            const retention = u.id === 1 ? "30 ngày" : "7 ngày";
            const fileCount = u.id === 1 ? "3 files" : "1 file";
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:600;">Workspace của ${u.name}</td>
                <td>${u.email}</td>
                <td>${fileCount}</td>
                <td>${retention}</td>
                <td><span class="admin-badge badge-active">${u.status}</span></td>
                <td>
                    <button class="admin-btn btn-xs" onclick="alert('Tính năng quản trị Workspace sẽ cấu hình sâu hơn ở bản Enterprise.')" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;">Cấu hình</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderAdminJobs() {
        const tbody = document.getElementById("admin-jobs-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        const jobs = adminService.loadJobs();
        jobs.forEach(j => {
            let statusClass = "status-ready";
            if (j.status === "processing") statusClass = "status-processing";
            else if (j.status === "failed") statusClass = "status-failed";
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-family: var(--font-mono); font-size: 0.75rem;">${j.id}</td>
                <td style="font-weight: 500;">${j.fileName}</td>
                <td>${j.owner}</td>
                <td>${j.size}</td>
                <td><span class="user-tier-badge tier-accent">${j.type}</span></td>
                <td>${j.duration}</td>
                <td><span class="status-pill ${statusClass}">${j.status.toUpperCase()}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderAdminBilling() {
        const priceProInput = document.getElementById("config-price-pro");
        const priceEntInput = document.getElementById("config-price-enterprise");
        if (priceProInput) priceProInput.value = pricing.monthly.pro;
        if (priceEntInput) priceEntInput.value = pricing.monthly.enterprise;
        
        renderAdminCoupons();
    }

    function renderAdminPrompts() {
        const config = adminService.loadPromptConfig();
        adminSystemPrompt.value = config.systemPrompt || "";
        adminSystemLimit.value = config.freeLimit || 20;
        
        const formulaPrompt = document.getElementById("admin-formula-prompt");
        if (formulaPrompt) formulaPrompt.value = config.formulaPrompt || "";
        
        const vbaPrompt = document.getElementById("admin-vba-prompt");
        if (vbaPrompt) vbaPrompt.value = config.vbaPrompt || "";

        const checkerPrompt = document.getElementById("admin-checker-prompt");
        if (checkerPrompt) checkerPrompt.value = config.checkerPrompt || "";

        const reconciliationPrompt = document.getElementById("admin-reconciliation-prompt");
        if (reconciliationPrompt) reconciliationPrompt.value = config.reconciliationPrompt || "";
    }

    function renderAdminTemplates() {
        const tbody = document.getElementById("admin-templates-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        const templates = initialTemplates; 
        templates.forEach(t => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-size: 1.25rem;">${t.icon}</td>
                <td style="font-weight: 600;">${t.name}</td>
                <td><span class="user-tier-badge tier-free">${t.category.toUpperCase()}</span></td>
                <td style="font-family: var(--font-mono); font-size: 0.75rem;">${t.file}</td>
                <td style="font-size: 0.8rem; color: var(--color-text-muted);">${t.description}</td>
                <td>
                    <button class="admin-btn admin-btn-ban" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="alert('Tính năng khóa template chỉ áp dụng trên Database thực tế.')">Khóa</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderAdminFeedbacks() {
        const tbody = document.getElementById("admin-feedbacks-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        const feedbacks = adminService.loadFeedbacks();
        feedbacks.forEach(f => {
            const replyInputId = `feedback-reply-${f.id}`;
            const isResolved = f.status === "resolved";
            const statusBadge = isResolved ? "badge-active" : "badge-banned";
            const statusText = isResolved ? "Đã phản hồi" : "Mới";
            
            const replyContent = isResolved 
                ? `<span style="color:var(--color-success); font-size:0.8rem; font-weight:500;">${f.reply}</span>` 
                : `<div class="input-with-button" style="display:flex; gap:0.25rem;">
                       <input type="text" id="${replyInputId}" placeholder="Nhập câu trả lời..." style="font-size: 0.8rem; padding: 0.3rem; flex:1; background:rgba(0,0,0,0.2); border:1px solid var(--border-glass); color:#fff; border-radius:4px;">
                       <button class="btn btn-primary btn-xs" onclick="window.replyFeedback(${f.id})" style="padding: 0.3rem 0.6rem; border-radius:4px;">Gửi</button>
                   </div>`;
                   
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:600;">${f.userName}</td>
                <td><span class="user-tier-badge tier-accent" style="font-size:0.7rem;">${f.type}</span></td>
                <td style="font-size:0.8rem; line-height:1.4; text-align:left;">${f.text}</td>
                <td><span class="admin-badge ${statusBadge}">${statusText}</span></td>
                <td>${replyContent}</td>
                <td>
                    <button class="admin-btn admin-btn-ban" style="padding:0.15rem 0.4rem; font-size:0.7rem;" onclick="alert('Đã lưu trữ phản hồi.')">Lưu trữ</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.replyFeedback = function(id) {
        const replyInput = document.getElementById(`feedback-reply-${id}`);
        if (!replyInput) return;
        const text = replyInput.value.trim();
        if (!text) {
            showToast("Vui lòng nhập nội dung trả lời!", "error");
            return;
        }
        
        adminService.replyFeedback(id, text);
        showToast("Đã gửi phản hồi thành công!");
        adminService.addSystemLog("success", `Feedback: Admin replied to feedback #${id}`);
        renderAdminFeedbacks();
    };

    function renderAdminAudits() {
        const tbody = document.getElementById("admin-audit-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        const mockAudits = [
            { time: "09:24:11", user: "Admin (Trần Minh Trí)", action: "Thay đổi system prompt của module VBA", ip: "192.168.10.35", level: "info" },
            { time: "09:15:20", user: "Admin (Trần Minh Trí)", action: "Khởi tạo mã giảm giá FREEPRO (-100%)", ip: "192.168.10.35", level: "warning" },
            { time: "08:45:12", user: "System", action: "Tự động đồng bộ và nén logs hệ thống", ip: "localhost", level: "info" },
            { time: "08:12:00", user: "Nguyễn Văn Hùng", action: "Đăng nhập trang quản trị (Thất bại - IP lạ)", ip: "103.24.12.89", level: "danger" }
        ];
        
        mockAudits.forEach(a => {
            let lvlClass = "tier-free";
            if (a.level === "warning") lvlClass = "tier-pro";
            else if (a.level === "danger") lvlClass = "tier-enterprise";
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span style="color:var(--color-text-muted);">${a.time}</span></td>
                <td style="font-weight:600;">${a.user}</td>
                <td>${a.action}</td>
                <td style="font-family:var(--font-mono); font-size:0.75rem;">${a.ip}</td>
                <td><span class="user-tier-badge ${lvlClass}">${a.level.toUpperCase()}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderAdminSecurity() {
        const settings = adminService.loadSecuritySettings();
        document.getElementById("security-filesize").value = settings.fileSizeLimit;
        document.getElementById("security-rate-limit").value = settings.rateLimit;
        document.getElementById("security-macro-warning").checked = settings.enableMacroWarning;
        document.getElementById("security-sensitive-warn").checked = settings.sensitiveDataWarning;
    }

    // Wire up Security save button
    const adminSaveSecurityBtn = document.getElementById("admin-save-security-btn");
    if (adminSaveSecurityBtn) {
        adminSaveSecurityBtn.addEventListener("click", () => {
            const limit = parseInt(document.getElementById("security-filesize").value) || 10;
            const rate = parseInt(document.getElementById("security-rate-limit").value) || 100;
            const macro = document.getElementById("security-macro-warning").checked;
            const sensitive = document.getElementById("security-sensitive-warn").checked;
            
            const settings = adminService.loadSecuritySettings();
            settings.fileSizeLimit = limit;
            settings.rateLimit = rate;
            settings.enableMacroWarning = macro;
            settings.sensitiveDataWarning = sensitive;
            
            adminService.saveSecuritySettings(settings);
            showToast("Đã cập nhật chính sách bảo mật hệ thống!", "success");
            adminService.addSystemLog("warning", `System: Admin updated security configurations (Size: ${limit}MB, Rate: ${rate}/min)`);
        });
    }

    function renderAdminFeatures() {
        if (flagEnableAutopilot) flagEnableAutopilot.checked = state.featureFlags.enable_autopilot;
        if (flagEnableTableBuilder) flagEnableTableBuilder.checked = state.featureFlags.enable_table_builder;
        if (flagEnableDocumentBuilder) flagEnableDocumentBuilder.checked = state.featureFlags.enable_document_builder;
        if (flagEnableDataChecker) flagEnableDataChecker.checked = state.featureFlags.enable_data_checker;
        if (flagEnableReconciliation) flagEnableReconciliation.checked = state.featureFlags.enable_reconciliation;
    }

    if (adminSaveFlagsBtn) {
        adminSaveFlagsBtn.addEventListener("click", () => {
            const newFlags = {
                enable_autopilot: flagEnableAutopilot ? flagEnableAutopilot.checked : true,
                enable_table_builder: flagEnableTableBuilder ? flagEnableTableBuilder.checked : true,
                enable_document_builder: flagEnableDocumentBuilder ? flagEnableDocumentBuilder.checked : true,
                enable_data_checker: flagEnableDataChecker ? flagEnableDataChecker.checked : true,
                enable_reconciliation: flagEnableReconciliation ? flagEnableReconciliation.checked : true
            };
            saveFeatureFlags(newFlags);
            adminService.addSystemLog("success", `System: Admin updated Feature Flags state: ${JSON.stringify(newFlags)}`);
            showToast("Đã cập nhật cấu hình Feature Flags thành công!", "success");
        });
    }

    function renderLogs() {
        let logsHtml = "";
        const logs = adminService.loadSystemLogs();
        logs.forEach(log => {
            const classType = log.type === "success" ? "log-success" : "log-warning";
            logsHtml += `
                <div class="log-line">
                    <span class="log-time">[${log.time}]</span>
                    <span class="${classType}">${log.text}</span>
                </div>
            `;
        });
        const systemLogsBox = document.getElementById("admin-system-logs");
        if (systemLogsBox) {
            systemLogsBox.innerHTML = logsHtml;
            systemLogsBox.scrollTop = systemLogsBox.scrollHeight;
        }
    }

    // Connect log clearing button
    const adminClearLogsBtn = document.getElementById("admin-clear-logs-btn");
    if (adminClearLogsBtn) {
        adminClearLogsBtn.addEventListener("click", () => {
            adminService.saveSystemLogs([]);
            renderLogs();
            showToast("Đã xóa nhật ký hệ thống thành công!");
        });
    }

    // Save configuration prompts
    adminSavePromptBtn.addEventListener("click", () => {
        const sysP = adminSystemPrompt.value.trim();
        const limitVal = parseInt(adminSystemLimit.value) || 20;

        const config = adminService.loadPromptConfig();
        config.systemPrompt = sysP;
        config.freeLimit = limitVal;

        const formulaPrompt = document.getElementById("admin-formula-prompt");
        if (formulaPrompt) config.formulaPrompt = formulaPrompt.value.trim();
        
        const vbaPrompt = document.getElementById("admin-vba-prompt");
        if (vbaPrompt) config.vbaPrompt = vbaPrompt.value.trim();

        const checkerPrompt = document.getElementById("admin-checker-prompt");
        if (checkerPrompt) config.checkerPrompt = checkerPrompt.value.trim();

        const reconciliationPrompt = document.getElementById("admin-reconciliation-prompt");
        if (reconciliationPrompt) config.reconciliationPrompt = reconciliationPrompt.value.trim();
        
        adminService.savePromptConfig(config);
        state.systemPrompt = sysP;
        state.freeLimit = limitVal;

        // Update active limit for Free
        if (state.currentUser.tier === "free") {
            state.currentUser.usageLimit = limitVal;
        }

        adminService.addSystemLog("warning", "System: Admin updated AI System Prompts and Limits");
        showToast("Đã lưu các tùy chọn cấu hình prompts thành công!", "success");
        updateWorkspaceSidebarUI();
    });

    // Custom Global scope hooks for onclick inside tables
    window.toggleUserBan = function(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;
        
        if (userId === 1) {
            showToast("Bạn không thể tự khóa tài khoản của chính mình!", "error");
            return;
        }

        if (user.status === "Hoạt động") {
            user.status = "Đã khóa";
            showToast(`Đã khóa tài khoản của ${user.name}`, "warning");
            adminService.addSystemLog("warning", `System: Account of '${user.email}' was BANNED`);
        } else {
            user.status = "Hoạt động";
            showToast(`Đã mở khóa tài khoản của ${user.name}`);
            adminService.addSystemLog("success", `System: Account of '${user.email}' was UNBANNED`);
        }
        
        billingService.saveUsers(state.users);
        renderAdminPanel();
    };

    window.editUser = function(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;

        editUserIdInput.value = user.id;
        editUserNameInput.value = user.name;
        editUserEmailInput.value = user.email;
        editUserTierSelect.value = user.tier;
        editUserStatusSelect.value = user.status;

        adminUserModal.classList.add("active");
    };

    adminUserCloseBtn.addEventListener("click", () => {
        adminUserModal.classList.remove("active");
    });

    adminUserForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = parseInt(editUserIdInput.value);
        const user = state.users.find(u => u.id === id);
        if (!user) return;

        user.name = editUserNameInput.value;
        user.email = editUserEmailInput.value;
        user.tier = editUserTierSelect.value;
        user.status = editUserStatusSelect.value;

        // If current logged-in user edited, update active session
        if (id === 1) {
            state.currentUser.name = user.name;
            state.currentUser.email = user.email;
            state.currentUser.tier = user.tier;
            state.currentUser.status = user.status;
            
            // Adjust limits
            if (user.tier === "free") state.currentUser.usageLimit = state.freeLimit;
            else if (user.tier === "pro") state.currentUser.usageLimit = 500;
            else state.currentUser.usageLimit = Infinity;

            updateWorkspaceSidebarUI();
        }

        billingService.saveUsers(state.users);
        adminUserModal.classList.remove("active");
        showToast("Đã cập nhật thông tin người dùng!");
        adminService.addSystemLog("success", `System: Admin updated details for user ${user.email}`);
        
        renderAdminPanel();
    });

    // Add user mock button
    adminAddUserBtn.addEventListener("click", () => {
        const newId = state.users.length + 1;
        const newUser = {
            id: newId,
            name: `Khách Hàng ${newId}`,
            email: `customer${newId}@example.com`,
            tier: "free",
            usageCount: 0,
            usageLimit: 20,
            status: "Hoạt động",
            registeredAt: new Date().toLocaleDateString('vi-VN')
        };
        state.users.push(newUser);
        billingService.saveUsers(state.users);
        showToast("Đã thêm tài khoản khách hàng mới (Demo)");
        adminService.addSystemLog("success", `System: Created new user account customer${newId}@example.com`);
        renderAdminPanel();
    });

    // ----------------------------------------------------------------------
    // EXPANDED CONTROLLER LOGIC (COUPONS, PRICING CONFIG, API KEYS, BROADCAST & DEEP-DIVE AUDIT)
    // ----------------------------------------------------------------------

    // A. Coupon Management
    const configCouponCode = document.getElementById("config-coupon-code");
    const configCouponPercent = document.getElementById("config-coupon-percent");
    const adminAddCouponBtn = document.getElementById("admin-add-coupon-btn");
    const adminCouponsTableBody = document.getElementById("admin-coupons-table-body");

    function renderAdminCoupons() {
        if (!adminCouponsTableBody) return;
        adminCouponsTableBody.innerHTML = "";
        
        state.coupons.forEach(c => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:600;">${c.code}</td>
                <td>Giảm ${c.percent}%</td>
                <td>
                    <button class="admin-btn admin-btn-ban" style="padding:0.15rem 0.4rem; font-size:0.7rem;" onclick="window.removeCoupon('${c.code}')">Xóa</button>
                </td>
            `;
            adminCouponsTableBody.appendChild(tr);
        });
    }

    window.removeCoupon = function(code) {
        const index = state.coupons.findIndex(c => c.code === code);
        if (index === -1) return;
        
        state.coupons.splice(index, 1);
        billingService.saveCoupons(state.coupons);
        renderAdminCoupons();
        showToast(`Đã xóa mã giảm giá: ${code}`, "info");
        adminService.addSystemLog("warning", `Coupons: Admin deleted coupon code '${code}'`);
    };

    if (adminAddCouponBtn) {
        adminAddCouponBtn.addEventListener("click", () => {
            const code = configCouponCode.value.trim().toUpperCase();
            const percent = parseInt(configCouponPercent.value);
            
            if (!code || isNaN(percent) || percent < 1 || percent > 100) {
                showToast("Vui lòng nhập mã hợp lệ và % giảm từ 1 đến 100!", "error");
                return;
            }
            
            if (state.coupons.some(c => c.code === code)) {
                showToast("Mã coupon này đã tồn tại!", "error");
                return;
            }
            
            state.coupons.push({ code, percent });
            billingService.saveCoupons(state.coupons);
            
            configCouponCode.value = "";
            configCouponPercent.value = "50";
            
            renderAdminCoupons();
            showToast(`Đã thêm mã giảm giá ${code} giảm ${percent}%!`, "success");
            adminService.addSystemLog("success", `Coupons: Admin created coupon code '${code}' (-${percent}%)`);
        });
    }

    // B. Pricing config & sync
    const configPricePro = document.getElementById("config-price-pro");
    const configPriceEnterprise = document.getElementById("config-price-enterprise");
    const adminSavePricingBtn = document.getElementById("admin-save-pricing-btn");

    function syncPricingUI() {
        const cycle = state.billingCycle;
        priceProText.innerText = pricing[cycle].pro;
        periodProText.innerText = pricing[cycle].period;
        priceEnterpriseText.innerText = pricing[cycle].enterprise;
        periodEnterpriseText.innerText = pricing[cycle].period;
        
        const miniPricePro = document.querySelector("#mini-card-pro .mini-price");
        if (miniPricePro) {
            miniPricePro.innerHTML = `${pricing.monthly.pro}<span class="mini-period">/tháng</span>`;
        }
        const miniPriceEnterprise = document.querySelector("#mini-card-enterprise .mini-price");
        if (miniPriceEnterprise) {
            miniPriceEnterprise.innerHTML = `${pricing.monthly.enterprise}<span class="mini-period">/tháng</span>`;
        }
    }

    if (adminSavePricingBtn) {
        adminSavePricingBtn.addEventListener("click", () => {
            const valPro = configPricePro.value.trim();
            const valEnterprise = configPriceEnterprise.value.trim();
            
            if (!valPro || !valEnterprise) {
                showToast("Vui lòng nhập đầy đủ giá cước!", "error");
                return;
            }
            
            pricing.monthly.pro = valPro;
            let numPro = parseInt(valPro.replace(/[^0-9]/g, ""));
            if (!isNaN(numPro)) {
                let annPro = Math.round(numPro * 0.8 / 1000) * 1000;
                pricing.annual.pro = annPro.toLocaleString("vi-VN") + "đ";
            }
            
            pricing.monthly.enterprise = valEnterprise;
            let numEnterprise = parseInt(valEnterprise.replace(/[^0-9]/g, ""));
            if (!isNaN(numEnterprise)) {
                let annEnt = Math.round(numEnterprise * 0.8 / 1000) * 1000;
                pricing.annual.enterprise = annEnt.toLocaleString("vi-VN") + "đ";
            }
            
            syncPricingUI();
            showToast("Đã cập nhật biểu giá dịch vụ trên toàn hệ thống!", "success");
            adminService.addSystemLog("warning", `System: Admin updated service pricing. Pro: ${valPro}/tháng, Business: ${valEnterprise}/tháng`);
        });
    }

    // Checkout coupon codes listener
    const applyCouponBtn = document.getElementById("apply-coupon-btn");
    const checkoutCouponInput = document.getElementById("checkout-coupon-input");
    const couponMessage = document.getElementById("coupon-message");

    if (applyCouponBtn) {
        applyCouponBtn.addEventListener("click", () => {
            const code = checkoutCouponInput.value.trim().toUpperCase();
            if (!code) {
                couponMessage.style.display = "block";
                couponMessage.className = "coupon-invalid";
                couponMessage.innerText = "Vui lòng nhập mã giảm giá!";
                return;
            }
            
            const validation = billingService.validateCoupon(code);
            if (validation.valid) {
                state.activeDiscount = validation.percent;
                state.activeCouponCode = code;
                
                couponMessage.style.display = "block";
                couponMessage.className = "coupon-valid";
                couponMessage.innerText = `Áp dụng thành công: Giảm ${validation.percent}%!`;
                
                // Calculate discounted price
                const basePriceStr = pricing[state.billingCycle][state.selectedUpgradeTier];
                const finalPrice = billingService.calculateDiscount(basePriceStr, validation.percent);
                checkoutTierPrice.innerText = finalPrice;
                
                showToast(`Đã áp dụng mã giảm giá ${code}!`);
            } else {
                state.activeDiscount = 0;
                state.activeCouponCode = "";
                
                couponMessage.style.display = "block";
                couponMessage.className = "coupon-invalid";
                couponMessage.innerText = "Mã giảm giá không hợp lệ!";
                
                const origPrice = pricing[state.billingCycle][state.selectedUpgradeTier];
                checkoutTierPrice.innerText = origPrice;
            }
        });
    }

    // C. Broadcast live notice system
    const adminBroadcastInput = document.getElementById("admin-broadcast-input");
    const adminSendBroadcastBtn = document.getElementById("admin-send-broadcast-btn");

    function showBroadcast(message) {
        let banner = document.getElementById("workspace-broadcast-banner");
        if (!banner) {
            banner = document.createElement("div");
            banner.id = "workspace-broadcast-banner";
            banner.style.background = "linear-gradient(90deg, rgba(16, 124, 65, 0.3) 0%, rgba(6, 182, 212, 0.3) 100%)";
            banner.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
            banner.style.padding = "0.6rem 2.5rem 0.6rem 1rem";
            banner.style.color = "#f3f4f6";
            banner.style.fontSize = "0.8rem";
            banner.style.fontWeight = "500";
            banner.style.position = "relative";
            banner.style.width = "100%";
            banner.style.overflow = "hidden";
            banner.style.backdropFilter = "blur(10px)";
            
            banner.innerHTML = `
                <marquee id="broadcast-marquee-text" scrollamount="4" style="display: block; width: 100%;"></marquee>
                <button id="close-broadcast-btn" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: #f3f4f6; font-size: 1.1rem; cursor: pointer; line-height: 1; opacity: 0.7; transition: 0.2s;">&times;</button>
            `;
            
            workspaceView.insertBefore(banner, workspaceView.firstChild);
            
            banner.querySelector("#close-broadcast-btn").addEventListener("click", () => {
                banner.style.display = "none";
            });
            banner.querySelector("#close-broadcast-btn").addEventListener("mouseenter", (e) => { e.target.style.opacity = 1; });
            banner.querySelector("#close-broadcast-btn").addEventListener("mouseleave", (e) => { e.target.style.opacity = 0.7; });
        }
        
        banner.style.display = "block";
        banner.querySelector("#broadcast-marquee-text").innerText = `📣 THÔNG BÁO HỆ THỐNG: ${message}`;
    }

    if (adminSendBroadcastBtn) {
        adminSendBroadcastBtn.addEventListener("click", () => {
            const message = adminBroadcastInput.value.trim();
            if (!message) {
                showToast("Vui lòng nhập thông điệp thông báo!", "error");
                return;
            }
            showBroadcast(message);
            adminBroadcastInput.value = "";
            showToast("Đã phát sóng thông báo đến toàn bộ người dùng!", "success");
            adminService.addSystemLog("warning", `Broadcast: Admin sent notice: "${message}"`);
        });
    }

    // D. Developer API Keys Manager
    const generateKeyBtn = document.getElementById("generate-key-btn");
    const unlockProApiBtn = document.getElementById("unlock-pro-api-btn");

    function checkAPIKeysLock() {
        const tier = state.currentUser.tier;
        const overlay = document.getElementById("apikeys-lock-overlay");
        if (overlay) {
            overlay.style.display = tier === "free" ? "flex" : "none";
        }
    }

    if (unlockProApiBtn) {
        unlockProApiBtn.addEventListener("click", () => {
            triggerPayment("pro");
        });
    }

    function renderAPIKeysTable() {
        const tbody = document.getElementById("apikeys-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        state.apiKeys.forEach(item => {
            const tr = document.createElement("tr");
            const maskedKey = item.key.substring(0, 10) + "..." + item.key.substring(item.key.length - 4);
            const statusBadge = item.status === "Hoạt động" ? "badge-active" : "badge-banned";
            const actionBtnText = item.status === "Hoạt động" ? "Thu hồi" : "Kích hoạt";
            
            tr.innerHTML = `
                <td style="font-weight: 500;">${item.label}</td>
                <td style="font-family: var(--font-mono); font-size: 0.75rem;">${maskedKey}</td>
                <td><span class="admin-badge ${statusBadge}">${item.status}</span></td>
                <td>
                    <button class="admin-btn admin-btn-ban" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="window.toggleAPIKey(${item.id})">${actionBtnText}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.toggleAPIKey = function(id) {
        const key = state.apiKeys.find(k => k.id === id);
        if (!key) return;
        
        if (key.status === "Hoạt động") {
            key.status = "Đã thu hồi";
            showToast(`Đã thu hồi API Key: ${key.label}`, "warning");
            adminService.addSystemLog("warning", `API Keys: User revoked API Key '${key.label}'`);
        } else {
            key.status = "Hoạt động";
            showToast(`Đã kích hoạt API Key: ${key.label}`);
            adminService.addSystemLog("success", `API Keys: User activated API Key '${key.label}'`);
        }
        
        adminService.saveAPIKeys(state.apiKeys);
        renderAPIKeysTable();
        renderAPIKeysChart();
    };

    function generateNewAPIKey() {
        const labelInput = document.getElementById("new-key-name");
        const label = labelInput.value.trim() || `API Key ${state.apiKeys.length + 1}`;
        
        const hex = "0123456789abcdef";
        let randPart = "";
        for (let i = 0; i < 16; i++) {
            randPart += hex[Math.floor(Math.random() * 16)];
        }
        const newKey = `sk_live_ex${randPart}`;
        const dateStr = new Date().toLocaleDateString('vi-VN');
        
        const newKeyObj = {
            id: Date.now(),
            label: label,
            key: newKey,
            status: "Hoạt động",
            created: dateStr,
            usage: [15, 24, 18, 30, 25, 45, 12]
        };
        
        state.apiKeys.push(newKeyObj);
        adminService.saveAPIKeys(state.apiKeys);
        
        labelInput.value = "";
        
        renderAPIKeysTable();
        renderAPIKeysChart();
        showToast(`Đã tạo API Key mới: ${label}`, "success");
        adminService.addSystemLog("success", `API Keys: Generated new API Key '${label}'`);
        historyService.addOperation("apikeys", `Tạo khóa API Key: "${label}"`);
    }

    if (generateKeyBtn) {
        generateKeyBtn.addEventListener("click", generateNewAPIKey);
    }

    function renderAPIKeysChart() {
        const canvas = document.getElementById("apikeys-usage-chart");
        if (!canvas) return;
        
        if (state.apiKeysChartInstance) {
            state.apiKeysChartInstance.destroy();
        }
        
        const ctx = canvas.getContext("2d");
        const activeKeys = state.apiKeys.filter(k => k.status === "Hoạt động");
        const labels = ["28/05", "29/05", "30/05", "31/05", "01/06", "02/06", "03/06"];
        
        const datasets = activeKeys.map((k, index) => {
            const colors = [
                { border: "#06b6d4", bg: "rgba(6, 182, 212, 0.05)" },
                { border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.05)" },
                { border: "#107c41", bg: "rgba(16, 124, 65, 0.05)" }
            ];
            const color = colors[index % colors.length];
            return {
                label: k.label,
                data: k.usage,
                borderColor: color.border,
                backgroundColor: color.bg,
                borderWidth: 2,
                tension: 0.3,
                fill: true
            };
        });
        
        const finalDatasets = datasets.length > 0 ? datasets : [{
            label: "Không có API Key hoạt động",
            data: [0, 0, 0, 0, 0, 0, 0],
            borderColor: "rgba(255,255,255,0.1)",
            backgroundColor: "transparent",
            borderWidth: 1
        }];

        state.apiKeysChartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: finalDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: "#f3f4f6", font: { family: "Outfit", size: 9 } } }
                },
                scales: {
                    y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9ca3af", font: { family: "Outfit", size: 9 } } },
                    x: { grid: { display: false }, ticks: { color: "#9ca3af", font: { family: "Outfit", size: 9 } } }
                }
            }
        });
    }

    // E. Excel Templates Library search & download
    const templatesSearchInput = document.getElementById("templates-search-input");
    if (templatesSearchInput) {
        templatesSearchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const cards = document.querySelectorAll("#templates-grid .template-card");
            cards.forEach(card => {
                const title = card.querySelector("h4").innerText.toLowerCase();
                const desc = card.querySelector("p").innerText.toLowerCase();
                const category = card.getAttribute("data-category") || "";
                
                if (title.includes(query) || desc.includes(query) || category.toLowerCase().includes(query)) {
                    card.style.display = "flex";
                } else {
                    card.style.display = "none";
                }
            });
        });
    }

    document.querySelectorAll(".template-dl-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const fileName = btn.getAttribute("data-file") || "excelai_template.xlsx";
            showToast(`Đang chuẩn bị tải về: ${fileName}...`, "info");
            
            setTimeout(() => {
                const fileContent = `ExcelAI Template File: ${fileName}\nCreated automatically by ExcelAI Bot.`;
                const blob = new Blob([fileContent], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement("a");
                link.href = url;
                link.download = fileName;
                link.style.display = "none";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showToast(`Đã tải xuống thành công: ${fileName}!`, "success");
                adminService.addSystemLog("success", `Templates: User downloaded template file '${fileName}'`);
                historyService.addOperation("template", `Tải template: "${fileName}"`);
            }, 1000);
        });
    });

    // F. User Deep-Dive logs view
    window.viewUserAudit = function(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;
        
        document.getElementById("audit-user-name").innerText = user.name;
        document.getElementById("audit-user-email").innerText = user.email;
        
        const tierBadge = document.getElementById("audit-user-tier");
        tierBadge.innerText = user.tier.toUpperCase();
        tierBadge.className = `user-tier-badge tier-${user.tier}`;
        
        document.getElementById("audit-api-count").innerText = user.usageCount;
        
        const statusText = document.getElementById("audit-user-status");
        statusText.innerText = user.status;
        statusText.style.color = user.status === "Hoạt động" ? "var(--color-success)" : "var(--color-danger)";
        
        const auditLogsContainer = document.getElementById("audit-user-logs");
        auditLogsContainer.innerHTML = "";
        
        const mockActions = [
            "Đăng nhập hệ thống qua IP 192.168.1.12",
            "Sinh công thức: XLOOKUP nâng cao",
            "Viết code VBA: Định dạng bảng tự động",
            "Xuất bảng tính mini ra tệp CSV",
            "Tải xuống template: Sổ quỹ thu chi",
            "Gọi API Key: VBA Script Office Home - 245 tokens",
            "Gửi câu hỏi AI Chatbot: Trùng dữ liệu"
        ];
        
        let userLogs = [];
        const count = user.id === 1 ? 5 : Math.floor(Math.random() * 3) + 2;
        
        for (let i = 0; i < count; i++) {
            const randomTime = `09:${Math.floor(Math.random() * 20) + 10}:${Math.floor(Math.random() * 50) + 10}`;
            const randomAction = mockActions[Math.floor(Math.random() * mockActions.length)];
            userLogs.push({ time: randomTime, text: randomAction });
        }
        
        userLogs.sort((a, b) => b.time.localeCompare(a.time));
        
        userLogs.forEach(log => {
            const logLine = document.createElement("div");
            logLine.className = "log-line";
            logLine.innerHTML = `
                <span class="log-time">[${log.time}]</span>
                <span>${log.text}</span>
            `;
            auditLogsContainer.appendChild(logLine);
        });
        
        document.getElementById("admin-user-audit-modal").classList.add("active");
        adminService.addSystemLog("success", `System: Admin viewed deep-dive audit trail for user ${user.email}`);
    };

    const adminAuditCloseBtn = document.getElementById("admin-audit-close-btn");
    if (adminAuditCloseBtn) {
        adminAuditCloseBtn.addEventListener("click", () => {
            document.getElementById("admin-user-audit-modal").classList.remove("active");
        });
    }

    // G. Live metrics simulation
    function startLiveMetrics() {
        const liveCpuText = document.getElementById("live-metric-cpu");
        const liveCpuBar = document.getElementById("live-metric-cpu-bar");
        const liveRamText = document.getElementById("live-metric-ram");
        const liveRamBar = document.getElementById("live-metric-ram-bar");
        
        setInterval(() => {
            let cpu = Math.floor(Math.random() * 30) + 10;
            if (Math.random() > 0.8) cpu += Math.floor(Math.random() * 25);
            let ram = 40 + Math.floor(Math.random() * 8) - 4;
            
            if (liveCpuText && liveCpuBar) {
                liveCpuText.innerText = `${cpu}%`;
                liveCpuBar.style.width = `${cpu}%`;
                if (cpu > 70) {
                    liveCpuBar.style.backgroundColor = "var(--color-danger)";
                } else if (cpu > 40) {
                    liveCpuBar.style.backgroundColor = "var(--color-purple)";
                } else {
                    liveCpuBar.style.backgroundColor = "var(--color-success)";
                }
            }
            if (liveRamText && liveRamBar) {
                liveRamText.innerText = `${ram}%`;
                liveRamBar.style.width = `${ram}%`;
            }
        }, 3000);
    }

    // H. History View Render
    function renderOperationsHistory(filter = "all") {
        const tbody = document.getElementById("user-history-table-body");
        const emptyState = document.getElementById("history-empty-state");
        if (!tbody) return;
        
        tbody.innerHTML = "";
        const list = historyService.loadOperationsHistory();
        
        const filteredList = list.filter(item => {
            if (filter === "all") return true;
            return item.type.toLowerCase() === filter.toLowerCase();
        });
        
        if (filteredList.length === 0) {
            emptyState.style.display = "block";
            tbody.parentElement.parentElement.style.display = "none";
        } else {
            emptyState.style.display = "none";
            tbody.parentElement.parentElement.style.display = "block";
            
            filteredList.forEach(item => {
                const tr = document.createElement("tr");
                let badgeClass = "tier-free";
                if (item.type.toLowerCase() === "vba") badgeClass = "tier-pro";
                else if (item.type.toLowerCase() === "formula") badgeClass = "tier-enterprise";
                else if (item.type.toLowerCase() === "file") badgeClass = "tier-accent";
                
                tr.innerHTML = `
                    <td><span style="color: var(--color-text-muted);">${item.date} ${item.time}</span></td>
                    <td><span class="user-tier-badge ${badgeClass}">${item.type.toUpperCase()}</span></td>
                    <td style="font-weight: 500;">${item.action}</td>
                    <td>
                        <button class="btn-copy" onclick="window.copyHistoryContent('${encodeURIComponent(item.action)}')">Copy</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    window.copyHistoryContent = function(encodedContent) {
        const content = decodeURIComponent(encodedContent);
        navigator.clipboard.writeText(content);
        showToast("Đã sao chép nội dung lịch sử!");
    };

    const historyFilters = document.querySelectorAll(".history-filters .filter-btn");
    historyFilters.forEach(btn => {
        btn.addEventListener("click", () => {
            historyFilters.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const filterVal = btn.getAttribute("data-filter");
            renderOperationsHistory(filterVal);
        });
    });

    // I. Setup workspace setting configurations listeners
    if (settingsWorkspaceName) {
        const savedWorkspaceName = localStorage.getItem("excelai_settings_workspace_name");
        if (savedWorkspaceName) {
            settingsWorkspaceName.value = savedWorkspaceName;
        }
    }
    if (settingsRetention) {
        const savedRetention = localStorage.getItem("excelai_settings_retention");
        if (savedRetention) {
            settingsRetention.value = savedRetention;
        }
    }

    if (settingsSaveBtn) {
        settingsSaveBtn.addEventListener("click", () => {
            const workspaceName = settingsWorkspaceName.value.trim();
            const retentionVal = settingsRetention.value;
            
            localStorage.setItem("excelai_settings_workspace_name", workspaceName);
            localStorage.setItem("excelai_settings_retention", retentionVal);
            
            showToast("Đã lưu cấu hình Workspace thành công!", "success");
            adminService.addSystemLog("success", `Workspace Settings: Updated workspace name to '${workspaceName}'`);
        });
    }

    if (settingsPurgeBtn) {
        settingsPurgeBtn.addEventListener("click", () => {
            if (confirm("⚠️ CẢNH BÁO: Hành động này sẽ xóa sạch toàn bộ dữ liệu lịch sử, API keys, coupons tự tạo và cài đặt trên trình duyệt của bạn. Bạn có chắc chắn muốn thực hiện?")) {
                historyService.clearDemoData();
                showToast("Đã xóa sạch toàn bộ dữ liệu Demo. Trang web sẽ tải lại sau 1.5 giây...", "warning");
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        });
    }

    // ----------------------------------------------------------------------
    // 13.5. WORKSPACE INTERACTIVE FEATURES (FILES, CHECKER, CLEANING, RECONCILIATION & REPORTS)
    // ----------------------------------------------------------------------

    function applyLockOverlay(panelId, lockId, showLock, title, desc, actionText, actionFn) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        
        let overlay = document.getElementById(lockId);
        if (showLock) {
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.className = "premium-lock-overlay";
                overlay.id = lockId;
                overlay.innerHTML = `
                    <div class="lock-content">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="2" fill="none" class="lock-icon">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <h3>${title}</h3>
                        <p>${desc}</p>
                        ${actionText ? `<button class="btn btn-primary btn-lg" id="${lockId}-btn">${actionText}</button>` : ""}
                    </div>
                `;
                panel.style.position = "relative";
                panel.insertBefore(overlay, panel.firstChild);
                
                if (actionText && actionFn) {
                    const btn = document.getElementById(`${lockId}-btn`);
                    if (btn) btn.addEventListener("click", actionFn);
                }
            } else {
                const h3 = overlay.querySelector("h3");
                const p = overlay.querySelector("p");
                if (h3) h3.innerText = title;
                if (p) p.innerText = desc;
                overlay.style.display = "flex";
            }
        } else {
            if (overlay) {
                overlay.style.display = "none";
            }
        }
    }

    function checkWorkspaceLocks() {
        const tier = state.currentUser.tier;
        const isFree = (tier === "free");
        const flags = state.featureFlags || {
            enable_autopilot: true,
            enable_table_builder: true,
            enable_document_builder: true,
            enable_data_checker: true,
            enable_reconciliation: true
        };

        // 1. Check Autopilot Feature Flag
        applyLockOverlay(
            "tab-autopilot",
            "autopilot-lock-overlay",
            !flags.enable_autopilot,
            "Tính năng đang tạm khóa",
            "Phân hệ AI Autopilot hiện đang được bảo trì hoặc tạm ngắt bởi Quản trị viên.",
            null,
            null
        );

        // 2. Check Table Builder Feature Flag
        applyLockOverlay(
            "tab-table-builder",
            "table-builder-lock-overlay",
            !flags.enable_table_builder,
            "Tính năng đang tạm khóa",
            "Phân hệ AI Table Builder hiện đang được bảo trì hoặc tạm ngắt bởi Quản trị viên.",
            null,
            null
        );

        // 3. Check Document Builder Feature Flag
        applyLockOverlay(
            "tab-doc-builder",
            "doc-builder-lock-overlay",
            !flags.enable_document_builder,
            "Tính năng đang tạm khóa",
            "Phân hệ AI Document Builder hiện đang được bảo trì hoặc tạm ngắt bởi Quản trị viên.",
            null,
            null
        );

        // 4. Check Data Checker (Feature Flag + Free limitation)
        if (!flags.enable_data_checker) {
            applyLockOverlay(
                "tab-checker",
                "checker-lock-overlay",
                true,
                "Tính năng đang tạm khóa",
                "Phân hệ AI Data Checker hiện đang được bảo trì hoặc tạm ngắt bởi Quản trị viên.",
                null,
                null
            );
        } else {
            applyLockOverlay(
                "tab-checker",
                "checker-lock-overlay",
                isFree,
                "Tính năng dành cho tài khoản Pro trở lên",
                "Nâng cấp tài khoản Pro để sử dụng trợ lý rà soát lỗi dữ liệu tự động, phát hiện ô trống, trùng lặp và định dạng không hợp lệ.",
                "Nâng cấp tài khoản ngay",
                () => switchWorkspaceTab("billing")
            );
        }

        // 5. Check Reconciliation (Feature Flag + Free limitation)
        if (!flags.enable_reconciliation) {
            applyLockOverlay(
                "tab-reconciliation",
                "reconciliation-lock-overlay",
                true,
                "Tính năng đang tạm khóa",
                "Phân hệ đối soát tài chính hiện đang được bảo trì hoặc tạm ngắt bởi Quản trị viên.",
                null,
                null
            );
        } else {
            applyLockOverlay(
                "tab-reconciliation",
                "reconciliation-lock-overlay",
                isFree,
                "Tính năng dành cho tài khoản Pro trở lên",
                "Nâng cấp tài khoản Pro để sử dụng trợ lý so khớp, đối chiếu chênh lệch dữ liệu giữa 2 bảng tính tự động.",
                "Nâng cấp tài khoản ngay",
                () => switchWorkspaceTab("billing")
            );
        }

        const cleaningOverlay = document.getElementById("cleaning-lock-overlay");
        const reportsOverlay = document.getElementById("reports-lock-overlay");
        if (cleaningOverlay) cleaningOverlay.style.display = isFree ? "flex" : "none";
        if (reportsOverlay) reportsOverlay.style.display = isFree ? "flex" : "none";
    }

    function updateFileSelectDropdowns() {
        const selects = [
            checkerFileSelect,
            cleanFileSelect,
            reconcileFileASelect,
            reconcileFileBSelect,
            reportsFileSelect,
            autopilotFileSelect,
            docBuilderFileSelect
        ];
        
        selects.forEach(select => {
            if (!select) return;
            const firstOpt = select.options[0];
            select.innerHTML = "";
            if (firstOpt) select.appendChild(firstOpt);
            
            state.uploadedFiles.forEach(fileObj => {
                const opt = document.createElement("option");
                opt.value = fileObj.name;
                opt.innerText = `${fileObj.name} (${fileObj.rowCount} dòng)`;
                select.appendChild(opt);
            });
        });
    }

    if (filesDropzone && filesInput) {
        filesDropzone.addEventListener("click", () => {
            filesInput.click();
        });
        
        filesDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            filesDropzone.style.borderColor = "var(--color-accent)";
            filesDropzone.style.background = "rgba(6, 182, 212, 0.05)";
        });
        
        filesDropzone.addEventListener("dragleave", () => {
            filesDropzone.style.borderColor = "var(--border-glass)";
            filesDropzone.style.background = "transparent";
        });
        
        filesDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            filesDropzone.style.borderColor = "var(--border-glass)";
            filesDropzone.style.background = "transparent";
            
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => handleWorkspaceFileUpload(file));
        });
        
        filesInput.addEventListener("change", (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => handleWorkspaceFileUpload(file));
            filesInput.value = "";
        });
    }

    async function handleWorkspaceFileUpload(file) {
        const validation = fileService.validateFile(file);
        if (!validation.valid) {
            showToast(validation.error, "error");
            return;
        }
        
        showToast(`Đang tải lên tệp: ${file.name}...`, "info");
        
        try {
            const parsedData = await fileService.parseCSV(file);
            state.uploadedFiles.push(parsedData);
            
            const sizeStr = (file.size / 1024 / 1024).toFixed(2) + " MB";
            adminService.addJob(file.name, state.currentUser.name, sizeStr, "upload", "ready", "0.8s");
            
            showToast(`Tải lên thành công: ${file.name}!`);
            adminService.addSystemLog("success", `Workspace: User uploaded file '${file.name}'`);
            historyService.addOperation("file", `Tải lên file: "${file.name}"`);
            
            renderUploadedFilesTable();
            updateFileSelectDropdowns();
        } catch (err) {
            console.error(err);
            showToast(`Lỗi khi đọc file CSV: ${err}`, "error");
        }
    }

    function renderUploadedFilesTable() {
        if (!filesTableBody) return;
        filesTableBody.innerHTML = "";
        
        if (state.uploadedFiles.length === 0) {
            filesTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted);">Chưa có tệp tin nào được tải lên.</td></tr>`;
            return;
        }
        
        state.uploadedFiles.forEach((fileObj, idx) => {
            const sizeStr = (fileObj.size / 1024).toFixed(1) + " KB";
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:600;">${fileObj.name}</td>
                <td>${sizeStr}</td>
                <td><span class="status-pill status-ready">SẴN SÀNG</span></td>
                <td>${fileObj.rowCount} x ${fileObj.colCount}</td>
                <td>
                    <button class="admin-btn btn-xs" onclick="window.previewWorkspaceFile('${fileObj.name}')">Xem trước</button>
                    <button class="admin-btn admin-btn-ban btn-xs" onclick="window.deleteWorkspaceFile(${idx})">Xóa</button>
                </td>
            `;
            filesTableBody.appendChild(tr);
        });
    }

    window.previewWorkspaceFile = function(fileName) {
        const fileObj = state.uploadedFiles.find(f => f.name === fileName);
        if (!fileObj) return;
        
        filesPreviewPlaceholder.style.display = "none";
        filesPreviewCard.style.display = "block";
        filesPreviewName.innerText = fileObj.name;
        
        let tableHtml = "<thead><tr>";
        fileObj.headers.forEach(h => {
            tableHtml += `<th>${h}</th>`;
        });
        tableHtml += "</tr></thead><tbody>";
        
        const rowsToShow = fileObj.rows.slice(0, 10);
        rowsToShow.forEach(row => {
            tableHtml += "<tr>";
            row.forEach(cell => {
                tableHtml += `<td>${cell}</td>`;
            });
            tableHtml += "</tr>";
        });
        tableHtml += "</tbody>";
        filesPreviewTable.innerHTML = tableHtml;
    };

    window.deleteWorkspaceFile = function(idx) {
        const deletedFile = state.uploadedFiles.splice(idx, 1)[0];
        if (deletedFile) {
            showToast(`Đã xóa tệp: ${deletedFile.name}`, "warning");
            adminService.addSystemLog("warning", `Workspace: User deleted file '${deletedFile.name}'`);
        }
        renderUploadedFilesTable();
        updateFileSelectDropdowns();
        
        filesPreviewCard.style.display = "none";
        filesPreviewPlaceholder.style.display = "flex";
    };

    if (checkerScanBtn) {
        checkerScanBtn.addEventListener("click", () => {
            const fileName = checkerFileSelect.value;
            if (!fileName) {
                showToast("Vui lòng chọn tệp tin cần quét lỗi!", "error");
                return;
            }
            
            const fileObj = state.uploadedFiles.find(f => f.name === fileName);
            if (!fileObj) {
                showToast("Tệp tin không tồn tại trong phiên làm việc!", "error");
                return;
            }
            
            showToast("AI đang rà soát lỗi dữ liệu...", "info");
            checkerScanBtn.disabled = true;
            checkerScanBtn.innerText = "⏳ Đang quét lỗi...";
            
            setTimeout(() => {
                const detailedErrors = fileService.findDetailedErrors(fileObj.headers, fileObj.rows);
                
                checkerScanBtn.disabled = false;
                checkerScanBtn.innerText = "🔍 Bắt đầu quét lỗi AI";
                
                checkerPlaceholder.style.display = "none";
                checkerResultsBox.style.display = "block";
                
                checkerStatRows.innerText = fileObj.rowCount;
                checkerStatErrors.innerText = detailedErrors.length;
                
                const totalCells = fileObj.rowCount * fileObj.colCount;
                const errorCellsCount = detailedErrors.length;
                const healthScore = Math.max(0, Math.round(((totalCells - errorCellsCount) / totalCells) * 100));
                checkerStatHealth.innerText = `${healthScore}%`;
                
                checkerTableBody.innerHTML = "";
                if (detailedErrors.length === 0) {
                    checkerTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-success); font-weight:600;">🎉 Tuyệt vời! Không phát hiện lỗi dữ liệu nào.</td></tr>`;
                } else {
                    detailedErrors.forEach((err, idx) => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
                            <td style="font-weight:600;">Dòng ${err.row}</td>
                            <td>${err.colName}</td>
                            <td class="original-val" style="color:var(--color-danger);">${err.value || "[Rỗng]"}</td>
                            <td><span class="user-tier-badge tier-enterprise" style="font-size:0.7rem;">${err.errorType}</span></td>
                            <td style="font-size:0.8rem; line-height:1.4; text-align:left;">${err.suggestion}</td>
                            <td>
                                <button class="admin-btn btn-xs" onclick="window.applyCheckerRepair(this, '${err.row}', '${err.colName}', '${idx}')">Sửa nhanh</button>
                            </td>
                        `;
                        checkerTableBody.appendChild(tr);
                    });
                }
                
                historyService.addOperation("checker", `Rà soát tệp: "${fileName}" (${detailedErrors.length} lỗi)`);
                adminService.addSystemLog("success", `AI Checker: Scanned file '${fileName}' and found ${detailedErrors.length} errors`);
                showToast("Quét lỗi dữ liệu hoàn tất!", "success");
            }, 1200);
        });
    }

    window.applyCheckerRepair = function(btn, row, col, errorIdx) {
        btn.disabled = true;
        btn.innerText = "Đã sửa";
        btn.style.opacity = 0.5;
        btn.parentElement.parentElement.style.opacity = 0.6;
        showToast(`Đã tự động sửa nhanh lỗi tại Dòng ${row}, Cột [${col}] bằng công nghệ AI!`);
        adminService.addSystemLog("success", `AI Checker: Applied repair for error index ${errorIdx} on Row ${row}`);
    };

    if (cleanFileSelect) {
        cleanFileSelect.addEventListener("change", () => {
            const fileName = cleanFileSelect.value;
            const fileObj = state.uploadedFiles.find(f => f.name === fileName);
            if (fileObj) {
                cleanColumnSelect.disabled = false;
                cleanColumnSelect.innerHTML = "";
                fileObj.headers.forEach(h => {
                    const opt = document.createElement("option");
                    opt.value = h;
                    opt.innerText = h;
                    cleanColumnSelect.appendChild(opt);
                });
            } else {
                cleanColumnSelect.disabled = true;
                cleanColumnSelect.innerHTML = `<option value="">-- Chọn tệp trước --</option>`;
            }
        });
    }

    if (cleanApplyBtn) {
        cleanApplyBtn.addEventListener("click", () => {
            const fileName = cleanFileSelect.value;
            const column = cleanColumnSelect.value;
            const rule = cleanRuleSelect.value;
            
            if (!fileName || !column) {
                showToast("Vui lòng chọn đầy đủ tệp tin và cột xử lý!", "error");
                return;
            }
            
            const fileObj = state.uploadedFiles.find(f => f.name === fileName);
            if (!fileObj) return;
            
            showToast("Đang sinh công thức làm sạch...", "info");
            
            const ruleInstruct = aiService.generateCleaningInstructions(column, rule);
            cleanFormulaCode.innerText = ruleInstruct.formula;
            
            const colIdx = fileObj.headers.indexOf(column);
            cleanPreviewTableBody.innerHTML = "";
            
            const rowsToShow = fileObj.rows.slice(0, 6);
            rowsToShow.forEach((row, idx) => {
                const originalVal = row[colIdx] || "";
                let cleanedVal = originalVal;
                
                if (rule === "trim") {
                    cleanedVal = originalVal.trim().replace(/\s+/g, ' ');
                } else if (rule === "upper") {
                    cleanedVal = originalVal.toUpperCase();
                } else if (rule === "lower") {
                    cleanedVal = originalVal.toLowerCase();
                } else if (rule === "phone") {
                    const cleanPhone = originalVal.replace(/[\s\-\(\)]/g, "");
                    cleanedVal = cleanPhone.startsWith("0") ? cleanPhone : "0" + cleanPhone;
                } else if (rule === "email") {
                    cleanedVal = originalVal.trim().toLowerCase();
                } else if (rule === "name") {
                    cleanedVal = originalVal.trim().split(" ").slice(0, -1).join(" ");
                }
                
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>Dòng ${idx + 2}</td>
                    <td class="original-val">${originalVal || "[Rỗng]"}</td>
                    <td class="cleaned-val">${cleanedVal || "[Rỗng]"}</td>
                `;
                cleanPreviewTableBody.appendChild(tr);
            });
            
            cleanPlaceholder.style.display = "none";
            cleanPreviewContainer.style.display = "block";
            
            adminService.addSystemLog("success", `Data Cleaning: Generated preview for column '${column}' with rule '${rule}'`);
            showToast("Xem trước kết quả làm sạch thành công!");
        });
    }

    if (cleanSaveFileBtn) {
        cleanSaveFileBtn.addEventListener("click", () => {
            showToast("Làm sạch cột dữ liệu thành công! Đang lưu tệp...", "success");
            historyService.addOperation("cleaning", `Làm sạch cột [${cleanColumnSelect.value}] tệp ${cleanFileSelect.value}`);
        });
    }

    if (reconcileFileASelect) {
        reconcileFileASelect.addEventListener("change", () => {
            const fileA = state.uploadedFiles.find(f => f.name === reconcileFileASelect.value);
            if (fileA) {
                reconcileKeyASelect.innerHTML = "";
                reconcileValASelect.innerHTML = "";
                fileA.headers.forEach(h => {
                    const opt1 = document.createElement("option");
                    opt1.value = h; opt1.innerText = h;
                    reconcileKeyASelect.appendChild(opt1);
                    const opt2 = document.createElement("option");
                    opt2.value = h; opt2.innerText = h;
                    reconcileValASelect.appendChild(opt2);
                });
                
                const keyGuess = fileA.headers.find(h => h.toLowerCase().includes("mã") || h.toLowerCase().includes("id") || h.toLowerCase().includes("key"));
                if (keyGuess) reconcileKeyASelect.value = keyGuess;
                const valGuess = fileA.headers.find(h => h.toLowerCase().includes("tiền") || h.toLowerCase().includes("amount") || h.toLowerCase().includes("giá") || h.toLowerCase().includes("doanh thu"));
                if (valGuess) reconcileValASelect.value = valGuess;
            }
        });
    }
    
    if (reconcileFileBSelect) {
        reconcileFileBSelect.addEventListener("change", () => {
            const fileB = state.uploadedFiles.find(f => f.name === reconcileFileBSelect.value);
            if (fileB) {
                reconcileKeyBSelect.innerHTML = "";
                reconcileValBSelect.innerHTML = "";
                fileB.headers.forEach(h => {
                    const opt1 = document.createElement("option");
                    opt1.value = h; opt1.innerText = h;
                    reconcileKeyBSelect.appendChild(opt1);
                    const opt2 = document.createElement("option");
                    opt2.value = h; opt2.innerText = h;
                    reconcileValBSelect.appendChild(opt2);
                });
                
                const keyGuess = fileB.headers.find(h => h.toLowerCase().includes("mã") || h.toLowerCase().includes("id") || h.toLowerCase().includes("key"));
                if (keyGuess) reconcileKeyBSelect.value = keyGuess;
                const valGuess = fileB.headers.find(h => h.toLowerCase().includes("tiền") || h.toLowerCase().includes("amount") || h.toLowerCase().includes("giá") || h.toLowerCase().includes("doanh thu"));
                if (valGuess) reconcileValBSelect.value = valGuess;
            }
        });
    }

    let activeReconcileResults = null;

    if (reconcileRunBtn) {
        reconcileRunBtn.addEventListener("click", () => {
            const fileAName = reconcileFileASelect.value;
            const fileBName = reconcileFileBSelect.value;
            const keyA = reconcileKeyASelect.value;
            const keyB = reconcileKeyBSelect.value;
            const valA = reconcileValASelect.value;
            const valB = reconcileValBSelect.value;
            
            if (!fileAName || !fileBName || !keyA || !keyB || !valA || !valB) {
                showToast("Vui lòng cấu hình đầy đủ File A, File B và các trường khoá chính/giá trị!", "error");
                return;
            }
            
            const fileA = state.uploadedFiles.find(f => f.name === fileAName);
            const fileB = state.uploadedFiles.find(f => f.name === fileBName);
            
            if (!fileA || !fileB) return;
            
            showToast("AI đang thực hiện đối đối soát hai tệp tin...", "info");
            reconcileRunBtn.disabled = true;
            reconcileRunBtn.innerText = "⏳ Đang đối soát...";
            
            setTimeout(() => {
                reconcileRunBtn.disabled = false;
                reconcileRunBtn.innerText = "📊 Chạy đối soát dữ liệu";
                
                const results = fileService.performReconciliation(fileA, fileB, keyA, keyB, valA, valB);
                activeReconcileResults = results;
                
                reconcilePlaceholder.style.display = "none";
                reconcileResultsBox.style.display = "block";
                
                reconcileStatMatched.innerText = results.matchedCount;
                reconcileStatMismatch.innerText = results.mismatchedCount;
                reconcileStatMissingB.innerText = results.missingInBCount;
                reconcileStatMissingA.innerText = results.missingInACount;
                
                renderReconciliationDiffTable("all");
                
                const advice = aiService.generateReconciliationSuggestions(results);
                reconcileAiNarrative.innerHTML = advice;
                
                historyService.addOperation("reconciliation", `Đối soát: ${fileAName} vs ${fileBName} (${results.mismatchedCount} lệch)`);
                adminService.addSystemLog("success", `Data Reconciler: Reconciled '${fileAName}' and '${fileBName}'. Found ${results.mismatchedCount} mismatches`);
                showToast("Đối soát dữ liệu thành công!", "success");
            }, 1500);
        });
    }

    function renderReconciliationDiffTable(filter = "all") {
        if (!activeReconcileResults) return;
        const tbody = document.getElementById("reconcile-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";
        
        let diffRows = [];
        
        if (filter === "all" || filter === "mismatch") {
            activeReconcileResults.mismatched.forEach(m => {
                diffRows.push({
                    key: m.key,
                    valA: `${m.valA.toLocaleString()}đ (Dòng ${m.rowA})`,
                    valB: `${m.valB.toLocaleString()}đ (Dòng ${m.rowB})`,
                    diff: `<span style="color:var(--color-danger); font-weight:600;">${m.difference.toLocaleString()}đ</span>`,
                    desc: m.desc
                });
            });
        }
        
        if (filter === "all" || filter === "missingb") {
            activeReconcileResults.missingInB.forEach(m => {
                diffRows.push({
                    key: m.key,
                    valA: `${m.valA.toLocaleString()}đ (Dòng ${m.rowA})`,
                    valB: `<span style="color:var(--color-warning);">Khuyết ở File B</span>`,
                    diff: `N/A`,
                    desc: m.desc
                });
            });
        }
        
        if (filter === "all" || filter === "missinga") {
            activeReconcileResults.missingInA.forEach(m => {
                diffRows.push({
                    key: m.key,
                    valA: `<span style="color:var(--color-warning);">Khuyết ở File A</span>`,
                    valB: `${m.valB.toLocaleString()}đ (Dòng ${m.rowB})`,
                    diff: `N/A`,
                    desc: m.desc
                });
            });
        }
        
        if (diffRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--color-success); font-weight:600;">✅ Không phát hiện sai lệch nào theo bộ lọc đang chọn.</td></tr>`;
            return;
        }
        
        diffRows.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:600;">${row.key}</td>
                <td>${row.valA}</td>
                <td>${row.valB}</td>
                <td>${row.diff}</td>
                <td style="font-size:0.8rem; color:var(--color-text-muted); text-align:left; line-height:1.4;">${row.desc}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    if (reconcileFilterAll) {
        reconcileFilterAll.addEventListener("click", () => {
            reconcileFilterAll.parentElement.querySelectorAll("button").forEach(b => b.classList.remove("active"));
            reconcileFilterAll.classList.add("active");
            renderReconciliationDiffTable("all");
        });
    }
    if (reconcileFilterMismatch) {
        reconcileFilterMismatch.addEventListener("click", () => {
            reconcileFilterMismatch.parentElement.querySelectorAll("button").forEach(b => b.classList.remove("active"));
            reconcileFilterMismatch.classList.add("active");
            renderReconciliationDiffTable("mismatch");
        });
    }
    if (reconcileFilterMissingB) {
        reconcileFilterMissingB.addEventListener("click", () => {
            reconcileFilterMissingB.parentElement.querySelectorAll("button").forEach(b => b.classList.remove("active"));
            reconcileFilterMissingB.classList.add("active");
            renderReconciliationDiffTable("missingb");
        });
    }
    if (reconcileFilterMissingA) {
        reconcileFilterMissingA.addEventListener("click", () => {
            reconcileFilterMissingA.parentElement.querySelectorAll("button").forEach(b => b.classList.remove("active"));
            reconcileFilterMissingA.classList.add("active");
            renderReconciliationDiffTable("missinga");
        });
    }

    if (reportsFileSelect) {
        reportsFileSelect.addEventListener("change", () => {
            const fileName = reportsFileSelect.value;
            const fileObj = state.uploadedFiles.find(f => f.name === fileName);
            if (!fileObj) return;
            
            showToast(`Đang phân tích tệp: ${fileObj.name}...`, "info");
            
            reportsParsedRowCount.innerText = fileObj.rowCount;
            
            let tableHtml = "<thead><tr>";
            fileObj.headers.forEach(h => {
                tableHtml += `<th>${h}</th>`;
            });
            tableHtml += "</tr></thead><tbody>";
            const previewRows = fileObj.rows.slice(0, 5);
            previewRows.forEach(row => {
                tableHtml += "<tr>";
                row.forEach(cell => {
                    tableHtml += `<td>${cell}</td>`;
                });
                tableHtml += "</tr>";
            });
            tableHtml += "</tbody>";
            reportsParsedDataTable.innerHTML = tableHtml;
            reportsTableCard.style.display = "block";
            
            const stats = fileObj.statistics;
            const numCols = stats.columns.filter(c => c.type === "Số");
            let valColName = numCols.length > 0 ? numCols[0].name : fileObj.headers[0];
            
            let chartLabels = [];
            let chartValues = [];
            const valColIdx = numCols.length > 0 ? fileObj.headers.indexOf(valColName) : 0;
            
            fileObj.rows.forEach((r, i) => {
                chartLabels.push(r[0] || `Dòng ${i+2}`);
                const val = parseFloat(r[valColIdx].replace(/,/g, ''));
                chartValues.push(isNaN(val) ? 1 : val);
            });
            
            let totalSum = chartValues.reduce((a, b) => a + b, 0);
            let avgVal = chartValues.length > 0 ? Math.round(totalSum / chartValues.length) : 0;
            
            reportsInsightStat1.innerText = totalSum.toLocaleString() + (numCols.length > 0 ? "đ" : "");
            reportsInsightStat2.innerText = avgVal.toLocaleString() + (numCols.length > 0 ? "đ" : "");
            reportsInsightStat3.innerText = fileObj.headers[0] || "N/A";
            
            reportsInsightsPlaceholder.style.display = "none";
            reportsInsightsResults.style.display = "block";
            
            if (state.reportsChartInstance) {
                state.reportsChartInstance.destroy();
            }
            
            const reportsCtx = reportsChart.getContext("2d");
            state.reportsChartInstance = new Chart(reportsCtx, {
                type: "bar",
                data: {
                    labels: chartLabels.slice(0, 10),
                    datasets: [{
                        label: valColName,
                        data: chartValues.slice(0, 10),
                        backgroundColor: "rgba(6, 182, 212, 0.4)",
                        borderColor: "#06b6d4",
                        borderWidth: 1.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { ticks: { color: "#9ca3af" }, grid: { color: "rgba(255,255,255,0.05)" } },
                        x: { ticks: { color: "#9ca3af" }, grid: { display: false } }
                    },
                    plugins: {
                        legend: { labels: { color: "#f3f4f6" } }
                    }
                }
            });
            
            const suggestions = aiService.generateDataAnalysisSuggestions(stats);
            const suggestionsText = suggestions.map(s => `• <strong>[${s.type}]</strong> ${s.text}`).join("<br>");
            reportsAiAnalysisNarrative.innerHTML = `<strong>Tóm tắt tự động AI:</strong><br>${suggestionsText}`;
            
            adminService.addSystemLog("success", `Reports: Analyzed workspace file '${fileObj.name}'`);
            showToast("Báo cáo phân tích đã được tạo!");
        });
    }

    if (reportsSalesBtn) {
        reportsSalesBtn.addEventListener("click", () => {
            const sampleSalesFile = {
                name: "doanh_so_ban_hang.csv",
                size: 24500,
                headers: ["Tháng", "Số đơn", "Doanh thu"],
                rows: [
                    ["Tháng 1", "120", "150000000"],
                    ["Tháng 2", "145", "189000000"],
                    ["Tháng 3", "190", "248000000"],
                    ["Tháng 4", "160", "210000000"],
                    ["Tháng 5", "210", "310000000"]
                ]
            };
            sampleSalesFile.statistics = fileService.buildDataStatistics(sampleSalesFile.headers, sampleSalesFile.rows, sampleSalesFile.rows.length);
            
            if (!state.uploadedFiles.some(f => f.name === sampleSalesFile.name)) {
                state.uploadedFiles.push(sampleSalesFile);
                renderUploadedFilesTable();
                updateFileSelectDropdowns();
            }
            
            reportsFileSelect.value = sampleSalesFile.name;
            reportsFileSelect.dispatchEvent(new Event("change"));
        });
    }

    if (reportsHrBtn) {
        reportsHrBtn.addEventListener("click", () => {
            const sampleHrFile = {
                name: "nhan_su_luong.csv",
                size: 18400,
                headers: ["Phòng ban", "Số nhân sự", "Quỹ lương"],
                rows: [
                    ["Kỹ thuật", "12", "180000000"],
                    ["Sales", "8", "96000000"],
                    ["Marketing", "5", "62000000"],
                    ["Nhân sự", "2", "24000000"],
                    ["Kế toán", "2", "28000000"]
                ]
            };
            sampleHrFile.statistics = fileService.buildDataStatistics(sampleHrFile.headers, sampleHrFile.rows, sampleHrFile.rows.length);
            
            if (!state.uploadedFiles.some(f => f.name === sampleHrFile.name)) {
                state.uploadedFiles.push(sampleHrFile);
                renderUploadedFilesTable();
                updateFileSelectDropdowns();
            }
            
            reportsFileSelect.value = sampleHrFile.name;
            reportsFileSelect.dispatchEvent(new Event("change"));
        });
    }

    // ----------------------------------------------------------------------
    // 14. MICROSOFT EXCEL WEB ADD-IN INTEGRATION (OFFICE.JS APIs)
    // ----------------------------------------------------------------------
    let isRunningInExcel = false;

    // Initialize Office.js
    if (typeof Office !== "undefined") {
        Office.onReady((info) => {
            if (info.host === Office.HostType.Excel) {
                isRunningInExcel = true;
                console.log("ExcelAI runs inside Microsoft Excel.");
                
                // Show Excel-specific buttons
                formulaInsertExcelBtn.style.display = "inline-block";
                vbaInsertExcelBtn.style.display = "inline-block";
                sampleActiveSheetBtn.style.display = "inline-block";
                
                // Customize drag-drop label
                document.querySelector(".dropzone p").innerText = "Chạy phân tích bảng tính hiện tại hoặc kéo thả tệp CSV";
                
                adminService.addSystemLog("success", "System: Initialized Office.js connection within Excel");
            }
        });
    }

    // Excel: Insert generated formula into active cell
    formulaInsertExcelBtn.addEventListener("click", async () => {
        const formula = formulaResultCode.innerText.trim();
        if (!formula) return;
        
        try {
            await Excel.run(async (context) => {
                const range = context.workbook.getSelectedRange();
                range.formulas = [[formula]];
                await context.sync();
                showToast("Đã chèn công thức vào Excel thành công!", "success");
                adminService.addSystemLog("success", `Office.js: Inserted formula '${formula}' into sheet`);
            });
        } catch (error) {
            console.error(error);
            showToast("Không thể chèn công thức vào Excel. Vui lòng chọn một ô tính.", "error");
        }
    });

    // Excel: Insert generated VBA code into documentation sheet
    vbaInsertExcelBtn.addEventListener("click", async () => {
        const vbaCode = vbaCodeDisplay.innerText.trim();
        if (!vbaCode || vbaCode.startsWith("' Vui lòng nhập")) return;
        
        try {
            await Excel.run(async (context) => {
                let sheets = context.workbook.worksheets;
                sheets.load("items/name");
                await context.sync();
                
                let targetSheet;
                const sheetName = "ExcelAI_VBA_Code";
                
                // Find if sheet exists
                for (let i = 0; i < sheets.items.length; i++) {
                    if (sheets.items[i].name === sheetName) {
                        targetSheet = sheets.items[i];
                        break;
                    }
                }
                
                if (!targetSheet) {
                    targetSheet = sheets.add(sheetName);
                }
                
                const range = targetSheet.getRange("A1");
                range.values = [[vbaCode]];
                range.format.autofitColumns();
                targetSheet.activate();
                
                await context.sync();
                showToast("Đã chèn mã VBA vào trang tính 'ExcelAI_VBA_Code'!", "success");
                adminService.addSystemLog("success", "Office.js: Exported VBA Macro to worksheet 'ExcelAI_VBA_Code'");
            });
        } catch (error) {
            console.error(error);
            showToast("Lỗi khi ghi dữ liệu. Đảm bảo Excel của bạn đã được lưu.", "error");
        }
    });

    // Excel: Read active selected sheet range, draw chart and analyze
    if (sampleActiveSheetBtn) {
        sampleActiveSheetBtn.addEventListener("click", async () => {
            showToast("Đang đọc dữ liệu từ bảng tính hoạt động...", "info");
            
            try {
                await Excel.run(async (context) => {
                    const range = context.workbook.getSelectedRange();
                    range.load("values, rowCount, columnCount");
                    await context.sync();
                    
                    if (range.rowCount < 2 || range.columnCount < 1) {
                        showToast("Vui lòng bôi đen (chọn) vùng dữ liệu có tiêu đề và ít nhất 1 dòng dữ liệu.", "error");
                        return;
                    }
                    
                    const values = range.values;
                    const headers = values[0];
                    const rows = values.slice(1);
                    
                    // Populate mini table preview
                    const cleanRows = rows.map(r => r.map(cell => cell !== null && cell !== undefined ? cell.toString() : ""));
                    renderTable(headers.map(h => h ? h.toString() : "Cột"), cleanRows);
                    
                    // Calculate numbers
                    let total = 0;
                    let numericColIndex = -1;
                    
                    // Look for first column containing numbers
                    for (let col = 0; col < headers.length; col++) {
                        let hasNumbers = false;
                        for (let row = 0; row < rows.length; row++) {
                            let val = parseFloat(rows[row][col]);
                            if (!isNaN(val)) {
                                hasNumbers = true;
                                break;
                            }
                        }
                        if (hasNumbers) {
                            numericColIndex = col;
                            break;
                        }
                    }
                    
                    let stat1 = "N/A";
                    let stat2 = "N/A";
                    let stat3 = headers[0] ? headers[0].toString() : "Tiêu đề";
                    
                    let chartLabels = [];
                    let chartValues = [];
                    
                    if (numericColIndex !== -1) {
                        let sum = 0;
                        let count = 0;
                        for (let r = 0; r < rows.length; r++) {
                            let num = parseFloat(rows[r][numericColIndex]);
                            if (!isNaN(num)) {
                                sum += num;
                                count++;
                                chartLabels.push(rows[r][0] ? rows[r][0].toString() : `Dòng ${r+1}`);
                                chartValues.push(num);
                            }
                        }
                        total = sum;
                        stat1 = total.toLocaleString();
                        stat2 = (count > 0 ? Math.round(total / count) : 0).toLocaleString();
                        stat3 = `${headers[numericColIndex]} (${headers[0] || "Tiêu đề"})`;
                    } else {
                        stat1 = `${rows.length} Dòng`;
                        stat2 = `${headers.length} Cột`;
                        stat3 = "Dạng văn bản";
                        
                        chartLabels = rows.map((r, i) => r[0] ? r[0].toString() : `Dòng ${i+1}`);
                        chartValues = rows.map((r, i) => i + 1);
                    }
                    
                    if (insightStat1) {
                        insightStat1.innerText = stat1;
                    }
                    if (insightStat2) {
                        insightStat2.innerText = stat2;
                    }
                    if (insightStat3) {
                        insightStat3.innerText = stat3;
                    }
                    
                    if (insightsPlaceholder) {
                        insightsPlaceholder.style.display = "none";
                    }
                    if (insightsResults) {
                        insightsResults.style.display = "flex";
                    }
                    
                    // Render Chart
                    const chartData = {
                        labels: chartLabels.slice(0, 10),
                        datasets: [
                            { label: headers[numericColIndex] || "Số lượng", data: chartValues.slice(0, 10), backgroundColor: "rgba(16, 124, 65, 0.5)", borderColor: "#107c41", borderWidth: 1 }
                        ]
                    };
                    renderChart("bar", chartData);
                    
                    if (aiAnalysisNarrative) {
                        aiAnalysisNarrative.innerText = `Đọc thành công dữ liệu Excel gồm ${rows.length} dòng. Chỉ số thống kê tổng cộng: ${stat1}, giá trị trung bình là ${stat2}. Trợ lý AI phát hiện phân tích xu hướng ổn định, phù hợp làm báo cáo quý.`;
                    }
                    
                    adminService.addSystemLog("success", `Office.js: Read range and analyzed ${rows.length} rows directly from Excel worksheet`);
                    historyService.addOperation("file", "Đọc trực tiếp từ bảng tính Excel");
                    showToast("Đã đọc dữ liệu và vẽ đồ thị thành công!", "success");
                });
            } catch (error) {
                console.error(error);
                showToast("Lỗi kết nối Office.js. Hãy đảm bảo Add-in được mở từ trong Microsoft Excel.", "error");
            }
        });
    }

    // ----------------------------------------------------------------------
    // AI AUTOPILOT LOGIC
    // ----------------------------------------------------------------------
    if (autopilotRunBtn) {
        autopilotRunBtn.addEventListener("click", () => {
            const goal = autopilotGoalInput.value.trim();
            if (!goal) {
                showToast("Vui lòng nhập mô tả mục tiêu hành động!", "error");
                return;
            }

            const selectedOutputs = [];
            document.querySelectorAll('input[name="autopilot-output"]:checked').forEach(cb => {
                selectedOutputs.push(cb.value);
            });

            const selectedFile = autopilotFileSelect.value;
            const files = selectedFile ? [selectedFile] : [];

            autopilotRunBtn.disabled = true;
            autopilotRunBtn.innerText = "⏳ Đang lập kế hoạch AI...";
            autopilotPlanBox.style.display = "none";

            setTimeout(() => {
                const plan = autopilotService.generatePlan(goal, selectedOutputs, files);
                state.currentAutopilotPlan = plan;

                autopilotRunBtn.disabled = false;
                autopilotRunBtn.innerText = "Lập Kế Hoạch AI";

                autopilotPlanUnderstanding.innerText = plan.understanding;
                autopilotPlanInputs.innerText = plan.requiredInputs.join(", ");
                autopilotPlanOutputs.innerText = plan.expectedOutputs.join(", ");

                // Render steps
                autopilotStepsContainer.innerHTML = plan.steps.map(step => `
                    <div class="autopilot-step-card ${step.status}">
                        <div class="step-num">${step.num}</div>
                        <div class="step-details" style="text-align: left;">
                            <strong style="display: block; font-size: 0.85rem; color: #fff;">${step.title}</strong>
                            <p style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.2rem;">${step.desc}</p>
                        </div>
                        <div class="step-status" style="font-size: 0.75rem; font-weight: 600; color: ${step.status === 'completed' ? 'var(--color-success)' : 'var(--color-warning)'};">
                            ${step.status === 'completed' ? '✓ Hoàn thành' : '⏳ Chờ duyệt'}
                        </div>
                    </div>
                `).join("");

                autopilotPlanBox.style.display = "block";
                
                // Track operation
                historyService.addOperation("autopilot", `Lập kế hoạch Autopilot: "${goal}"`);
                adminService.addSystemLog("success", `AI Autopilot: Generated plan for goal '${goal}'`);
                showToast("Đã thiết lập kế hoạch tự động hóa thành công!", "success");
            }, 800);
        });
    }

    if (autopilotGenerateBtn) {
        autopilotGenerateBtn.addEventListener("click", () => {
            const plan = state.currentAutopilotPlan;
            if (!plan) {
                showToast("Vui lòng chạy 'Lập Kế Hoạch AI' trước!", "error");
                return;
            }

            autopilotGenerateBtn.disabled = true;
            autopilotGenerateBtn.innerText = "⏳ Đang tạo bản nháp Autopilot...";

            setTimeout(() => {
                autopilotGenerateBtn.disabled = false;
                autopilotGenerateBtn.innerText = "Tạo Bản Nháp Autopilot";

                autopilotPreviewPlaceholder.style.display = "none";
                autopilotPreviewResults.style.display = "flex";

                // Render content preview
                if (plan.previewType === "excel") {
                    let tableHtml = `
                        <table class="admin-table" style="font-size:0.75rem; width:100%;">
                            <thead>
                                <tr>${plan.previewData.headers.map(h => `<th>${h}</th>`).join("")}</tr>
                            </thead>
                            <tbody>
                                ${plan.previewData.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}
                            </tbody>
                        </table>
                    `;
                    autopilotPreviewContentBox.innerHTML = tableHtml;
                } else if (plan.previewType === "document") {
                    autopilotPreviewContentBox.innerHTML = `
                        <div style="font-family:'Times New Roman', serif; color:#fff; line-height:1.6; white-space:pre-wrap; text-align:left;">
                            <h4 style="text-align:center; font-weight:bold; margin-bottom:1rem; color:#fff; font-size:1rem;">${plan.previewData.title}</h4>
                            <p>${plan.previewData.content}</p>
                        </div>
                    `;
                }

                // Warnings/Notes box
                autopilotWarningsList.innerHTML = `
                    <li>Đây là bản nháp tự động hóa được sinh bằng công nghệ AI Planner.</li>
                    <li>Vui lòng kiểm tra lại tính chính xác trước khi xuất bản hoặc nạp vào Excel.</li>
                    <li>Đã tự động tối ưu hóa công thức chèn cho các bảng tính tương quan.</li>
                `;
                autopilotWarningsBox.style.display = "block";

                // Account limits/usage update
                state.currentUser.usageCount++;
                billingService.updateUserUsage(state.currentUser.id, state.currentUser.usageCount);
                updateWorkspaceSidebarUI();

                historyService.addOperation("autopilot", `Hoàn tất thiết lập Autopilot bản nháp`);
                adminService.addSystemLog("success", `AI Autopilot: Finished drafting outputs for plan.`);
                showToast("Đã sinh bản nháp Autopilot thành công!", "success");
            }, 1000);
        });
    }

    if (autopilotCopyBtn) {
        autopilotCopyBtn.addEventListener("click", () => {
            const plan = state.currentAutopilotPlan;
            if (!plan) return;
            let textToCopy = "";
            if (plan.previewType === "excel") {
                textToCopy = [
                    plan.previewData.headers.join("\t"),
                    ...plan.previewData.rows.map(r => r.join("\t"))
                ].join("\n");
            } else {
                textToCopy = `${plan.previewData.title}\n\n${plan.previewData.content}`;
            }
            navigator.clipboard.writeText(textToCopy);
            showToast("Đã sao chép nội dung bản nháp vào bộ nhớ tạm!", "success");
        });
    }

    if (autopilotExportBtn) {
        autopilotExportBtn.addEventListener("click", () => {
            const plan = state.currentAutopilotPlan;
            if (!plan) return;
            let textContent = "";
            let fileName = "";
            if (plan.previewType === "excel") {
                textContent = [
                    plan.previewData.headers.join(","),
                    ...plan.previewData.rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(","))
                ].join("\n");
                fileName = "Autopilot_Draft_Excel.csv";
            } else {
                textContent = `${plan.previewData.title}\n\n${plan.previewData.content}`;
                fileName = "Autopilot_Draft_Report.txt";
            }
            downloadFile(textContent, fileName);
            showToast(`Đã xuất tệp nháp thành công (${fileName})!`);
        });
    }

    // ----------------------------------------------------------------------
    // AI TABLE BUILDER LOGIC
    // ----------------------------------------------------------------------
    if (tableBuilderRunBtn) {
        tableBuilderRunBtn.addEventListener("click", () => {
            const desc = tableBuilderDesc.value.trim();
            if (!desc) {
                showToast("Vui lòng nhập mô tả bảng tính cần tạo!", "error");
                return;
            }

            const type = tableBuilderType.value;
            const includeFormula = tableBuilderFormula.checked;
            const includeSample = tableBuilderSample.checked;

            tableBuilderRunBtn.disabled = true;
            tableBuilderRunBtn.innerText = "⏳ AI đang dựng cấu trúc bảng...";

            setTimeout(() => {
                const result = tableBuilderService.generateTable(desc, type, includeFormula, includeSample);
                state.currentTableBuilderResult = result;

                tableBuilderRunBtn.disabled = false;
                tableBuilderRunBtn.innerText = "Tạo Bảng Bằng AI";

                tableBuilderPlaceholder.style.display = "none";
                tableBuilderResults.style.display = "flex";
                tableBuilderSpecBox.style.display = "block";

                // Update title
                tableBuilderPreviewTitle.innerText = `🖥️ Grid Preview: ${result.tableName}`;

                // Populate column specs list
                tableBuilderColsList.innerHTML = result.columns.map(col => `
                    <li><strong>${col.name}</strong> - <span style="color:var(--color-accent);">${col.type}</span> (Mẫu: ${col.sample})</li>
                `).join("");

                // Render mini Excel grid table
                const headers = result.columns.map(col => col.name);
                if (includeSample && result.rows.length > 0) {
                    tableBuilderPreviewGrid.innerHTML = `
                        <thead>
                            <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
                        </thead>
                        <tbody>
                            ${result.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}
                        </tbody>
                    `;
                } else {
                    tableBuilderPreviewGrid.innerHTML = `
                        <thead>
                            <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
                        </thead>
                        <tbody>
                            <tr><td colspan="${headers.length}" style="text-align:center; color:var(--color-text-muted); padding: 2rem;">Bảng được tạo trống (Hãy thêm số liệu thực tế)</td></tr>
                        </tbody>
                    `;
                }

                // Render proposed formula box
                const formulaBox = document.querySelector(".formula-explain-box");
                if (includeFormula && result.formulas.length > 0) {
                    tableBuilderFormulaList.innerHTML = result.formulas.map(f => `
                        <li style="margin-bottom: 0.5rem; text-align: left;">
                            <strong style="color:#fff;">${f.col}:</strong> <code style="background:rgba(0,0,0,0.3); padding:0.2rem 0.4rem; border-radius:4px; font-family:monospace; color:var(--color-success);">${f.expr}</code>
                            <br><span style="font-size:0.7rem; color:var(--color-text-muted);">${f.desc}</span>
                        </li>
                    `).join("");
                    if (formulaBox) formulaBox.style.display = "block";
                } else {
                    if (formulaBox) formulaBox.style.display = "none";
                }

                // Update notes
                tableBuilderNotes.innerText = result.notes;

                // Account limits/usage update
                state.currentUser.usageCount++;
                billingService.updateUserUsage(state.currentUser.id, state.currentUser.usageCount);
                updateWorkspaceSidebarUI();

                historyService.addOperation("table", `Dựng bảng AI: "${result.tableName}"`);
                adminService.addSystemLog("success", `AI Table Builder: Created table '${result.tableName}'`);
                showToast("Đã dựng bảng tính AI thành công!", "success");
            }, 800);
        });
    }

    if (tableBuilderCopyBtn) {
        tableBuilderCopyBtn.addEventListener("click", () => {
            const result = state.currentTableBuilderResult;
            if (!result) return;
            const headers = result.columns.map(c => c.name);
            const textToCopy = [
                headers.join("\t"),
                ...result.rows.map(r => r.join("\t"))
            ].join("\n");
            navigator.clipboard.writeText(textToCopy);
            showToast("Đã sao chép dữ liệu dạng bảng (Tab-separated) để dán trực tiếp vào Excel!", "success");
        });
    }

    if (tableBuilderExportBtn) {
        tableBuilderExportBtn.addEventListener("click", () => {
            const result = state.currentTableBuilderResult;
            if (!result) return;
            const headers = result.columns.map(c => c.name);
            const textContent = [
                headers.join(","),
                ...result.rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(","))
            ].join("\n");
            const fileName = `${result.tableName.replace(/\s+/g, "_")}.csv`;
            downloadFile(textContent, fileName);
            showToast(`Đã xuất tệp Excel mẫu thành công (${fileName})!`);
        });
    }

    // ----------------------------------------------------------------------
    // AI DOCUMENT BUILDER LOGIC
    // ----------------------------------------------------------------------
    if (docBuilderRunBtn) {
        docBuilderRunBtn.addEventListener("click", () => {
            const type = docBuilderType.value;
            const facts = docBuilderFacts.value.trim();
            const tone = docBuilderTone.value;

            const selectedFileName = docBuilderFileSelect.value;
            const fileObj = selectedFileName ? state.uploadedFiles.find(f => f.name === selectedFileName) : null;

            docBuilderRunBtn.disabled = true;
            docBuilderRunBtn.innerText = "⏳ AI đang biên soạn văn bản...";

            setTimeout(() => {
                const result = documentBuilderService.generateDocument(type, facts, fileObj, tone);
                state.currentDocumentBuilderResult = result;

                docBuilderRunBtn.disabled = false;
                docBuilderRunBtn.innerText = "Tạo Văn Bản Bằng AI";

                docBuilderPlaceholder.style.display = "none";
                docBuilderResults.style.display = "flex";

                // Populate content text
                docBuilderPreviewText.innerText = `${result.title}\n\n${result.content}`;

                // Populate facts used and warnings/checks list
                let factsHtml = `
                    <strong>Nguồn dữ liệu tham khảo:</strong>
                    <ul style="margin-top:0.25rem; padding-left:1.2rem; margin-bottom: 0.5rem; text-align: left;">
                        ${result.factsUsed.map(f => `<li>${f}</li>`).join("")}
                    </ul>
                `;
                if (result.checks && result.checks.length > 0) {
                    factsHtml += `
                        <strong style="color:var(--color-warning); text-align: left; display: block; margin-top:0.5rem;">⚠️ Cần đối soát rà soát:</strong>
                        <ul style="margin-top:0.25rem; padding-left:1.2rem; color:var(--color-warning); text-align: left;">
                            ${result.checks.map(c => `<li>${c}</li>`).join("")}
                        </ul>
                    `;
                }
                docBuilderFactsUsed.innerHTML = factsHtml;

                // Account limits/usage update
                state.currentUser.usageCount++;
                billingService.updateUserUsage(state.currentUser.id, state.currentUser.usageCount);
                updateWorkspaceSidebarUI();

                historyService.addOperation("document", `Biên soạn văn bản AI: "${result.title}"`);
                adminService.addSystemLog("success", `AI Document Builder: Drafted document '${result.title}'`);
                showToast("Đã soạn thảo văn bản hành chính thành công!", "success");
            }, 900);
        });
    }

    if (docBuilderCopyBtn) {
        docBuilderCopyBtn.addEventListener("click", () => {
            const result = state.currentDocumentBuilderResult;
            if (!result) return;
            const textToCopy = `${result.title}\n\n${result.content}`;
            navigator.clipboard.writeText(textToCopy);
            showToast("Đã sao chép văn bản vào bộ nhớ tạm thành công!", "success");
        });
    }

    if (docBuilderExportBtn) {
        docBuilderExportBtn.addEventListener("click", () => {
            const result = state.currentDocumentBuilderResult;
            if (!result) return;
            const textContent = `${result.title}\n\n${result.content}`;
            const fileName = `${result.title.replace(/\s+/g, "_")}.docx`;
            downloadFile(textContent, fileName);
            showToast(`Đã xuất văn bản thành công (${fileName})!`);
        });
    }

    // Dynamic file download helper
    function downloadFile(content, fileName, mimeType = "text/plain") {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ----------------------------------------------------------------------
    // 15. INITIALIZE APP STATE
    // ----------------------------------------------------------------------
    renderThreadsList();
    renderAPIKeysTable();
    renderAdminCoupons();
    startLiveMetrics();
    syncPricingUI();
    checkAPIKeysLock();
    
    showView("landing");
    updateWorkspaceSidebarUI();
});
