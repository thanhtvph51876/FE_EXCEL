/* ==========================================================================
   EXCELAI BOT - SPREADSHEET TEMPLATES SERVICE (WITH LOCAL FALLBACK)
   ========================================================================== */

import { API_BASE, apiFetch } from "./config.js";

const cache = {
    templates: []
};

const fallbackTemplates = [
    {
        id: "revenue_report",
        name: "Báo cáo doanh thu",
        category: "Kế toán / Tài chính",
        icon: "📈",
        image: "assets/images/templates/revenue_report.png",
        description: "Theo dõi doanh thu bán hàng, lợi nhuận gộp và biểu đồ xu hướng theo từng tháng."
    },
    {
        id: "employee_payroll",
        name: "Bảng lương nhân viên",
        category: "Nhân sự / Lương",
        icon: "👥",
        image: "assets/images/templates/employee_payroll.png",
        description: "Tính toán lương thực nhận, bảo hiểm xã hội, thuế thu nhập cá nhân tự động."
    },
    {
        id: "inventory_management",
        name: "Quản lý tồn kho",
        category: "Quản lý kho",
        icon: "📦",
        image: "assets/images/templates/inventory_management.png",
        description: "Giám sát số lượng nhập, xuất, tồn kho và cảnh báo mức tồn tối thiểu."
    },
    {
        id: "project_plan",
        name: "Kế hoạch dự án",
        category: "Quản lý dự án",
        icon: "📅",
        image: "assets/images/templates/project_plan.png",
        description: "Quản lý tiến độ công việc, sơ đồ Gantt và người chịu trách nhiệm."
    },
    {
        id: "expense_report",
        name: "Báo cáo chi phí",
        category: "Kế toán / Tài chính",
        icon: "💰",
        image: "assets/images/templates/expense_report.png",
        description: "Phân loại chi phí vận hành, chi phí sản xuất và phân tích tỷ trọng."
    },
    {
        id: "crm_customer",
        name: "CRM Khách hàng",
        category: "Bán hàng / CRM",
        icon: "🤝",
        image: "assets/images/templates/crm_customer.png",
        description: "Quản lý thông tin liên hệ khách hàng, trạng thái chăm sóc và doanh số dự kiến."
    }
];

export const templateService = {
    async listTemplates() {
        try {
            const payload = await apiFetch("/api/templates");
            cache.templates = Array.isArray(payload.templates) ? payload.templates : [];
            if (cache.templates.length === 0) {
                cache.templates = fallbackTemplates;
            }
            return cache.templates;
        } catch (err) {
            console.warn("Backend API not reachable. Using static template fallbacks.", err);
            cache.templates = fallbackTemplates;
            return cache.templates;
        }
    },

    loadTemplates() {
        return cache.templates.length > 0 ? cache.templates : fallbackTemplates;
    },

    async useTemplate(templateId) {
        try {
            const payload = await apiFetch(`/api/templates/${encodeURIComponent(templateId)}`);
            return {
                template: payload.template,
                sheet: null,
                downloadUrl: `${API_BASE}/api/templates/${encodeURIComponent(templateId)}/download`
            };
        } catch (err) {
            console.warn("Backend API not reachable. Mocking useTemplate for ID:", templateId);
            const found = this.loadTemplates().find(t => t.id === templateId);
            return {
                template: found || { id: templateId, name: "Mẫu biểu" },
                sheet: null,
                downloadUrl: "#"
            };
        }
    }
};

export default templateService;
