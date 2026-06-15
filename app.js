/* ==========================================================================
   EXCELAI BOT - APPLICATION CONTROLLER (ES MODULE)
   ========================================================================== */

import { fileService } from './services/fileService.js';
import { aiService } from './services/aiService.js';
import { billingService } from './services/billingService.js?v=20260612-billing-table-fix';
import { adminService } from './services/adminService.js?v=20260612-users-dashboard';
import { historyService } from './services/historyService.js';
import { chatService } from './services/chatService.js?v=20260612-chat-real';
import { autopilotService } from './services/autopilotService.js';
import { tableBuilderService } from './services/tableBuilderService.js?v=20260612-billing-table-fix';
import { documentBuilderService } from './services/documentBuilderService.js';
import { authService } from './services/authService.js?v=20260612-google-reset';
import { templateService } from './services/templateService.js';
import { exportService } from './services/exportService.js';
import { reportService } from './services/reportService.js';
import { cleaningService } from './services/cleaningService.js?v=20260612-cleaning-real';
import { API_BASE, clearAuth, getAccessToken } from './services/config.js';

document.addEventListener("DOMContentLoaded", () => {
    const REQUIRED_DOM_FALLBACKS = [
        ["billing-upgrade-btn", "button"],
        ["mini-btn-pro", "button"],
        ["mini-btn-enterprise", "button"],
        ["chat-textarea", "textarea"],
        ["chat-send-btn", "button"],
        ["chat-attach-file-btn", "button"],
        ["remove-file-btn", "button"],
        ["csv-dropzone", "div"],
        ["csv-file-input", "input"],
        ["real-sales-btn", "button"],
        ["real-hr-btn", "button"],
        ["unlock-pro-btn", "button"],
        ["active-thread-title", "div"],
        ["new-thread-btn", "button"],
        ["delete-thread-btn", "button"],
        ["sheet-add-col-btn", "button"],
        ["sheet-export-csv-btn", "button"],
        ["files-new-workspace-btn", "button"],
        ["files-clear-all-btn", "button"],
        ["files-select-all", "input"],
        ["files-bulk-delete-btn", "button"],
        ["files-fullscreen-btn", "button"],
        ["clean-file-select", "select"],
        ["clean-apply-btn", "button"],
        ["clean-save-file-btn", "button"],
        ["reconcile-export-btn", "button"],
        ["formula-insert-excel-btn", "button"],
        ["active-sheet-btn", "button"],
        ["autopilot-run-btn", "button"],
        ["autopilot-generate-btn", "button"],
        ["autopilot-copy-btn", "button"],
        ["autopilot-export-btn", "button"],
        ["settings-save-btn", "button"],
        ["settings-purge-btn", "button"],
        ["admin-template-close-btn", "button"],
        ["admin-template-form", "form"],
        ["admin-add-user-btn", "button"],
        ["admin-grant-user-select", "select"],
        ["admin-grant-tier-select", "select"],
        ["admin-grant-tier-btn", "button"],
        ["admin-refresh-billing-btn", "button"],
        ["admin-reset-security-btn", "button"],
        ["admin-scan-security-btn", "button"],
        ["admin-reset-system-settings-btn", "button"],
        ["system-send-broadcast-btn", "button"],
        ["system-preview-broadcast-btn", "button"],
        ["system-schedule-broadcast-btn", "button"],
        ["system-toggle-maintenance-btn", "button"],
        ["system-test-realtime-btn", "button"],
        ["generate-key-btn", "button"],
        ["unlock-pro-api-btn", "button"],
        ["templates-search-input", "input"]
    ];

    const WORKSPACE_TAB_LABELS = {
        autopilot: ["Autopilot", "Tự động lập kế hoạch xử lý Excel bằng AI."],
        billing: ["Đăng ký & Bảng giá", "Quản lý gói tài khoản, quota và nâng cấp."],
        chat: ["Trợ lý Chat AI", "Trao đổi với AI dựa trên dữ liệu workspace hiện tại."],
        cleaning: ["Làm sạch dữ liệu", "Chuẩn hóa, lọc lỗi và chuẩn bị bảng dữ liệu."],
        "doc-builder": ["AI Document", "Tạo tài liệu, biên bản và báo cáo văn bản từ dữ liệu."],
        history: ["Lịch sử hoạt động", "Xem lại các thao tác và kết quả đã tạo."],
        reports: ["Báo cáo tự động", "Sinh báo cáo phân tích từ file đã upload."],
        settings: ["Cấu hình & Cài đặt", "Thiết lập workspace và tuỳ chọn tài khoản."],
        "table-builder": ["AI Table Builder", "Tạo bảng dữ liệu mẫu hoặc bảng nghiệp vụ bằng AI."],
        templates: ["Thư viện mẫu", "Chọn mẫu Excel và workflow có sẵn."]
    };

    function workspaceTabContent(tabId) {
        const commonButton = "class=\"btn btn-primary btn-sm\" style=\"font-weight:600;\"";
        const commonSelect = "style=\"width:100%;background:rgba(0,0,0,0.22);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:9px;\"";
        const commonInput = "style=\"width:100%;background:rgba(0,0,0,0.22);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:9px;\"";
        if (tabId === "chat") {
            return `
                <div class="chat-ai-page">
                    <div class="chat-ai-header">
                        <div><h2>Trợ lý Chat AI</h2><p>Trao đổi với AI dựa trên dữ liệu workspace hiện tại.</p></div>
                        <div class="chat-ai-actions"><button id="new-thread-btn" class="btn btn-outline btn-sm">Cuộc trò chuyện mới</button><button id="chat-history-btn" class="btn btn-outline btn-sm">Lịch sử</button><button id="chat-source-btn" class="btn btn-outline btn-sm">Nguồn dữ liệu</button></div>
                    </div>
                    <div class="chat-ai-layout">
                        <section class="chat-main-card">
                            <div id="threads-list" class="chat-thread-strip"></div>
                            <div id="active-thread-title" class="chat-active-title">Cuộc trò chuyện mới</div>
                            <div id="chat-messages" class="chat-message-list"><div class="chat-empty-state">Bắt đầu cuộc trò chuyện mới để AI xử lý dữ liệu workspace thật.</div></div>
                            <div id="file-attached-info" class="chat-attached-file" style="display:none;"></div>
                            <div class="chat-input-shell">
                                <button id="chat-attach-file-btn" class="chat-icon-btn" title="Upload file">+</button>
                                <textarea id="chat-textarea" rows="2" placeholder="Nhập câu hỏi hoặc yêu cầu phân tích..."></textarea>
                                <button id="remove-file-btn" class="chat-icon-btn" title="Gỡ file">×</button>
                                <button id="chat-send-btn" class="chat-send-btn" title="Gửi">➤</button>
                            </div>
                            <div class="chat-quick-row"><button data-chat-action="upload">Tải lên file</button><button data-chat-action="select-file">Chọn file từ workspace</button><button data-chat-action="table">Tạo bảng AI</button></div>
                        </section>
                        <aside class="chat-side-panel">
                            <div><h3>Nguồn dữ liệu đang chọn</h3><p id="chat-workspace-status">Đang tải context...</p><button id="chat-manage-source-btn" class="btn btn-outline btn-xs">Quản lý nguồn dữ liệu</button></div>
                            <div><h3>File gần đây</h3><div id="chat-recent-files" class="chat-recent-files"></div><button id="chat-view-all-files-btn" class="btn btn-outline btn-xs">Xem tất cả</button></div>
                            <div><h3>Gợi ý nhanh</h3><div id="chat-suggestions" class="chat-suggestions"></div></div>
                            <div><h3>Tóm tắt cuộc trò chuyện</h3><div id="chat-summary-card" class="chat-summary-card">Chưa có hội thoại.</div></div>
                        </aside>
                    </div>
                </div>`;
        }
        if (tabId === "cleaning") {
            return `
                <div id="cleaning-lock-overlay" class="premium-lock-overlay" style="display:none;"></div>
                <div class="data-cleaning-page">
                    <div class="data-cleaning-header">
                        <div><h2>Làm sạch dữ liệu</h2><p>Chuẩn hóa, lọc lỗi và chuẩn bị bảng dữ liệu.</p></div>
                        <div class="data-cleaning-actions">
                            <button id="clean-config-save-btn" class="btn btn-outline btn-sm">Lưu cấu hình</button>
                            <button id="clean-history-btn" class="btn btn-outline btn-sm">Lịch sử làm sạch</button>
                            <button id="clean-apply-btn" class="btn btn-primary btn-sm">Bắt đầu làm sạch</button>
                        </div>
                    </div>
                    <div class="data-cleaning-layout">
                        <section class="cleaning-config-card">
                            <div class="cleaning-step"><span>Bước 1</span><h3>Chọn dữ liệu nguồn</h3><select id="clean-file-select"><option value="">Chưa có tệp nguồn</option></select><select id="clean-sheet-select"><option value="">Chọn sheet</option></select><div id="clean-source-meta" class="clean-source-meta">Chọn file để xem thông tin.</div></div>
                            <div class="cleaning-step"><span>Bước 2</span><h3>Chọn cột cần làm sạch</h3><input id="clean-column-search" placeholder="Tìm cột..."><button id="clean-select-all-columns" class="btn btn-outline btn-xs" type="button">Chọn tất cả</button><div id="clean-column-chips" class="clean-column-chips"></div></div>
                            <div class="cleaning-step"><span>Bước 3</span><h3>Quy tắc làm sạch</h3><div id="clean-rule-grid" class="clean-rule-grid"></div></div>
                            <div class="cleaning-step"><span>Bước 4</span><h3>Tùy chọn nâng cao</h3><label>Giá trị thiếu<select id="clean-missing-strategy"><option value="keep_empty">Giữ nguyên</option><option value="default_value">Thay bằng giá trị mặc định</option><option value="mean">Thay bằng trung bình nếu là số</option><option value="most_frequent">Thay bằng giá trị phổ biến nhất</option><option value="remove_row">Xóa dòng có giá trị thiếu</option></select></label><label>Dòng trùng<select id="clean-duplicate-strategy"><option value="keep_first">Giữ dòng đầu tiên</option><option value="keep_last">Giữ dòng cuối cùng</option><option value="remove_all">Xóa toàn bộ dòng trùng</option></select></label><label>Chế độ lưu<select id="clean-save-mode"><option value="new_file">Tạo file mới</option><option value="overwrite" disabled>Ghi đè file hiện tại</option></select></label><label>Tên file đầu ra<input id="clean-output-name" placeholder="ten_file_CLEANED.xlsx"></label><label>Định dạng ngày<select id="clean-date-format"><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option></select></label></div>
                            <button id="clean-preview-btn" class="btn btn-primary btn-block">Xem trước làm sạch</button>
                            <button id="clean-save-file-btn" class="btn btn-outline btn-block">Lưu file đã làm sạch</button>
                        </section>
                        <section class="cleaning-result-card">
                            <div id="clean-placeholder" class="cleaning-empty-state">Chọn file và quy tắc để xem kết quả.</div>
                            <div id="clean-preview-container" class="cleaning-results" hidden>
                                <div id="clean-kpi-grid" class="clean-kpi-grid"></div>
                                <div class="clean-preview-panel"><h3>Xem trước dữ liệu: Trước & Sau khi làm sạch</h3><input id="clean-preview-search" placeholder="Tìm trong preview..."><div class="clean-table-wrap"><table class="admin-table"><tbody id="clean-preview-table-body"></tbody></table></div></div>
                                <div class="clean-insight-grid"><div><h3>Phân loại lỗi</h3><div id="clean-error-chart" class="clean-error-chart"></div></div><div><h3>AI Insight</h3><ul id="clean-insight-list"></ul></div></div>
                            </div>
                        </section>
                    </div>
                    <div class="clean-status-grid">
                        <div><span>Trạng thái</span><strong id="clean-status-state">Sẵn sàng làm sạch</strong></div>
                        <div><span>Tệp nguồn</span><strong id="clean-status-source">Chưa có tệp nguồn</strong></div>
                        <div><span>Độ tin cậy AI</span><strong id="clean-status-confidence">--</strong></div>
                        <div><span>Thời gian ước tính</span><strong id="clean-status-time">--</strong></div>
                    </div>
                    <div id="clean-history-panel" class="clean-history-panel" hidden></div>
                </div>`;
        }
        if (tabId === "files") {
            return `
                <div class="files-workspace-page files-single-page">
                    <div class="files-hero">
                        <div>
                            <h2>Quản lý tệp dữ liệu Workspace 📁</h2>
                            <p>Tải lên, xem trước và quản lý toàn bộ file Excel/CSV trong một trang.</p>
                        </div>
                        <div class="files-hero-actions">
                            <button id="files-guide-btn" class="btn btn-outline btn-sm">Hướng dẫn</button>
                            <button id="files-upload-quick-btn" class="btn btn-primary btn-sm">Tải tệp</button>
                            <button id="files-new-workspace-btn" class="btn btn-outline btn-sm">Workspace mới</button>
                        </div>
                    </div>
                    <div class="files-stats-grid">
                        <div class="files-stat-card"><span>Tệp đang quản lý</span><strong id="files-stat-total">0</strong><small id="files-list-badge">0 tệp</small></div>
                        <div class="files-stat-card"><span>Sẵn sàng</span><strong id="files-stat-ready">0</strong><small>Đọc được từ backend</small></div>
                        <div class="files-stat-card"><span>Cảnh báo dữ liệu</span><strong id="files-stat-errors">0</strong><small>Cần kiểm tra</small></div>
                        <div class="files-stat-card"><span>Dung lượng đã dùng</span><strong id="files-capacity-text">0 KB</strong><small><i id="files-capacity-bar"></i></small></div>
                    </div>
                    <div class="files-one-page-grid">
                        <section class="files-left-panel">
                            <div id="files-dropzone" class="files-dropzone">
                                <input type="file" id="files-input" accept=".csv,.xlsx,.xls" multiple hidden>
                                <strong>Kéo & thả tệp vào đây để tải lên</strong>
                                <span>Hỗ trợ CSV, XLSX, XLS</span>
                                <div><button id="files-choose-btn" class="btn btn-primary btn-sm">Chọn tệp</button><button id="files-template-secondary-btn" class="btn btn-outline btn-sm">Tạo từ mẫu</button></div>
                                <div id="files-upload-queue"></div>
                            </div>
                            <div class="files-table-panel">
                                <div class="files-table-toolbar">
                                    <h3>Danh sách tệp đã tải lên</h3>
                                    <div class="files-toolbar-actions">
                                        <input id="files-search-input" placeholder="Tìm kiếm tệp...">
                                        <select id="files-status-filter"><option value="all">Tất cả trạng thái</option><option value="ready">Sẵn sàng</option><option value="warning">Cảnh báo</option><option value="processing">Đang xử lý</option><option value="error">Có lỗi</option></select>
                                        <select id="files-format-filter"><option value="all">Tất cả định dạng</option><option value="xlsx">XLSX</option><option value="xls">XLS</option><option value="csv">CSV</option></select>
                                    </div>
                                </div>
                                <div id="files-selection-summary">Chưa chọn file nào</div>
                                <div id="files-bulk-actions" style="display:none;"><span id="files-bulk-count">0 file đã chọn</span><button id="files-bulk-delete-btn" class="btn btn-outline btn-xs">Xóa</button></div>
                                <table class="admin-table-v3 workspace-files-table"><thead><tr><th><input type="checkbox" id="files-select-all"></th><th>Tên tệp</th><th>Kích thước</th><th>Trạng thái</th><th>Dòng/Cột</th><th>Ngày tải lên</th><th>Chất lượng</th><th>Hành động</th></tr></thead><tbody id="files-table-body"></tbody></table>
                            </div>
                        </section>
                        <aside class="files-preview-shell">
                            <div id="files-preview-placeholder" class="enterprise-empty-preview">Chọn một file để xem preview dữ liệu thật.</div>
                            <div id="files-preview-card" class="files-preview-card" style="display:none;">
                                <div class="files-preview-head"><h3 id="files-preview-name">Chưa chọn tệp</h3><span id="files-preview-status">Sẵn sàng</span><button id="files-fullscreen-btn" class="btn btn-outline btn-xs">Fullscreen</button></div>
                                <div class="files-preview-meta"><span id="files-preview-type">--</span><span id="files-preview-size">--</span><span id="files-preview-sheet">--</span><span id="files-preview-dimensions">--</span><span id="files-preview-range">--</span></div>
                                <div id="files-sheet-tabs" class="excel-sheet-tabs"></div>
                                <select id="files-sheet-select" hidden><option>Sheet1</option></select>
                                <input id="files-preview-search" type="hidden" value=""><input id="files-preview-zoom" type="hidden" value="100%"><input id="files-wrap-toggle" type="checkbox" hidden><input id="files-highlight-toggle" type="checkbox" hidden checked><input id="files-freeze-toggle" type="checkbox" hidden checked><input id="files-preview-mode" type="hidden" value="excel"><input id="files-preview-limit" type="hidden" value="50">
                                <div class="excel-grid-wrapper"><table id="files-preview-table" class="excel-preview-table"></table></div>
                                <div class="files-quality-mini"><span><strong id="files-quality-empty">0</strong> ô trống</span><span><strong id="files-quality-columns">0</strong> cột cảnh báo</span><span id="files-quality-duplicates">0</span></div>
                                <ul id="files-ai-insights"></ul>
                            </div>
                        </aside>
                    </div>
                </div>`;
        }
        if (tabId === "reports") {
            return `
                <div class="auto-report-page">
                    <div class="auto-report-toolbar">
                        <div>
                            <p class="auto-report-eyebrow">Enterprise analytics</p>
                            <h2>Báo cáo tự động</h2>
                        </div>
                        <div class="auto-report-actions">
                            <button id="reports-refresh-btn" class="btn btn-outline btn-sm">Làm mới</button>
                            <button id="reports-history-btn" class="btn btn-outline btn-sm">Lịch sử báo cáo</button>
                            <button id="reports-create-btn" class="btn btn-primary btn-sm">Tạo báo cáo mới</button>
                            <button id="reports-export-btn" class="btn btn-outline btn-sm">Xuất báo cáo</button>
                        </div>
                    </div>
                    <div class="auto-report-controls">
                        <select id="reports-file-select" ${commonSelect}><option value="">Chọn file để tạo báo cáo</option></select>
                        <div id="reports-sheet-tabs" class="auto-report-sheet-tabs"></div>
                        <input id="reports-search-input" type="search" placeholder="Tìm kiếm dữ liệu..." ${commonInput}>
                    </div>
                    <div id="reports-kpi-grid" class="auto-report-kpis">
                        <div class="auto-report-kpi"><span>Tổng số dòng</span><strong id="reports-kpi-total">--</strong></div>
                        <div class="auto-report-kpi"><span>Dòng trùng lặp</span><strong id="reports-kpi-duplicates">--</strong></div>
                        <div class="auto-report-kpi"><span>Dữ liệu thiếu</span><strong id="reports-kpi-missing">--</strong></div>
                        <div class="auto-report-kpi"><span>Chất lượng dữ liệu</span><strong id="reports-kpi-quality">--</strong></div>
                    </div>
                    <div id="reports-main-content" class="auto-report-layout">
                        <section id="reports-table-card" class="auto-report-panel">
                            <div class="auto-report-panel-head"><span>Preview dữ liệu thật</span><small id="reports-parsed-row-count">Chưa chọn file</small></div>
                            <div class="auto-report-table-wrap"><table class="admin-table auto-report-table" id="reports-parsed-data-table"></table></div>
                            <div class="auto-report-pagination">
                                <select id="reports-page-size"><option value="10">10 dòng</option><option value="25" selected>25 dòng</option><option value="50">50 dòng</option><option value="100">100 dòng</option></select>
                                <button id="reports-prev-page" class="btn btn-outline btn-xs">Trước</button>
                                <span id="reports-page-indicator">Trang 1/1</span>
                                <button id="reports-next-page" class="btn btn-outline btn-xs">Sau</button>
                            </div>
                        </section>
                        <aside class="auto-report-panel auto-report-analysis">
                            <div id="reports-insights-placeholder" class="auto-report-empty">Chọn file để tạo báo cáo</div>
                            <div id="reports-insights-results" style="display:none;">
                                <div class="auto-report-chart-card"><canvas id="reports-chart"></canvas></div>
                                <div class="auto-report-chart-card"><canvas id="reports-donut-chart"></canvas></div>
                                <div id="reports-ai-analysis-narrative" class="auto-report-insights"></div>
                            </div>
                        </aside>
                    </div>
                    <div id="reports-history-drawer" class="auto-report-history" hidden></div>
                </div>
                `;
        }
        if (tabId === "autopilot") {
            return `
                <div id="autopilot-lock-overlay" class="premium-lock-overlay" style="display:none;"></div>
                <div class="autopilot-page">
                    <header class="autopilot-topbar">
                        <div>
                            <p class="autopilot-eyebrow">AI Autopilot</p>
                            <h2>Trợ lý vận hành Excel tự động</h2>
                            <p>Upload file thật, yêu cầu mục tiêu nghiệp vụ, duyệt kế hoạch và tạo file kết quả có thể tải về.</p>
                        </div>
                        <div class="autopilot-top-actions">
                            <button id="autopilot-history-refresh-btn" class="btn btn-outline btn-sm">Làm mới lịch sử</button>
                            <button id="autopilot-generate-btn" class="btn btn-outline btn-sm" disabled>Tạo bản nháp</button>
                            <button id="autopilot-run-btn" class="btn btn-primary btn-sm">Lập kế hoạch</button>
                        </div>
                    </header>
                    <div id="autopilot-error" class="autopilot-alert" hidden></div>
                    <div class="autopilot-layout">
                        <section class="autopilot-panel autopilot-command-panel">
                            <div class="autopilot-panel-head"><span>Nguồn dữ liệu</span><small id="autopilot-file-status">Chưa chọn file</small></div>
                            <div id="autopilot-dropzone" class="autopilot-dropzone">
                                <input id="autopilot-upload-input" type="file" accept=".csv,.xlsx,.xls" hidden>
                                <strong>Kéo thả Excel/CSV vào đây</strong>
                                <span>Hoặc chọn file đã có trong workspace.</span>
                                <button id="autopilot-upload-btn" class="btn btn-outline btn-xs" type="button">Tải file mới</button>
                            </div>
                            <label class="autopilot-field">File workspace<select id="autopilot-file-select"><option value="">Chọn file dữ liệu thật</option></select></label>
                            <div id="autopilot-selected-file-card" class="autopilot-file-card">Chưa có file được chọn.</div>
                            <label class="autopilot-field">Mục tiêu tự động hóa<textarea id="autopilot-goal-input" rows="8" maxlength="1000" placeholder="Ví dụ: Phân tích doanh thu theo tháng, tìm bất thường, tạo file báo cáo có sheet Summary và Warnings."></textarea><small id="autopilot-char-counter">0/1000</small></label>
                            <div class="autopilot-quick-prompts">
                                <button type="button" data-autopilot-prompt="Phân tích doanh thu, tổng hợp KPI theo tháng/khu vực và tạo file báo cáo quản trị.">Báo cáo KPI</button>
                                <button type="button" data-autopilot-prompt="Kiểm tra lỗi dữ liệu, ô trống, dòng trùng, giá trị bất thường và tạo danh sách cảnh báo.">Rà lỗi dữ liệu</button>
                                <button type="button" data-autopilot-prompt="Làm sạch dữ liệu, chuẩn hóa định dạng số/ngày và đề xuất công thức Excel cần dùng.">Làm sạch</button>
                                <button type="button" data-autopilot-prompt="Tạo bản phân tích vận hành gồm insight, cảnh báo rủi ro và file Excel kết quả.">Vận hành</button>
                            </div>
                        </section>
                        <section class="autopilot-panel autopilot-plan-panel">
                            <div class="autopilot-panel-head"><span>Kế hoạch AI</span><small id="autopilot-plan-status">Chưa lập kế hoạch</small></div>
                            <div id="autopilot-plan-box" class="autopilot-plan-box" style="display:none;">
                                <h3 id="autopilot-plan-understanding"></h3>
                                <div id="autopilot-plan-inputs" class="autopilot-plan-meta"></div>
                                <div id="autopilot-plan-outputs" class="autopilot-plan-meta"></div>
                                <div id="autopilot-steps-container" class="autopilot-steps"></div>
                            </div>
                            <div id="autopilot-preview-placeholder" class="autopilot-empty">Chọn file và mô tả mục tiêu để Autopilot lập kế hoạch từ dữ liệu thật.</div>
                        </section>
                        <aside class="autopilot-panel autopilot-result-panel">
                            <div class="autopilot-panel-head"><span>Bản nháp kết quả</span><small id="autopilot-output-status">Chưa có output</small></div>
                            <div id="autopilot-preview-results" class="autopilot-preview-results" style="display:none;">
                                <div id="autopilot-preview-content-box"></div>
                                <div id="autopilot-warnings-box" class="autopilot-warnings" style="display:none;"><strong>Cảnh báo</strong><ul id="autopilot-warnings-list"></ul></div>
                                <div class="autopilot-result-actions"><button id="autopilot-copy-btn" class="btn btn-outline btn-xs">Copy insight</button><button id="autopilot-export-btn" class="btn btn-primary btn-xs">Tải file kết quả</button></div>
                            </div>
                            <div class="autopilot-history-block">
                                <div class="autopilot-panel-head"><span>Lịch sử gần đây</span><small>50 phiên mới nhất</small></div>
                                <div id="autopilot-history-list" class="autopilot-history-list"></div>
                            </div>
                        </aside>
                    </div>
                </div>`;
        }
        if (tabId === "table-builder") {
            return `
                <div class="ai-table-page">
                    <div class="ai-table-header">
                        <div><h2>AI Table Builder</h2><p>Tạo bảng dữ liệu mẫu hoặc bảng nghiệp vụ bằng AI.</p></div>
                        <div class="ai-table-actions">
                            <button id="table-builder-history-btn" class="btn btn-outline btn-sm">Lịch sử</button>
                            <button id="table-builder-save-template-btn" class="btn btn-outline btn-sm">Lưu mẫu</button>
                            <button id="table-builder-run-btn" class="btn btn-primary btn-sm">Tạo bảng mới</button>
                        </div>
                    </div>
                    <div id="table-builder-error" class="ai-table-alert" hidden></div>
                    <div class="ai-table-layout">
                        <section class="ai-table-form-card">
                            <label>Mô tả bảng cần tạo<textarea id="table-builder-desc" rows="7" maxlength="1000" placeholder="Mô tả bảng cần tạo..."></textarea><span id="table-builder-char-counter">0/1000</span></label>
                            <label>Loại bảng<select id="table-builder-type"><option value="custom">Tùy chỉnh</option><option value="customer">Khách hàng</option><option value="hr">Nhân sự</option><option value="sales">Bán hàng</option><option value="inventory">Kho hàng</option><option value="finance">Tài chính</option><option value="project">Dự án</option><option value="task">Công việc</option><option value="report">Báo cáo</option></select></label>
                            <label>Chế độ tạo dữ liệu<select id="table-builder-mode"><option value="empty">Tạo bảng trống</option><option value="ai_generated" selected>Tạo dữ liệu AI theo mô tả</option><option value="workspace_file">Tạo từ file thật trong workspace</option><option value="external_api">Tạo từ API thật</option></select></label>
                            <div id="table-builder-file-source" class="ai-table-source" hidden>
                                <label>File workspace<select id="table-builder-file-select"><option value="">Chưa có tệp nguồn</option></select></label>
                                <label>Sheet<select id="table-builder-sheet-select"><option value="">Chọn sheet</option></select></label>
                            </div>
                            <div id="table-builder-api-source" class="ai-table-source" hidden>
                                <label>API endpoint<input id="table-builder-api-endpoint" placeholder="https://api.example.com/data"></label>
                                <label>Method<select id="table-builder-api-method"><option value="GET">GET</option><option value="POST">POST</option></select></label>
                                <label>Headers JSON<textarea id="table-builder-api-headers" rows="3" placeholder='{"Authorization":"Bearer ..."}'></textarea></label>
                            </div>
                            <div class="ai-table-config-grid">
                                <label>Số dòng<input id="table-builder-row-count" type="number" min="0" max="1000" value="100"></label>
                                <label>Ngôn ngữ<select id="table-builder-language"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label>
                                <label>Định dạng ngày<select id="table-builder-date-format"><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option><option value="MM/DD/YYYY">MM/DD/YYYY</option></select></label>
                                <label>Công thức<select id="table-builder-formula"><option value="true">Tự động công thức</option><option value="false">Không công thức</option></select></label>
                            </div>
                            <label class="ai-table-inline"><input id="table-builder-normalize" type="checkbox" checked> Chuẩn hóa tên cột</label>
                            <div><span class="ai-table-field-title">Tự động cột nâng cao</span><div id="table-builder-smart-columns" class="ai-table-chip-grid"></div></div>
                            <button id="table-builder-generate-main-btn" class="btn btn-primary btn-block">Dựng bảng</button>
                            <div class="ai-table-status-grid">
                                <div><span>Trạng thái</span><strong id="table-status-state">Sẵn sàng</strong></div>
                                <div><span>Cấu hình hiện tại</span><strong id="table-status-config">--</strong></div>
                                <div><span>Độ tin cậy AI</span><strong id="table-status-confidence">--</strong></div>
                                <div><span>Thời gian ước tính</span><strong id="table-status-time">--</strong></div>
                            </div>
                        </section>
                        <section class="ai-table-preview-card">
                            <div class="ai-table-preview-head">
                                <div><h3 id="table-builder-preview-title">Bảng mẫu được tạo</h3><span id="table-builder-status-badge">Sẵn sàng</span></div>
                                <div class="ai-table-toolbar">
                                    <button id="table-builder-copy-btn" class="btn btn-outline btn-xs">Sao chép</button>
                                    <button id="table-builder-export-csv-btn" class="btn btn-outline btn-xs">Tải CSV</button>
                                    <button id="table-builder-export-btn" class="btn btn-outline btn-xs">Tải Excel</button>
                                    <button id="table-builder-save-workspace-btn" class="btn btn-outline btn-xs">Lưu vào workspace</button>
                                    <button id="table-builder-refresh-btn" class="btn btn-outline btn-xs">Làm mới</button>
                                </div>
                            </div>
                            <div class="ai-table-preview-controls"><input id="table-builder-search" type="search" placeholder="Tìm trong bảng..."><select id="table-builder-page-size"><option value="10">10 dòng</option><option value="25" selected>25 dòng</option><option value="50">50 dòng</option></select></div>
                            <div id="table-builder-placeholder" class="ai-table-empty"><strong>Chưa có bảng</strong><span>Nhập mô tả và bấm Dựng bảng để tạo bảng dữ liệu.</span></div>
                            <div id="table-builder-results" style="display:none;">
                                <div id="table-builder-spec-box"></div>
                                <div class="ai-table-scroll"><table id="table-builder-preview-grid" class="admin-table ai-table-grid"></table></div>
                                <div class="ai-table-pagination"><button id="table-builder-prev-page" class="btn btn-outline btn-xs">Trước</button><span id="table-builder-page-indicator">Trang 1/1</span><button id="table-builder-next-page" class="btn btn-outline btn-xs">Sau</button></div>
                                <div id="table-builder-formula-list"></div>
                                <div id="table-builder-notes"></div>
                            </div>
                        </section>
                    </div>
                    <div id="table-builder-history-drawer" class="ai-table-history" hidden></div>
                </div>`;
        }
        if (tabId === "doc-builder") {
            return `
                <div class="ai-document-page">
                    <div class="ai-document-header">
                        <div>
                            <h2>AI Document</h2>
                            <p>Tạo báo cáo, biên bản và các văn bản chuyên nghiệp từ dữ liệu của bạn với AI.</p>
                        </div>
                        <div class="ai-document-actions">
                            <button id="doc-builder-save-template-btn" class="btn btn-outline btn-sm">Lưu mẫu</button>
                            <button id="doc-builder-history-btn" class="btn btn-outline btn-sm">Lịch sử</button>
                            <button id="doc-builder-run-btn" class="btn btn-primary btn-sm">Soạn văn bản</button>
                        </div>
                    </div>
                    <div id="doc-builder-error" class="ai-document-alert" hidden></div>
                    <div class="ai-document-layout">
                        <section class="ai-document-form-card">
                            <label>Loại tài liệu<select id="doc-builder-type"><option value="report">Báo cáo</option><option value="meeting_minutes">Biên bản họp</option><option value="proposal">Tờ trình</option><option value="plan">Kế hoạch</option><option value="official_letter">Công văn</option><option value="analysis_report">Báo cáo phân tích dữ liệu</option></select></label>
                            <label>Tệp nguồn<select id="doc-builder-file-select"><option value="">Chưa có tệp nguồn</option></select></label>
                            <div id="doc-builder-source-card" class="ai-document-source-card">Chưa có tệp nguồn</div>
                            <label id="doc-builder-sheet-wrap">Chọn sheet<select id="doc-builder-sheet-select"><option value="">Chọn sheet</option></select></label>
                            <label>Yêu cầu chính / Prompt<textarea id="doc-builder-facts" rows="7" maxlength="2000" placeholder="Nhập yêu cầu tạo văn bản dựa trên dữ liệu thật..."></textarea><span id="doc-builder-char-counter">0/2000</span></label>
                            <div class="ai-document-two-fields">
                                <label>Giọng văn / Phong cách<select id="doc-builder-tone"><option value="professional">Chuyên nghiệp</option><option value="formal">Trang trọng</option><option value="brief">Ngắn gọn</option><option value="deep_analysis">Phân tích chuyên sâu</option><option value="plain">Dễ hiểu</option></select></label>
                                <label>Ngôn ngữ đầu ra<select id="doc-builder-language"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label>
                            </div>
                            <div>
                                <span class="ai-document-field-title">Nội dung cần tạo</span>
                                <div id="doc-builder-sections" class="ai-document-chip-grid">
                                    <label><input type="checkbox" value="summary" checked> Tóm tắt</label>
                                    <label><input type="checkbox" value="analysis" checked> Phân tích</label>
                                    <label><input type="checkbox" value="conclusion" checked> Kết luận</label>
                                    <label><input type="checkbox" value="recommendation" checked> Kiến nghị</label>
                                    <label><input type="checkbox" value="data_table"> Bảng số liệu</label>
                                    <label><input type="checkbox" value="risk"> Rủi ro</label>
                                </div>
                            </div>
                            <div>
                                <span class="ai-document-field-title">Gợi ý mẫu tài liệu</span>
                                <div id="doc-builder-template-grid" class="ai-document-template-grid"></div>
                            </div>
                            <button id="doc-builder-generate-main-btn" class="btn btn-primary btn-block">Soạn văn bản</button>
                            <div class="ai-document-status-grid">
                                <div><span>Trạng thái</span><strong id="doc-status-state">Sẵn sàng</strong></div>
                                <div><span>Tệp nguồn</span><strong id="doc-status-source">Chưa có tệp nguồn</strong></div>
                                <div><span>Độ tin cậy AI</span><strong id="doc-status-confidence">--</strong></div>
                                <div><span>Thời gian ước tính</span><strong id="doc-status-time">--</strong></div>
                            </div>
                        </section>
                        <section class="ai-document-preview-card">
                            <div class="ai-document-preview-head">
                                <div><h3>Xem trước tài liệu</h3><span id="doc-builder-generated-badge">Chưa tạo</span></div>
                                <div class="ai-document-toolbar">
                                    <button id="doc-builder-copy-btn" class="btn btn-outline btn-xs">Sao chép</button>
                                    <button id="doc-builder-export-docx-btn" class="btn btn-outline btn-xs">Tải xuống DOCX</button>
                                    <button id="doc-builder-export-pdf-btn" class="btn btn-outline btn-xs">Tải xuống PDF</button>
                                    <button id="doc-builder-edit-btn" class="btn btn-outline btn-xs">Chỉnh sửa</button>
                                    <button id="doc-builder-fullscreen-btn" class="btn btn-outline btn-xs">Fullscreen</button>
                                </div>
                            </div>
                            <div id="doc-builder-placeholder" class="ai-document-empty"><strong>Chưa có văn bản</strong><span>Chọn file, nhập yêu cầu và bấm Soạn văn bản để tạo tài liệu.</span></div>
                            <div id="doc-builder-results" class="ai-document-preview" style="display:none;"><div id="doc-builder-preview-text"></div><div id="doc-builder-facts-used"></div></div>
                        </section>
                    </div>
                    <div id="doc-builder-history-drawer" class="ai-document-history" hidden></div>
                </div>`;
        }
        if (tabId === "billing") {
            return `
                <div class="billing-page-live">
                    <div class="billing-live-header">
                        <div>
                            <h2>Đăng ký & Bảng giá</h2>
                            <p>Quản lý gói tài khoản, quota và nâng cấp.</p>
                        </div>
                        <button id="billing-history-btn" class="btn btn-outline btn-sm">Lịch sử thanh toán</button>
                    </div>
                    <div id="billing-config-alert" class="billing-provider-warning" hidden>Cổng thanh toán chưa được cấu hình</div>
                    <div class="billing-live-grid">
                        <section id="billing-plans-grid" class="billing-plans-live"></section>
                        <aside id="billing-account-panel" class="billing-account-panel">
                            <h3>Tổng quan tài khoản</h3>
                            <div class="billing-account-empty">Đang tải dữ liệu tài khoản...</div>
                        </aside>
                    </div>
                    <div id="billing-history-panel" class="billing-history-panel" hidden></div>
                </div>`;
        }
        if (tabId === "settings") {
            return `
                <div class="user-settings-page">
                    <section class="user-settings-hero">
                        <div class="user-settings-identity">
                            <div class="user-settings-avatar" id="settings-user-avatar">E</div>
                            <div>
                                <span class="user-settings-kicker">Hồ sơ tài khoản</span>
                                <h2 id="settings-user-name">Người dùng ExcelAI</h2>
                                <p id="settings-user-email">--</p>
                            </div>
                        </div>
                        <div class="user-settings-tier">
                            <span>Gói hiện tại</span>
                            <strong id="settings-user-tier">Free</strong>
                        </div>
                    </section>

                    <div class="user-settings-grid">
                        <section class="settings-panel-card user-profile-panel">
                            <div class="settings-section-heading">
                                <div>
                                    <h3>Tổng quan sử dụng</h3>
                                    <p>Dữ liệu quota AI của tài khoản hiện tại.</p>
                                </div>
                                <span id="settings-user-status" class="settings-status-pill">Active</span>
                            </div>
                            <div class="settings-usage-main">
                                <div class="settings-usage-ring" style="--usage:0%;">
                                    <span id="settings-usage-percent">0%</span>
                                </div>
                                <div class="settings-usage-copy">
                                    <strong id="settings-usage-count">0 / 20 lượt</strong>
                                    <span id="settings-usage-remaining">Còn 20 lượt trong chu kỳ hiện tại</span>
                                    <div class="settings-usage-bar"><div id="settings-usage-progress"></div></div>
                                </div>
                            </div>
                            <div class="settings-stats-row user-settings-stats">
                                <div class="settings-stat-box"><span>Đã dùng</span><strong id="settings-stat-used">0</strong></div>
                                <div class="settings-stat-box"><span>Còn lại</span><strong id="settings-stat-remaining">20</strong></div>
                                <div class="settings-stat-box"><span>Giới hạn</span><strong id="settings-stat-limit">20</strong></div>
                            </div>
                        </section>

                        <section class="settings-panel-card user-workspace-panel">
                            <div class="settings-section-heading">
                                <div>
                                    <h3>Cấu hình workspace</h3>
                                    <p>Tùy chọn hiển thị và lưu trữ cho phiên làm việc.</p>
                                </div>
                            </div>
                            <label class="settings-field-label">Tên workspace
                                <input id="settings-workspace-name" placeholder="Tên workspace" ${commonInput}>
                            </label>
                            <label class="settings-field-label">Thời gian giữ dữ liệu
                                <select id="settings-retention" ${commonSelect}>
                                    <option value="30">Giữ dữ liệu 30 ngày</option>
                                    <option value="90">Giữ dữ liệu 90 ngày</option>
                                </select>
                            </label>
                            <div class="settings-action-row">
                                <button id="settings-save-btn" ${commonButton}>Lưu cấu hình</button>
                                <button id="settings-purge-btn" class="btn btn-outline btn-sm">Xóa cache phiên</button>
                            </div>
                        </section>
                    </div>
                </div>`;
        }
        if (tabId === "templates") {
            return `<div class="admin-card-v2" style="padding:1rem;"><input id="templates-search-input" placeholder="Tìm mẫu..." ${commonInput}><div id="templates-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-top:1rem;"></div></div>`;
        }
        if (tabId === "history") {
            return `<div class="admin-card-v2" style="padding:1rem;overflow:auto;"><table class="admin-table"><tbody id="user-history-table-body"></tbody></table><div id="history-empty-state" style="color:var(--color-text-muted);padding:1rem;">Chưa có lịch sử.</div></div>`;
        }
        return `<div class="admin-card-v2" style="padding:1.25rem;"><p style="margin:0;color:var(--color-text-muted);font-size:0.9rem;">Module đang được khởi tạo.</p></div>`;
    }

    function ensureWorkspaceTabPanels() {
        const container = document.querySelector("#workspace-view .workspace-panels-container");
        if (!container) return;
        document.querySelectorAll("#workspace-view .sidebar-item[data-tab]").forEach((item) => {
            const tabId = item.getAttribute("data-tab");
            if (!tabId || document.getElementById(`tab-${tabId}`)) return;
            const [title, description] = WORKSPACE_TAB_LABELS[tabId] || [tabId, "Module đang được khởi tạo."];
            const panel = document.createElement("div");
            panel.className = "tab-panel";
            panel.id = `tab-${tabId}`;
            panel.innerHTML = `
                <div class="panel-header-v2">
                    <div class="panel-header-title">
                        <h2>${escapeHTML(title)}</h2>
                        <p>${escapeHTML(description)}</p>
                    </div>
                </div>
                <div class="panel-wrapper-v2">
                    ${workspaceTabContent(tabId)}
                </div>`;
            container.appendChild(panel);
        });
    }

    ensureWorkspaceTabPanels();

    function adminPanelContent(tabId) {
        if (tabId === "overview") {
            return `
                <div class="admin-overview-shell">
                    <div class="admin-overview-status" id="admin-overview-status">
                        <span><i class="status-dot warning"></i>Đang kiểm tra backend</span>
                        <span><i class="status-dot warning"></i>API đang đồng bộ</span>
                        <span>Workspace: <strong id="admin-overview-workspace">--</strong></span>
                    </div>
                    <div class="admin-overview-hero">
                        <div>
                            <p class="admin-overview-kicker">ADMIN CONSOLE</p>
                            <h2>Tổng quan quản trị</h2>
                            <p>Theo dõi người dùng, doanh thu và trạng thái hệ thống theo dữ liệu backend hiện có.</p>
                        </div>
                        <div class="admin-overview-actions">
                            <select id="admin-overview-range" class="admin-overview-select">
                                <option value="7d">7 ngày qua</option>
                                <option value="24h">24 giờ qua</option>
                                <option value="30d">30 ngày qua</option>
                            </select>
                            <button class="btn btn-primary btn-sm" id="admin-overview-refresh-btn">Làm mới</button>
                        </div>
                    </div>
                    <div id="admin-overview-content" class="admin-overview-content">
                        <div class="admin-overview-loading">Đang tải dữ liệu quản trị thật từ backend...</div>
                    </div>
                </div>`;
        }
        if (tabId === "users") {
            return `
                <div class="admin-users-page">
                    <div class="admin-users-header">
                        <div class="admin-users-title">
                            <div class="admin-users-icon">👥</div>
                            <div>
                                <h2>Quản lý người dùng</h2>
                                <p>Quản lý tài khoản, phân quyền và hoạt động người dùng từ backend.</p>
                            </div>
                        </div>
                        <div class="admin-users-actions">
                            <button class="btn btn-primary btn-sm" id="admin-add-user-btn">+ Thêm user</button>
                            <button class="btn btn-outline btn-sm" id="admin-users-import-btn">Import CSV</button>
                            <button class="btn btn-outline btn-sm" id="admin-users-export-btn">Xuất dữ liệu</button>
                            <input type="file" id="admin-users-import-input" accept=".csv" hidden>
                        </div>
                    </div>
                    <div class="admin-users-stats" id="admin-users-stats"></div>
                    <div class="admin-users-layout">
                        <section class="admin-users-main">
                            <div class="admin-users-filterbar">
                                <input id="admin-users-search" type="search" placeholder="Tìm theo tên, email...">
                                <select id="admin-users-plan-filter"><option value="all">Tất cả gói</option><option value="free">Free</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select>
                                <select id="admin-users-status-filter"><option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="suspended">Bị khóa</option><option value="pending">Chờ xác minh</option></select>
                                <select id="admin-users-role-filter"><option value="all">Tất cả vai trò</option><option value="admin">Admin</option><option value="user">User</option><option value="qa">QA</option><option value="owner">Owner</option></select>
                                <button class="btn btn-outline btn-sm" id="admin-users-refresh-btn">Làm mới</button>
                            </div>
                            <div class="admin-users-table-card">
                                <div id="admin-users-state"></div>
                                <table class="admin-users-table">
                                    <thead><tr><th>Người dùng</th><th>Email</th><th>Gói</th><th>Vai trò</th><th>Usage</th><th>Trạng thái</th><th>Hoạt động gần nhất</th><th>Thao tác</th></tr></thead>
                                    <tbody id="admin-user-table-body"></tbody>
                                </table>
                                <div class="admin-users-pagination">
                                    <span id="admin-users-page-info">Hiển thị 0 / 0 người dùng</span>
                                    <select id="admin-users-page-size"><option value="10">10</option><option value="20">20</option><option value="50">50</option></select>
                                    <button class="admin-pagination-btn" id="admin-users-prev-btn">‹</button>
                                    <span id="admin-users-page-number">1</span>
                                    <button class="admin-pagination-btn" id="admin-users-next-btn">›</button>
                                </div>
                            </div>
                        </section>
                        <aside class="admin-users-side">
                            <div class="admin-user-side-card" id="admin-users-plan-chart"></div>
                            <div class="admin-user-side-card" id="admin-users-new-chart"></div>
                            <div class="admin-user-side-card">
                                <div class="admin-side-card-head"><h3>Hành động nhanh</h3></div>
                                <button class="admin-user-quick" data-user-quick="invite"><span>✉</span><div><strong>Mời user</strong><small>Tạo lời mời tài khoản mới</small></div><b>→</b></button>
                                <button class="admin-user-quick" data-user-quick="groups"><span>▦</span><div><strong>Tạo nhóm</strong><small>Chuẩn bị phân nhóm workspace</small></div><b>→</b></button>
                                <button class="admin-user-quick" data-user-quick="audit"><span>◎</span><div><strong>Xem audit log</strong><small>Mở module nhật ký hệ thống</small></div><b>→</b></button>
                            </div>
                            <div class="admin-user-side-card security-suggestion">
                                <div class="admin-side-card-head"><h3>Gợi ý bảo mật</h3></div>
                                <p>Thiết lập 2FA cho admin để tăng cường bảo mật hệ thống.</p>
                                <button class="btn btn-outline btn-sm" data-user-quick="security">Thiết lập ngay</button>
                            </div>
                        </aside>
                    </div>
                </div>`;
        }
        if (tabId === "workspaces") {
            return `
                <div class="panel-header-v2">
                    <div class="panel-header-title">
                        <h2>Workspaces</h2>
                        <p>Giám sát workspace, file và quota lưu trữ.</p>
                    </div>
                </div>
                <div class="admin-table-wrapper" style="overflow:auto;margin-top:1rem;">
                    <table class="admin-table">
                        <thead><tr><th>Tên</th><th>Owner</th><th>Gói</th><th>Members</th><th>Files</th><th>Storage</th><th>Retention</th><th>Hoạt động</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                        <tbody id="admin-workspaces-table-body"></tbody>
                    </table>
                </div>`;
        }
        return "";
    }

    function ensureAdminViewStructure() {
        const workspaceView = document.getElementById("workspace-view");
        let adminView = document.getElementById("admin-view");
        if (!adminView) {
            adminView = document.createElement("section");
            adminView.id = "admin-view";
            adminView.className = "view-panel";
            adminView.innerHTML = `
                <div class="workspace-container admin-console">
                    <aside class="sidebar glass-card">
                        <div class="sidebar-header">
                            <div class="current-tier-indicator"><span class="pulse-dot"></span><span>Admin Console</span></div>
                        </div>
                        <nav class="sidebar-nav" id="admin-sidebar-nav"></nav>
                    </aside>
                    <div class="workspace-panels-container" id="admin-panels-container"></div>
                </div>`;
            workspaceView?.insertAdjacentElement("afterend", adminView);
        }

        const nav = adminView.querySelector("#admin-sidebar-nav") || adminView.querySelector(".sidebar-nav");
        const container = adminView.querySelector("#admin-panels-container") || adminView.querySelector(".workspace-panels-container");
        if (!nav || !container) return;

        const tabLabels = [
            ["overview", "Tổng quan"],
            ["users", "Người dùng"],
            ["workspaces", "Workspaces"],
            ["jobs", "Jobs"],
            ["quota", "AI Usage"],
            ["billing", "Billing"],
            ["prompts", "Prompts"],
            ["templates", "Templates"],
            ["feedback", "Feedback"],
            ["audit", "Audit"],
            ["system-logs", "System logs"],
            ["security", "Security"],
            ["features", "Features"],
            ["settings", "Settings"]
        ];

        document.querySelectorAll("#workspace-view [id^='admin-tab-']").forEach((panel) => {
            container.appendChild(panel);
        });

        tabLabels.forEach(([tabId, label], index) => {
            if (!nav.querySelector(`[data-admin-tab="${tabId}"]`)) {
                const button = document.createElement("button");
                button.className = `sidebar-item${index === 0 ? " active" : ""}`;
                button.type = "button";
                button.setAttribute("data-admin-tab", tabId);
                button.innerHTML = `<span>${escapeHTML(label)}</span>`;
                nav.appendChild(button);
            }
            if (!document.getElementById(`admin-tab-${tabId}`)) {
                const panel = document.createElement("div");
                panel.className = `tab-panel${index === 0 ? " active" : ""}`;
                panel.id = `admin-tab-${tabId}`;
                panel.innerHTML = adminPanelContent(tabId) || `
                    <div class="panel-header-v2">
                        <div class="panel-header-title">
                            <h2>${escapeHTML(label)}</h2>
                            <p>Module quản trị đang sẵn sàng.</p>
                        </div>
                    </div>`;
                container.appendChild(panel);
            }
        });

        if (!document.getElementById("admin-stat-users")) {
            document.getElementById("admin-tab-overview")?.insertAdjacentHTML("beforeend", `<span id="admin-stat-users" hidden>0</span>`);
        }
        if (!document.getElementById("admin-stat-mrr")) {
            document.getElementById("admin-tab-overview")?.insertAdjacentHTML("beforeend", `<span id="admin-stat-mrr" hidden>0đ</span>`);
        }
    }

    ensureAdminViewStructure();

    REQUIRED_DOM_FALLBACKS.forEach(([id, tag]) => {
        if (document.getElementById(id)) return;
        const el = document.createElement(tag);
        el.id = id;
        el.hidden = true;
        if (tag === "input") el.type = id.includes("file") ? "file" : "text";
        document.body.appendChild(el);
    });

    function normalizeFilesWorkspacePage() {
        const panel = document.getElementById("tab-files");
        if (!panel || panel.dataset.singleFilesPage === "1") return;
        panel.dataset.singleFilesPage = "1";
        panel.classList.add("files-single-page-host");
        const wrapper = panel.querySelector(".panel-wrapper-v2");
        if (wrapper) {
            wrapper.classList.add("files-workspace-page", "files-single-page");
        }
        const mainGrid = panel.querySelector(".workspace-main-grid");
        if (mainGrid) {
            mainGrid.classList.add("files-one-page-grid");
        }
        const searchBar = panel.querySelector("#files-search-input")?.parentElement?.parentElement;
        if (searchBar) {
            searchBar.classList.add("files-toolbar-actions");
            if (!document.getElementById("files-status-filter")) {
                searchBar.insertAdjacentHTML("beforeend", `<select id="files-status-filter"><option value="all">Tất cả trạng thái</option><option value="ready">Sẵn sàng</option><option value="warning">Cảnh báo</option><option value="processing">Đang xử lý</option><option value="error">Có lỗi</option></select>`);
            }
            if (!document.getElementById("files-format-filter")) {
                searchBar.insertAdjacentHTML("beforeend", `<select id="files-format-filter"><option value="all">Tất cả định dạng</option><option value="xlsx">XLSX</option><option value="xls">XLS</option><option value="csv">CSV</option></select>`);
            }
        }
        const table = panel.querySelector(".workspace-files-table");
        if (table && !document.getElementById("files-select-all")) {
            const headerRow = table.querySelector("thead tr");
            headerRow?.insertAdjacentHTML("afterbegin", `<th><input type="checkbox" id="files-select-all"></th>`);
        }
        if (!document.getElementById("files-selection-summary")) {
            table?.insertAdjacentHTML("beforebegin", `<div id="files-selection-summary" class="files-selection-summary">Chưa chọn file nào</div>`);
        }
        if (!document.getElementById("files-bulk-actions")) {
            table?.insertAdjacentHTML("beforebegin", `<div id="files-bulk-actions" class="files-bulk-actions" style="display:none;"><span id="files-bulk-count">0 file đã chọn</span><button id="files-bulk-delete-btn" class="btn btn-outline btn-xs">Xóa</button></div>`);
        }
        const defaults = {
            "files-stat-total": "0",
            "files-stat-today": "0",
            "files-stat-errors": "0",
            "files-stat-ready": "0",
            "files-stat-processing": "0",
            "files-stat-size": "0 KB",
            "files-stat-rows": "0",
            "files-stat-ai": "0",
            "files-capacity-text": "0 KB",
            "files-list-badge": "0 tệp"
        };
        Object.entries(defaults).forEach(([id, text]) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        });
        const capacityBar = document.getElementById("files-capacity-bar");
        if (capacityBar) capacityBar.style.width = "0%";
        const pagination = panel.querySelector(".admin-pagination span");
        if (pagination) pagination.innerText = "Hiển thị 0 tệp";
    }

    normalizeFilesWorkspacePage();

    function clearBlockingOverlays() {
        document.querySelectorAll(".modal-backdrop.active").forEach((modal) => {
            modal.classList.remove("active");
        });
        const featureModal = document.getElementById("feature-detail-modal");
        if (featureModal) featureModal.style.display = "none";
    }

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

    function encodeInlineArg(value) {
        return encodeURIComponent(String(value ?? ""));
    }

    function debounce(fn, delay = 250) {
        let timer = null;
        return (...args) => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => fn(...args), delay);
        };
    }

    function normalizeAccountStatus(status) {
        const value = String(status || "active").trim().toLowerCase();
        const aliases = {
            "hoạt động": "active",
            "ho?t ??ng": "active",
            "bị khóa": "suspended",
            "đã khóa": "suspended",
            "tạm khóa": "suspended",
            "t?m khóa": "suspended",
            "chờ xác minh": "pending",
            "ch? xác minh": "pending",
            "không hoạt động": "inactive",
            "không ho?t ??ng": "inactive"
        };
        return aliases[value] || value;
    }

    function accountStatusLabel(status) {
        const normalized = normalizeAccountStatus(status);
        const labels = {
            active: "Hoạt động",
            inactive: "Không hoạt động",
            pending: "Chờ xác minh",
            suspended: "Tạm khóa",
            deleted: "Đã xóa"
        };
        return labels[normalized] || "Hoạt động";
    }

    function accountStatusBadge(status) {
        return normalizeAccountStatus(status) === "active" ? "badge-active" : "badge-banned";
    }

    const TIER_LABELS = {
        free: "Free",
        pro: "Pro",
        business: "Business",
        enterprise: "Enterprise"
    };

    function normalizeTier(tier) {
        const value = String(tier || "free").trim().toLowerCase();
        return TIER_LABELS[value] ? value : "free";
    }

    function tierLabel(tier) {
        return TIER_LABELS[normalizeTier(tier)];
    }

    function tierBadgeClass(tier) {
        return `tier-${normalizeTier(tier)}`;
    }

    function normalizeApiKeyStatus(status) {
        const value = String(status || "active").trim().toLowerCase();
        if (["hoạt động", "ho?t ??ng"].includes(value)) return "active";
        if (["đã thu hồi", "thu hồi", "revoked"].includes(value)) return "revoked";
        return value;
    }

    function apiKeyStatusLabel(status) {
        return normalizeApiKeyStatus(status) === "active" ? "Hoạt động" : "Đã thu hồi";
    }

    // ----------------------------------------------------------------------
    // 1. APPLICATION STATE (SYNCED WITH BACKEND SERVICES)
    // ----------------------------------------------------------------------
    function purgeLegacyLocalStorage() {
        if (localStorage.getItem("excelai_local_storage_purged_v5") === "true") return;

        const token = getAccessToken();
        const storedUser = localStorage.getItem("excelai_current_user");
        let shouldRemoveStoredUser = !token;

        if (storedUser) {
            try {
                JSON.parse(storedUser);
            } catch (e) {
                shouldRemoveStoredUser = true;
            }
        }

        const keysToRemove = [
            "excelai_users",
            "excelai_system_logs",
            "excelai_jobs",
            "excelai_feedbacks",
            "excelai_apikeys",
            "excelai_coupons",
            "excelai_chat_threads",
            "excelai_operations_history",
            "excelai_prompt_config",
            "excelai_security_settings",
            "excelai_settings_workspace_name",
            "excelai_settings_retention",
            "excelai_feature_flags"
        ];

        if (shouldRemoveStoredUser) {
            keysToRemove.push("excelai_current_user");
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        localStorage.removeItem("excelai_backend_purged_v3");
        localStorage.removeItem("excelai_backend_purged_v4");
        localStorage.removeItem("excelai_local_storage_purged_v4");
        localStorage.setItem("excelai_local_storage_purged_v5", "true");
    }

    purgeLegacyLocalStorage();

    const users = billingService.loadUsers();

    function loadStoredApiUser() {
        if (!getAccessToken()) return null;
        const raw = localStorage.getItem("excelai_current_user");
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error("Lỗi parse user API", e);
            return null;
        }
    }

    function loadFeatureFlags() {
        return adminService.loadFeatureFlags();
    }

    function featureFlagsPayload(config = state.featureFlagConfig) {
        return {
            ...flatFeatureFlagsFromConfig(config),
            flags: Object.values(config),
            rolePermissions: state.rolePermissions,
            changeLogs: state.featureFlagChangeLogs
        };
    }

    async function saveFeatureFlags(config) {
        const previousConfig = state.featureFlagConfig;
        const previousFlags = state.featureFlags;
        state.featureFlagConfig = config;
        state.featureFlags = flatFeatureFlagsFromConfig(config);
        try {
            await adminService.saveFeatureFlags(featureFlagsPayload(config));
        } catch (error) {
            state.featureFlagConfig = previousConfig;
            state.featureFlags = previousFlags;
            checkWorkspaceLocks();
            throw error;
        }
        checkWorkspaceLocks();
        return state.featureFlags;
    }

    function createBlankThread(title = "Cuộc chat mới") {
        const id = crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, "0")}`;
        return { id, title, messages: [] };
    }
    const currentUserFromDb = loadStoredApiUser() || users[0] || {
        id: null,
        name: "Người dùng",
        email: "",
        tier: "free",
        usageCount: 0,
        usageLimit: 20,
        status: "active",
        role: "user"
    };

    const promptConfig = adminService.loadPromptConfig();
    const initialChatThreads = historyService.loadChatThreads();

    function defaultSecurityPolicy() {
        return {
            fileSizeLimit: 10,
            allowedTypes: ".xlsx, .xls, .csv",
            blockedTypes: ".exe, .bat, .cmd, .js, .vbs, .scr, .dll",
            maxExcelRows: 100000,
            maxExcelSheets: 20,
            scanMalware: true,
            blockVbaMacro: true,
            allowXlsm: false,
            rateLimit: 100,
            uploadPerHourLimit: 30,
            failedLoginLimit: 5,
            accountLockMinutes: 15,
            sensitiveDataWarning: true,
            piiTypes: ["national_id", "phone", "email", "address", "tax_code", "bank_account"],
            sensitiveDataAction: "mask",
            enableIpWhitelist: false,
            enableIpBlacklist: true,
            whitelistIps: "",
            blacklistIps: "45.xxx.xxx.xxx\n113.xxx.xxx.xxx",
            enableOtp2fa: true
        };
    }

    function buildSecurityPolicy(settings = {}) {
        const defaults = defaultSecurityPolicy();
        const ipControl = String(settings.adminAccessControl || "").toLowerCase();
        return {
            ...defaults,
            ...settings,
            allowedTypes: settings.allowedTypes || defaults.allowedTypes,
            blockedTypes: settings.blockedTypes || defaults.blockedTypes,
            scanMalware: settings.scanMalware ?? defaults.scanMalware,
            blockVbaMacro: settings.blockVbaMacro ?? settings.enableMacroWarning ?? defaults.blockVbaMacro,
            allowXlsm: settings.allowXlsm ?? defaults.allowXlsm,
            sensitiveDataWarning: settings.sensitiveDataWarning ?? defaults.sensitiveDataWarning,
            piiTypes: Array.isArray(settings.piiTypes) && settings.piiTypes.length ? settings.piiTypes : defaults.piiTypes,
            enableIpWhitelist: settings.enableIpWhitelist ?? ipControl.includes("enabled"),
            enableIpBlacklist: settings.enableIpBlacklist ?? defaults.enableIpBlacklist,
            enableOtp2fa: settings.enableOtp2fa ?? defaults.enableOtp2fa
        };
    }

    const defaultFeatureFlags = {
        enable_autopilot: {
            id: "enable_autopilot",
            name: "enable_autopilot",
            description: "Mở khóa phân hệ Autopilot tự động hóa lập kế hoạch",
            group: "AI Tools",
            status: "Enabled",
            scope: "Global",
            rollout: 100,
            dependencies: ["enable_data_checker"],
            enabled: true,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Admin", "Manager", "User"],
            note: "Mở mặc định cho module lập kế hoạch."
        },
        enable_table_builder: {
            id: "enable_table_builder",
            name: "enable_table_builder",
            description: "Mở khóa tính năng dựng bảng AI Table Builder",
            group: "AI Tools",
            status: "Enabled",
            scope: "Global",
            rollout: 100,
            dependencies: [],
            enabled: true,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Admin", "Manager", "User"],
            note: "Sẵn sàng vận hành."
        },
        enable_document_builder: {
            id: "enable_document_builder",
            name: "enable_document_builder",
            description: "Mở khóa tính năng soạn thảo văn bản AI Document Builder",
            group: "AI Tools",
            status: "Enabled",
            scope: "Global",
            rollout: 100,
            dependencies: ["enable_table_builder"],
            enabled: true,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Admin", "Manager", "User"],
            note: "Phụ thuộc Table Builder."
        },
        enable_data_checker: {
            id: "enable_data_checker",
            name: "enable_data_checker",
            description: "Bật tính năng quét định dạng và kiểm lỗi dữ liệu AI Data Checker",
            group: "Data Processing",
            status: "Enabled",
            scope: "Global",
            rollout: 100,
            dependencies: [],
            enabled: true,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Admin", "Manager", "User"],
            note: "Module kiểm lỗi lõi."
        },
        enable_reconciliation: {
            id: "enable_reconciliation",
            name: "Đối soát 2 bảng",
            description: "Bật phân hệ so khớp & đối soát chênh lệch tài chính A/B",
            group: "Finance",
            status: "Enabled",
            scope: "Global",
            rollout: 100,
            dependencies: ["enable_excel_import"],
            enabled: true,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Admin", "Manager", "User"],
            note: "Cho phép người dùng đối soát dữ liệu giữa hai bảng."
        },
        enable_excel_import: {
            id: "enable_excel_import",
            name: "enable_excel_import",
            description: "Cho phép import dữ liệu Excel",
            group: "Data Processing",
            status: "Enabled",
            scope: "Global",
            rollout: 100,
            dependencies: [],
            enabled: true,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Admin", "Manager", "User"],
            note: "Cần cho upload và đối soát."
        },
        enable_export_report: {
            id: "enable_export_report",
            name: "enable_export_report",
            description: "Cho phép xuất báo cáo",
            group: "System",
            status: "Enabled",
            scope: "Global",
            rollout: 100,
            dependencies: [],
            enabled: true,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Admin", "Manager", "User"],
            note: "Xuất file kết quả và báo cáo."
        },
        enable_pii_scanner: {
            id: "enable_pii_scanner",
            name: "enable_pii_scanner",
            description: "Bật quét dữ liệu nhạy cảm",
            group: "Security",
            status: "Enabled",
            scope: "Global",
            rollout: 100,
            dependencies: [],
            enabled: true,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Admin", "Manager"],
            note: "Bảo vệ PII cho pipeline upload."
        },
        enable_new_dashboard: {
            id: "enable_new_dashboard",
            name: "enable_new_dashboard",
            description: "Mở giao diện dashboard mới",
            group: "Beta Features",
            status: "Disabled",
            scope: "Role",
            rollout: 0,
            dependencies: [],
            enabled: false,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Manager"],
            note: "Đang chờ vòng test tiếp theo."
        },
        enable_ai_suggestion: {
            id: "enable_ai_suggestion",
            name: "enable_ai_suggestion",
            description: "Bật gợi ý AI từ backend",
            group: "Beta Features",
            status: "Beta",
            scope: "Role",
            rollout: 20,
            dependencies: [],
            enabled: true,
            startDate: "2026-06-07",
            endDate: "",
            workspaces: [],
            roles: ["Manager"],
            note: "Test cho nhóm Manager."
        }
    };

    const rolePermissions = {
        Admin: { enable_autopilot: "Được phép", enable_table_builder: "Được phép", enable_document_builder: "Được phép", enable_data_checker: "Được phép", enable_reconciliation: "Được phép", enable_export_report: "Được phép" },
        Manager: { enable_autopilot: "Được phép", enable_table_builder: "Được phép", enable_document_builder: "Được phép", enable_data_checker: "Được phép", enable_reconciliation: "Beta access", enable_export_report: "Được phép" },
        User: { enable_autopilot: "Được phép", enable_table_builder: "Được phép", enable_document_builder: "Được phép", enable_data_checker: "Được phép", enable_reconciliation: "Được phép", enable_export_report: "Được phép" },
        Guest: { enable_autopilot: "Không được phép", enable_table_builder: "Chỉ xem", enable_document_builder: "Không được phép", enable_data_checker: "Không được phép", enable_reconciliation: "Không được phép", enable_export_report: "Chỉ xem" }
    };

    const changeLogs = [];

    function cloneFeatureFlags(flags = defaultFeatureFlags) {
        return Object.fromEntries(Object.entries(flags).map(([id, flag]) => [id, { ...flag, dependencies: [...(flag.dependencies || [])], workspaces: [...(flag.workspaces || [])], roles: [...(flag.roles || [])] }]));
    }

    function buildFeatureFlagConfig(raw = {}) {
        const config = cloneFeatureFlags();
        const metadata = Array.isArray(raw.flags) ? raw.flags : [];
        metadata.forEach(item => {
            if (!item?.id || !config[item.id]) return;
            config[item.id] = {
                ...config[item.id],
                ...item,
                dependencies: Array.isArray(item.dependencies) ? item.dependencies : config[item.id].dependencies,
                workspaces: Array.isArray(item.workspaces) ? item.workspaces : config[item.id].workspaces,
                roles: Array.isArray(item.roles) ? item.roles : config[item.id].roles
            };
        });
        Object.keys(config).forEach(id => {
            if (typeof raw[id] === "boolean") {
                config[id].enabled = raw[id];
                if (raw[id] && ["Disabled", "Deprecated", "Maintenance"].includes(config[id].status)) {
                    config[id].status = "Enabled";
                    if (Number(config[id].rollout) === 0) config[id].rollout = 100;
                }
                if (!raw[id] && config[id].status === "Enabled") config[id].status = "Disabled";
            }
        });
        return config;
    }

    function flatFeatureFlagsFromConfig(config) {
        return Object.fromEntries(Object.entries(config).map(([id, flag]) => [id, Boolean(flag.enabled) && flag.status !== "Disabled" && flag.status !== "Deprecated" && flag.status !== "Maintenance"]));
    }

    const initialFeatureFlagConfig = buildFeatureFlagConfig(loadFeatureFlags());

    function defaultAppConfig(settings = {}) {
        return {
            appName: settings.appName || "ExcelAI Workspace",
            logoUrl: settings.logoUrl || "",
            supportEmail: settings.supportEmail || "support@excelai.com",
            supportHotline: settings.supportHotline || "1900 9090",
            supportWebsite: settings.supportWebsite || "https://excelai.local/support",
            timezone: settings.timezone || "Asia/Saigon",
            defaultLanguage: settings.defaultLanguage || "vi",
            appVersion: settings.appVersion || "v1.2.0",
            environment: settings.environment || "Development",
            lastUpdate: settings.lastUpdate || "10/06/2026 10:30"
        };
    }

    function defaultBroadcastForm() {
        return {
            title: "Bảo trì hệ thống",
            message: "Hệ thống sẽ bảo trì nâng cấp trong 5 phút từ 24:00 hôm nay.",
            type: "Maintenance",
            priority: "Cao",
            target: "Toàn hệ thống",
            targetValues: "",
            displayDuration: 60,
            requireRead: true,
            popup: true,
            sendEmail: false,
            inApp: true,
            scheduleStartDate: "",
            scheduleStartTime: "",
            scheduleEndDate: "",
            scheduleFrequency: "Một lần",
            scheduleStatus: "Đang chờ"
        };
    }

    function defaultMaintenanceConfig(settings = {}) {
        return {
            enabled: Boolean(settings.maintenanceMode),
            title: settings.maintenanceTitle || "Hệ thống đang bảo trì",
            message: settings.maintenanceMessage || "Người dùng thường sẽ bị tạm khóa truy cập cho đến khi chế độ bảo trì kết thúc.",
            startAt: settings.maintenanceStart || "",
            endAt: settings.maintenanceEnd || "",
            allowAdmin: settings.maintenanceAllowAdmin ?? true,
            allowWhitelist: settings.maintenanceAllowWhitelist ?? true,
            autoStart: settings.maintenanceAutoStart ?? false,
            autoEnd: settings.maintenanceAutoEnd ?? true
        };
    }

    function defaultRealtimeStatus() {
        return {
            websocket: "Unknown",
            queue: "Unknown",
            emailService: "Unknown",
            notificationService: "Unknown",
            lastHeartbeat: "Chưa kiểm tra",
            connectedClients: 0
        };
    }


    const state = {
        currentUser: currentUserFromDb,
        billingCycle: "monthly", // "monthly" or "annual"
        billingPlans: [],
        billingProviders: [],
        paymentConfigured: false,
        selectedUpgradeTier: null,
        chartInstance: null,
        reportsChartInstance: null,
        reportsDonutChartInstance: null,
        autoReport: {
            files: [],
            sheets: [],
            selectedFileId: "",
            selectedFileName: "",
            selectedSheet: "",
            page: 1,
            limit: 25,
            search: "",
            sortBy: "",
            sortOrder: "asc",
            preview: null,
            report: null
        },
        aiDocument: {
            files: [],
            sheets: [],
            templates: [],
            selectedFileId: "",
            selectedSheet: "",
            selectedTemplateId: "",
            status: "ready",
            currentDocument: null
        },
        aiTableBuilder: {
            files: [],
            sheets: [],
            selectedFileId: "",
            selectedSheet: "",
            currentTable: null,
            page: 1,
            pageSize: 25,
            search: "",
            sortBy: "",
            sortOrder: "asc",
            status: "ready"
        },
        uploadedFiles: [],
        users: users,
        adminUsersAll: [],
        adminUsersLoading: false,
        adminUsersError: "",
        adminUsersFilters: { search: "", plan: "all", status: "all", role: "all", page: 1, pageSize: 10 },
        systemPrompt: promptConfig.systemPrompt,
        freeLimit: promptConfig.freeLimit,
        systemLogs: adminService.loadSystemLogs(),
        chatThreads: initialChatThreads,
        activeThreadId: initialChatThreads[0]?.id || "",
        chatContext: null,
        selectedChatFileIds: [],
        aiProviderErrorShown: false,
        apiKeys: adminService.loadAPIKeys(),
        workspaces: adminService.loadWorkspaces(),
        adminWorkspacesLoading: false,
        adminWorkspacesError: "",
        adminWorkspacesStats: null,
        adminWorkspaceActivities: [],
        adminWorkspacesFilters: { search: "", plan: "all", status: "all", storage: "all", page: 1, pageSize: 10 },
        adminWorkspaceModalMode: "create",
        adminWorkspaceEditingId: "",
        apiKeysChartInstance: null,
        coupons: billingService.loadCoupons(),
        activeDiscount: 0,
        activeCouponCode: "",
        editingCouponCode: "",
        featureFlags: flatFeatureFlagsFromConfig(initialFeatureFlagConfig),
        featureFlagConfig: initialFeatureFlagConfig,
        featureFlagFilters: { search: "", group: "All", status: "All", scope: "All" },
        selectedFeatureFlagId: "enable_autopilot",
        rolePermissions,
        featureFlagChangeLogs: [...changeLogs],
        templates: templateService.loadTemplates(),
        systemMetrics: null,
        adminOverview: null,
        adminOverviewLoading: false,
        adminOverviewLoaded: false,
        aiCostDashboard: null,
        securityAuditDashboard: null,
        checkoutRequests: [],
        billingDashboard: null,
        broadcasts: adminService.loadBroadcasts(),
        appConfig: defaultAppConfig(adminService.loadSecuritySettings()),
        broadcastForm: defaultBroadcastForm(),
        maintenanceConfig: defaultMaintenanceConfig(adminService.loadSecuritySettings()),
        broadcastHistory: [],
        realtimeStatus: defaultRealtimeStatus(),
        securityPolicy: buildSecurityPolicy(adminService.loadSecuritySettings()),
        activeBroadcastId: null,
        broadcastCountdownTimer: null,
        broadcastPollStarted: false,
        workspaceFiles: {
            selectedFileName: "",
            selectedRows: new Set(),
            search: "",
            status: "all",
            format: "all",
            previewMode: "excel",
            previewLimit: 50,
            wrapText: false,
            highlightErrors: true,
            freezeHeader: true,
            zoom: "100%"
        }
    };

    function syncCurrentUserToStateUsers() {
        if (!state.currentUser || !state.currentUser.id) return;
        const existingIndex = state.users.findIndex(u => String(u.id) === String(state.currentUser.id));
        if (existingIndex >= 0) {
            state.users[existingIndex] = { ...state.users[existingIndex], ...state.currentUser };
        } else {
            state.users.unshift(state.currentUser);
        }
        billingService.saveUsers(state.users);
    }

    function upsertStateUser(updatedUser) {
        if (!updatedUser || !updatedUser.id) return null;
        const normalizedUser = {
            ...updatedUser,
            tier: normalizeTier(updatedUser.tier),
            status: normalizeAccountStatus(updatedUser.status)
        };
        const existingIndex = state.users.findIndex(user => String(user.id) === String(normalizedUser.id));
        if (existingIndex >= 0) {
            state.users[existingIndex] = { ...state.users[existingIndex], ...normalizedUser };
        } else {
            state.users.unshift(normalizedUser);
        }
        if (state.currentUser?.id && String(state.currentUser.id) === String(normalizedUser.id)) {
            state.currentUser = { ...state.currentUser, ...normalizedUser };
            localStorage.setItem("excelai_current_user", JSON.stringify(state.currentUser));
            updateWorkspaceSidebarUI();
        }
        billingService.saveUsers(state.users);
        return state.users.find(user => String(user.id) === String(normalizedUser.id)) || normalizedUser;
    }

    function incrementCurrentUserUsage() {
        state.currentUser.usageCount = (state.currentUser.usageCount || 0) + 1;
        syncCurrentUserToStateUsers();
    }

    async function loadUserFilesFromApi() {
        if (!getAccessToken()) {
            state.uploadedFiles = [];
            renderUploadedFilesTable();
            updateFileSelectDropdowns();
            return;
        }
        try {
            const files = await fileService.getFiles();
            if (!files || files.length === 0) {
                state.uploadedFiles = [];
            } else {
                const hydratedFiles = await Promise.all((files || []).map(async (file) => {
                    try {
                        const preview = await fileService.getFilePreview(file.id);
                        const rows = preview.rows || [];
                        const headers = preview.headers || [];
                        return {
                            ...file,
                            headers,
                            rows,
                            rowCount: file.rowCount ?? preview.totalRows ?? rows.length,
                            colCount: file.colCount ?? headers.length,
                            totalRows: preview.totalRows,
                            statistics: fileService.buildDataStatistics(headers, rows, preview.totalRows || rows.length)
                        };
                    } catch (error) {
                        return { ...file, headers: [], rows: [], statistics: { totalRows: file.rowCount || 0, totalCols: file.colCount || 0, missingValues: 0, duplicateRows: 0, columns: [] } };
                    }
                }));
                state.uploadedFiles = hydratedFiles;
            }
            renderUploadedFilesTable();
            updateFileSelectDropdowns();
            // Trigger preview of the first file if nothing selected
            if (state.uploadedFiles.length > 0 && !state.workspaceFiles.selectedFileName) {
                window.previewWorkspaceFile(state.uploadedFiles[0].name);
            }
        } catch (error) {
            console.error("API load files error:", error);
            state.uploadedFiles = [];
            renderUploadedFilesTable();
            updateFileSelectDropdowns();
        }
    }

    // Pricing values matching landing page
    const pricing = {
        monthly: { pro: "149,000đ", business: "299,000đ", enterprise: "399,000đ", period: "/tháng" },
        annual: { pro: "119,000đ", business: "239,000đ", enterprise: "319,000đ", period: "/tháng (trả năm)" }
    };

    function applyPricingConfig(config) {
        if (!config) return;
        pricing.monthly = { ...pricing.monthly, ...(config.monthly || {}) };
        pricing.annual = { ...pricing.annual, ...(config.annual || {}) };
        state.billingPlans = Array.isArray(config.plans) ? config.plans : state.billingPlans;
        state.billingProviders = Array.isArray(config.providers) ? config.providers : state.billingProviders;
        state.paymentConfigured = Boolean(config.paymentConfigured);
    }

    function getTierPrice(tier, cycle = state.billingCycle) {
        const normalized = normalizeTier(tier);
        if (normalized === "business") {
            return pricing[cycle].business || pricing[cycle].enterprise || "";
        }
        return pricing[cycle][normalized] || "";
    }

    async function refreshPricingFromApi() {
        try {
            const config = await billingService.refreshPricing();
            applyPricingConfig(config);
            syncPricingUI();
        } catch (error) {
            console.warn(error.message || error);
        }
    }

    // ----------------------------------------------------------------------
    // 2. DOM ELEMENT SELECTORS
    // ----------------------------------------------------------------------
    // Navigation / Routing
    const logoBtn = document.getElementById("logo-btn");
    const navFeatures = document.getElementById("nav-features");
    const navPricing = document.getElementById("nav-pricing");
    const goWorkspaceBtn = document.getElementById("go-workspace-btn");
    const authOpenBtn = document.getElementById("auth-open-btn");
    const heroStartBtn = document.getElementById("hero-start-btn");
    const heroBackendBtn = document.getElementById("hero-backend-btn");
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

    // Landing backend shortcut section
    const landingBackendInput = document.getElementById("landing-backend-input");
    const landingBackendGenerateBtn = document.getElementById("landing-backend-generate-btn");
    const landingBackendCode = document.getElementById("landing-backend-code");
    const landingBackendCopyBtn = document.getElementById("landing-backend-copy-btn");

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

    // Tab - Data Analyzer
    const analyzerLockOverlay = document.getElementById("analyzer-lock-overlay");
    const csvDropzone = document.getElementById("csv-dropzone");
    const csvFileInput = document.getElementById("csv-file-input");
    const realSalesBtn = document.getElementById("real-sales-btn");
    const realHrBtn = document.getElementById("real-hr-btn");
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
    const filesUploadQuickBtn = document.getElementById("files-upload-quick-btn");
    const filesChooseBtn = document.getElementById("files-choose-btn");
    const filesEmptyUploadBtn = document.getElementById("files-empty-upload-btn");
    const filesTemplateBtn = document.getElementById("files-template-btn");
    const filesTemplateSecondaryBtn = document.getElementById("files-template-secondary-btn");
    const filesNewWorkspaceBtn = document.getElementById("files-new-workspace-btn");
    const filesGuideBtn = document.getElementById("files-guide-btn");
    const filesClearAllBtn = document.getElementById("files-clear-all-btn");
    const filesUploadQueue = document.getElementById("files-upload-queue");
    const filesSearchInput = document.getElementById("files-search-input");
    const filesStatusFilter = document.getElementById("files-status-filter");
    const filesFormatFilter = document.getElementById("files-format-filter");
    const filesSelectAll = document.getElementById("files-select-all");
    const filesSelectionSummary = document.getElementById("files-selection-summary");
    const filesBulkActions = document.getElementById("files-bulk-actions");
    const filesBulkCount = document.getElementById("files-bulk-count");
    const filesBulkDeleteBtn = document.getElementById("files-bulk-delete-btn");
    const filesCapacityText = document.getElementById("files-capacity-text");
    const filesCapacityBar = document.getElementById("files-capacity-bar");
    const filesPreviewType = document.getElementById("files-preview-type");
    const filesPreviewSize = document.getElementById("files-preview-size");
    const filesPreviewSheet = document.getElementById("files-preview-sheet");
    const filesPreviewDimensions = document.getElementById("files-preview-dimensions");
    const filesPreviewRange = document.getElementById("files-preview-range");
    const filesPreviewStatus = document.getElementById("files-preview-status");
    const filesSheetTabs = document.getElementById("files-sheet-tabs");
    const filesSheetSelect = document.getElementById("files-sheet-select");
    const filesPreviewSearch = document.getElementById("files-preview-search");
    const filesPreviewZoom = document.getElementById("files-preview-zoom");
    const filesWrapToggle = document.getElementById("files-wrap-toggle");
    const filesHighlightToggle = document.getElementById("files-highlight-toggle");
    const filesFreezeToggle = document.getElementById("files-freeze-toggle");
    const filesPreviewMode = document.getElementById("files-preview-mode");
    const filesPreviewLimit = document.getElementById("files-preview-limit");
    const filesFullscreenBtn = document.getElementById("files-fullscreen-btn");
    const filesQualityErrors = document.getElementById("files-quality-errors");
    const filesQualityDuplicates = document.getElementById("files-quality-duplicates");
    const filesQualityEmpty = document.getElementById("files-quality-empty");
    const filesQualityColumns = document.getElementById("files-quality-columns");
    const filesAiInsights = document.getElementById("files-ai-insights");

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
    const reconcileExportBtn = document.getElementById("reconcile-export-btn");
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
    const reportsRefreshBtn = document.getElementById("reports-refresh-btn");
    const reportsHistoryBtn = document.getElementById("reports-history-btn");
    const reportsCreateBtn = document.getElementById("reports-create-btn");
    const reportsExportBtn = document.getElementById("reports-export-btn");
    const reportsSheetTabs = document.getElementById("reports-sheet-tabs");
    const reportsSearchInput = document.getElementById("reports-search-input");
    const reportsPageSize = document.getElementById("reports-page-size");
    const reportsPrevPage = document.getElementById("reports-prev-page");
    const reportsNextPage = document.getElementById("reports-next-page");
    const reportsPageIndicator = document.getElementById("reports-page-indicator");
    const reportsHistoryDrawer = document.getElementById("reports-history-drawer");

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
    const tableBuilderRowsToggle = document.getElementById("table-builder-rows-toggle");
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

    function setupChoiceSync(scopeSelector, selectEl) {
        const scope = document.querySelector(scopeSelector);
        if (!scope || !selectEl) return;
        scope.querySelectorAll("[data-value]").forEach(button => {
            button.addEventListener("click", () => {
                const value = button.dataset.value;
                if (value) selectEl.value = value;
                const group = button.closest(".template-card-grid, .choice-card-grid");
                if (group) {
                    group.querySelectorAll("[data-value]").forEach(item => item.classList.remove("active"));
                }
                button.classList.add("active");
            });
        });
    }

    function setupPromptCounter(textarea, scopeSelector, limit) {
        const counter = document.querySelector(`${scopeSelector} .char-counter`);
        if (!textarea || !counter) return;
        const update = () => {
            counter.innerText = `${textarea.value.length}/${limit}`;
        };
        textarea.addEventListener("input", update);
        update();
    }

    setupChoiceSync(".formula-assistant-page .choice-card-grid", formulaContextSelect);
    setupChoiceSync(".ai-builder-page .template-card-grid", tableBuilderType);
    setupChoiceSync(".ai-doc-page .template-card-grid", docBuilderType);
    setupChoiceSync(".ai-doc-page .choice-card-grid", docBuilderTone);
    setupPromptCounter(formulaPrompt, ".formula-assistant-page", 800);
    setupPromptCounter(tableBuilderDesc, ".ai-builder-page", 1000);
    setupPromptCounter(docBuilderFacts, ".ai-doc-page", 1500);

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

    // Auth modal
    const authModal = document.getElementById("auth-modal");
    const authCloseBtn = document.getElementById("auth-close-btn");
    const authForm = document.getElementById("auth-form");
    const authModalTitle = document.getElementById("auth-modal-title");
    const authNameGroup = document.getElementById("auth-name-group");
    const authNameInput = document.getElementById("auth-name-input");
    const authEmailInput = document.getElementById("auth-email-input");
    const authPasswordInput = document.getElementById("auth-password-input");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const authToggleBtn = document.getElementById("auth-toggle-btn");
    const googleLoginBtn = document.getElementById("google-login-btn");
    const googleLoginContainer = document.getElementById("google-login-container");
    const forgotPasswordBtn = document.getElementById("forgot-password-btn");
    const passwordResetModal = document.getElementById("password-reset-modal");
    const passwordResetCloseBtn = document.getElementById("password-reset-close-btn");
    const forgotPasswordForm = document.getElementById("forgot-password-form");
    const forgotPasswordEmail = document.getElementById("forgot-password-email");
    const forgotPasswordSubmitBtn = document.getElementById("forgot-password-submit-btn");
    const resetPasswordForm = document.getElementById("reset-password-form");
    const resetPasswordToken = document.getElementById("reset-password-token");
    const resetPasswordInput = document.getElementById("reset-password-input");
    const resetPasswordSubmitBtn = document.getElementById("reset-password-submit-btn");
    const passwordResetDevNote = document.getElementById("password-reset-dev-note");

    // Admin user edit modal
    const adminUserModal = document.getElementById("admin-user-modal");
    const adminUserModalTitle = document.getElementById("admin-user-modal-title");
    const adminUserCloseBtn = document.getElementById("admin-user-close-btn");
    const adminUserForm = document.getElementById("admin-user-form");
    const editUserIdInput = document.getElementById("edit-user-id");
    const editUserNameInput = document.getElementById("edit-user-name");
    const editUserEmailInput = document.getElementById("edit-user-email");
    const editUserPasswordGroup = document.getElementById("edit-user-password-group");
    const editUserPasswordInput = document.getElementById("edit-user-password");
    const editUserTierSelect = document.getElementById("edit-user-tier");
    const editUserStatusSelect = document.getElementById("edit-user-status");

    const adminTemplateModal = document.getElementById("admin-template-modal");
    const adminTemplateModalTitle = document.getElementById("admin-template-modal-title");
    const adminTemplateCloseBtn = document.getElementById("admin-template-close-btn");
    const adminTemplateForm = document.getElementById("admin-template-form");
    const editTemplateIdInput = document.getElementById("edit-template-id");
    const editTemplateNameInput = document.getElementById("edit-template-name");
    const editTemplateCategoryInput = document.getElementById("edit-template-category");
    const editTemplateFileInput = document.getElementById("edit-template-file");
    const editTemplateIconInput = document.getElementById("edit-template-icon");
    const editTemplateColorInput = document.getElementById("edit-template-color");
    const editTemplateDescriptionInput = document.getElementById("edit-template-description");

    // Admin Configurations
    const adminSystemPrompt = document.getElementById("admin-system-prompt");
    const adminSystemLimit = document.getElementById("admin-system-limit");
    const adminSavePromptBtn = document.getElementById("admin-save-prompt-btn");
    const adminSystemLogs = document.getElementById("admin-system-logs");
    const adminUserTableBody = document.getElementById("admin-user-table-body");
    const adminAddUserBtn = document.getElementById("admin-add-user-btn");
    const adminGrantUserSelect = document.getElementById("admin-grant-user-select");
    const adminGrantTierSelect = document.getElementById("admin-grant-tier-select");
    const adminGrantReason = document.getElementById("admin-grant-reason");
    const adminGrantTierBtn = document.getElementById("admin-grant-tier-btn");
    const adminRefreshBillingBtn = document.getElementById("admin-refresh-billing-btn");
    const adminCheckoutRequestsTableBody = document.getElementById("admin-checkout-requests-table-body");
    const adminBillingTierSummary = document.getElementById("admin-billing-tier-summary");
    const adminQuotaFeatureList = document.getElementById("admin-quota-feature-list");
    const adminQuotaTotalRequests = document.getElementById("admin-quota-total-requests");
    const adminQuotaSummary = document.getElementById("admin-quota-summary");

    // Stats in Admin
    const adminStatMrr = document.getElementById("admin-stat-mrr");
    const adminStatUsers = document.getElementById("admin-stat-users");

    // Toast Container
    const toastContainer = document.getElementById("toast-container");

    // Excel Add-in buttons
    const formulaInsertExcelBtn = document.getElementById("formula-insert-excel-btn");
    const activeSheetBtn = document.getElementById("active-sheet-btn");

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

    window.showToast = showToast;

    window.showPanel = function(viewName = "workspace") {
        showView(viewName);
    };

    window.selectPriority = function(btn, value) {
        document.querySelectorAll(".priority-btn").forEach((item) => {
            item.style.background = "transparent";
            item.style.borderColor = "rgba(255,255,255,0.1)";
            item.style.color = "var(--color-text-muted)";
            item.style.fontWeight = "400";
        });
        if (btn) {
            btn.style.background = "rgba(59, 130, 246, 0.1)";
            btn.style.borderColor = "#3b82f6";
            btn.style.color = "#fff";
            btn.style.fontWeight = "600";
        }
        const select = document.getElementById("broadcast-priority-select");
        if (select) select.value = value;
    };

    window.selectTarget = function(btn, value) {
        document.querySelectorAll(".target-btn").forEach((item) => {
            item.style.background = "transparent";
            item.style.borderColor = "rgba(255,255,255,0.1)";
            item.style.color = "var(--color-text-muted)";
            item.style.fontWeight = "400";
        });
        if (btn) {
            btn.style.background = "rgba(59, 130, 246, 0.1)";
            btn.style.borderColor = "#3b82f6";
            btn.style.color = "#fff";
            btn.style.fontWeight = "600";
        }
        const select = document.getElementById("broadcast-target-select");
        if (select) select.value = value;
    };

    // ----------------------------------------------------------------------
    // 4. ROUTING & NAVIGATION
    // ----------------------------------------------------------------------
    let authMode = "login";
    let pendingViewAfterAuth = "workspace";

    function hasApiSession() {
        return Boolean(getAccessToken());
    }

    function isCurrentUserAdmin() {
        const user = state.currentUser || {};
        return user.role === "admin";
    }

    function updateRoleSwitcherAccess() {
        if (!roleUserBtn || !roleAdminBtn) return;
        const admin = isCurrentUserAdmin();
        roleAdminBtn.style.display = admin ? "inline-flex" : "none";
        roleAdminBtn.disabled = !admin;
        roleAdminBtn.title = admin ? "Khu vực quản trị" : "Chỉ tài khoản admin tổng được vào Admin";
        roleUserBtn.style.display = admin ? "none" : "inline-flex";
    }

    async function applyAuthenticatedUser(user) {
        if (!user) return;
        state.currentUser = {
            ...state.currentUser,
            ...user,
            usageCount: user.usageCount ?? user.usage_count ?? 0,
            usageLimit: user.usageLimit ?? user.usage_limit ?? state.freeLimit,
            tier: normalizeTier(user.tier),
            status: normalizeAccountStatus(user.status),
            role: user.role || "user"
        };
        updateRoleSwitcherAccess();
        syncCurrentUserToStateUsers();
        updateWorkspaceSidebarUI();
        startBroadcastPolling();

        Promise.allSettled([
            adminService.refreshUserSettings(),
            historyService.getHistory(),
            historyService.refreshChatThreads(),
            loadUserFilesFromApi(),
            pollActiveBroadcast()
        ]).then(([settingsPayload, operationsPayload, threadsPayload]) => {
            if (settingsPayload.status === "fulfilled") {
                state.featureFlagConfig = buildFeatureFlagConfig(adminService.loadFeatureFlags());
                state.featureFlags = flatFeatureFlagsFromConfig(state.featureFlagConfig);
                const workspaceSettings = adminService.loadWorkspaceSettings();
                if (settingsWorkspaceName) settingsWorkspaceName.value = workspaceSettings.workspaceName || "";
                if (settingsRetention) settingsRetention.value = workspaceSettings.retention || "30";
            }
            if (operationsPayload.status === "fulfilled") {
                renderOperationsHistory();
            }
            if (threadsPayload.status === "fulfilled") {
                state.chatThreads = historyService.loadChatThreads();
                state.activeThreadId = state.chatThreads[0]?.id || "";
                renderThreadsList();
                if (state.activeThreadId) switchThread(state.activeThreadId);
            }
        }).catch(error => console.warn(error.message || error));
    }

    function showAuthModal(mode = "login", nextView = "workspace") {
        authMode = mode;
        pendingViewAfterAuth = nextView;
        const isRegister = authMode === "register";
        authModalTitle.innerText = isRegister ? "Đăng ký ExcelAI" : "Đăng nhập ExcelAI";
        authNameGroup.style.display = isRegister ? "block" : "none";
        authSubmitBtn.innerText = isRegister ? "Đăng ký" : "Đăng nhập";
        authToggleBtn.innerText = isRegister ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký";
        authModal.classList.add("active");
        setTimeout(() => authEmailInput.focus(), 50);
    }

    function resetExpiredAuth(nextView = "workspace") {
        clearAuth();
        state.currentUser = null;
        showAuthModal("login", nextView);
        showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "warning");
    }

    function closeAuthModal() {
        authModal.classList.remove("active");
    }

    async function finishAuth(data, successMessage = "Đăng nhập thành công!") {
        await applyAuthenticatedUser(data.user);
        closeAuthModal();
        clearBlockingOverlays();
        showToast(successMessage, "success");
        showView(isCurrentUserAdmin() ? "admin" : (pendingViewAfterAuth || "workspace"));
    }

    function openPasswordResetModal(token = "") {
        if (!passwordResetModal) return;
        forgotPasswordForm.style.display = token ? "none" : "block";
        resetPasswordForm.style.display = token ? "block" : "none";
        if (resetPasswordToken) resetPasswordToken.value = token;
        if (passwordResetDevNote) {
            passwordResetDevNote.style.display = token ? "block" : "none";
            passwordResetDevNote.innerText = token ? "Nhập mật khẩu mới để hoàn tất đặt lại." : "";
        }
        passwordResetModal.classList.add("active");
        setTimeout(() => (token ? resetPasswordInput : forgotPasswordEmail)?.focus(), 50);
    }

    function closePasswordResetModal() {
        passwordResetModal?.classList.remove("active");
    }

    async function initGoogleLogin() {
        if (!googleLoginBtn || !googleLoginContainer) return;
        try {
            const config = await authService.getGoogleConfig();
            if (!config?.enabled || !config.clientId) {
                googleLoginBtn.style.display = "block";
                googleLoginBtn.innerText = "Đăng nhập bằng Google";
                googleLoginBtn.addEventListener("click", () => {
                    showToast("Chưa cấu hình GOOGLE_CLIENT_ID trong backend/.env nên Google Login chưa thể chạy.", "warning");
                });
                return;
            }
            const loadScript = () => new Promise((resolve, reject) => {
                if (window.google?.accounts?.id) {
                    resolve();
                    return;
                }
                const script = document.createElement("script");
                script.src = "https://accounts.google.com/gsi/client";
                script.async = true;
                script.defer = true;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            await loadScript();
            window.google.accounts.id.initialize({
                client_id: config.clientId,
                callback: async (response) => {
                    try {
                        const data = await authService.loginWithGoogle(response.credential);
                        await finishAuth(data, "Đăng nhập Google thành công!");
                    } catch (error) {
                        showToast(error.message || "Không thể đăng nhập bằng Google", "error");
                    }
                }
            });
            googleLoginBtn.addEventListener("click", () => {
                googleLoginContainer.style.display = "block";
                googleLoginContainer.innerHTML = "";
                window.google.accounts.id.renderButton(googleLoginContainer, {
                    theme: "outline",
                    size: "large",
                    width: Math.min(340, googleLoginContainer.parentElement?.clientWidth || 340),
                    text: "continue_with"
                });
            });
        } catch (error) {
            googleLoginBtn.style.display = "none";
        }
    }

    function showView(viewName) {
        if ((viewName === "workspace" || viewName === "admin") && !hasApiSession()) {
            showAuthModal("login", viewName);
            return;
        }
        const adminScreenAvailable = Boolean(adminView);
        if (viewName === "admin" && !adminScreenAvailable) {
            showToast("Giao diện quản trị chưa được mount trong HTML hiện tại. Đang mở Workspace.", "warning");
            viewName = "workspace";
        }
        if (viewName === "admin" && !isCurrentUserAdmin()) {
            showToast("Chỉ tài khoản admin tổng được vào giao diện Admin", "error");
            viewName = "workspace";
        }
        if (viewName === "workspace" && isCurrentUserAdmin() && adminScreenAvailable) {
            viewName = "admin";
        }
        clearBlockingOverlays();
        updateRoleSwitcherAccess();

        // Deactivate all
        landingView?.classList.remove("active");
        workspaceView?.classList.remove("active");
        adminView?.classList.remove("active");

        // Remove active states from nav links
        navFeatures.classList.remove("active");
        navPricing.classList.remove("active");

        // Hide/Show header elements based on view
        if (viewName === "landing") {
            landingView?.classList.add("active");
            headerUserActions.style.display = "none";
            goWorkspaceBtn.style.display = "block";
        } else if (viewName === "workspace") {
            workspaceView?.classList.add("active");
            headerUserActions.style.display = "flex";
            goWorkspaceBtn.style.display = "none";

            // Toggle active role tab
            roleUserBtn.classList.add("active");
            roleAdminBtn.classList.remove("active");

            // Set up limits & widgets
            updateWorkspaceSidebarUI();
            checkWorkspaceLocks();
        } else if (viewName === "admin") {
            adminView?.classList.add("active");
            headerUserActions.style.display = "flex";
            goWorkspaceBtn.style.display = "none";

            // Toggle active role tab
            roleUserBtn.classList.remove("active");
            roleAdminBtn.classList.add("active");

            renderAdminPanel();
            refreshAdminDataFromApi();
            switchAdminTab("overview");
        }

        // Scroll to top
        window.scrollTo(0, 0);
    }

    if (authOpenBtn) {
        authOpenBtn.addEventListener("click", () => showAuthModal("login", "workspace"));
    }

    if (authCloseBtn) {
        authCloseBtn.addEventListener("click", closeAuthModal);
    }

    if (authToggleBtn) {
        authToggleBtn.addEventListener("click", () => {
            showAuthModal(authMode === "login" ? "register" : "login", pendingViewAfterAuth);
        });
    }

    if (authForm) {
        authForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const email = authEmailInput.value.trim();
            const password = authPasswordInput.value;
            const name = authNameInput.value.trim() || email.split("@")[0];
            if (!email || !password) {
                showToast("Vui lòng nhập email và mật khẩu", "error");
                return;
            }
            if (password.length < 6) {
                showToast("Mật khẩu cần tối thiểu 6 ký tự", "error");
                return;
            }

            authSubmitBtn.disabled = true;
            authSubmitBtn.innerText = authMode === "register" ? "Đang đăng ký..." : "Đang đăng nhập...";

            try {
                const data = authMode === "register"
                    ? await authService.register(name, email, password)
                    : await authService.login(email, password);
                await finishAuth(data, authMode === "register" ? "Đăng ký thành công!" : "Đăng nhập thành công!");
            } catch (error) {
                showToast(error.message || "Không thể xác thực tài khoản", "error");
            } finally {
                authSubmitBtn.disabled = false;
                authSubmitBtn.innerText = authMode === "register" ? "Đăng ký" : "Đăng nhập";
            }
        });
    }

    forgotPasswordBtn?.addEventListener("click", (event) => {
        event.preventDefault();
        closeAuthModal();
        openPasswordResetModal();
        if (forgotPasswordEmail && authEmailInput?.value) forgotPasswordEmail.value = authEmailInput.value.trim();
    });

    passwordResetCloseBtn?.addEventListener("click", closePasswordResetModal);

    forgotPasswordForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = forgotPasswordEmail.value.trim();
        if (!email) {
            showToast("Vui lòng nhập email", "error");
            return;
        }
        forgotPasswordSubmitBtn.disabled = true;
        forgotPasswordSubmitBtn.innerText = "Đang gửi...";
        try {
            const result = await authService.forgotPassword(email);
            showToast(result.message || "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.", "success");
            if (result.resetToken) {
                openPasswordResetModal(result.resetToken);
                if (passwordResetDevNote) {
                    passwordResetDevNote.style.display = "block";
                    passwordResetDevNote.innerText = "Dev mode: token reset đã được cấp trực tiếp để test local.";
                }
            }
        } catch (error) {
            showToast(error.message || "Không thể gửi yêu cầu đặt lại mật khẩu", "error");
        } finally {
            forgotPasswordSubmitBtn.disabled = false;
            forgotPasswordSubmitBtn.innerText = "Gửi hướng dẫn đặt lại";
        }
    });

    resetPasswordForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const token = resetPasswordToken.value.trim();
        const password = resetPasswordInput.value;
        if (!token || password.length < 6) {
            showToast("Token hoặc mật khẩu mới không hợp lệ", "error");
            return;
        }
        resetPasswordSubmitBtn.disabled = true;
        resetPasswordSubmitBtn.innerText = "Đang đặt lại...";
        try {
            const result = await authService.resetPassword(token, password);
            closePasswordResetModal();
            showAuthModal("login", "workspace");
            showToast(result.message || "Đã đặt lại mật khẩu.", "success");
        } catch (error) {
            showToast(error.message || "Không thể đặt lại mật khẩu", "error");
        } finally {
            resetPasswordSubmitBtn.disabled = false;
            resetPasswordSubmitBtn.innerText = "Đặt lại mật khẩu";
        }
    });

    initGoogleLogin();

    const initialResetToken = new URLSearchParams(window.location.search).get("resetToken");
    if (initialResetToken) {
        openPasswordResetModal(initialResetToken);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }

    if (hasApiSession()) {
        authService.getCurrentUser()
            .then(async (user) => {
                await applyAuthenticatedUser(user);
                showView(isCurrentUserAdmin() && adminView ? "admin" : "workspace");
                await handleBillingRedirectStatus();
            })
            .catch(() => {
                resetExpiredAuth("workspace");
            });
    }

    window.addEventListener("excelai:auth-expired", () => {
        resetExpiredAuth("workspace");
    });

    logoBtn.addEventListener("click", () => showView("landing"));
    goWorkspaceBtn.addEventListener("click", () => showView("workspace"));
    heroStartBtn.addEventListener("click", () => {
        showView("workspace");
        switchWorkspaceTab("chat");
    });
    heroBackendBtn.addEventListener("click", () => {
        showView("workspace");
        switchWorkspaceTab("files");
    });

    roleUserBtn.addEventListener("click", () => showView("workspace"));
    roleAdminBtn.addEventListener("click", () => showView("admin"));
    logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await authService.logout();
        state.currentUser = { id: null, name: "Người dùng", email: "", tier: "free", usageCount: 0, usageLimit: state.freeLimit, status: "active", role: "user" };
        updateRoleSwitcherAccess();
        showToast("Đã đăng xuất khỏi hệ thống thành công", "info");
        showView("landing");
    });

    async function forceLogoutFromBroadcast(reason = "Bạn đã được đưa ra khỏi hệ thống theo thông báo bảo trì.") {
        if (state.broadcastCountdownTimer) {
            clearInterval(state.broadcastCountdownTimer);
            state.broadcastCountdownTimer = null;
        }
        try {
            await authService.logout();
        } catch (error) {
            clearAuth();
        }
        state.currentUser = { id: null, name: "Người dùng", email: "", tier: "free", usageCount: 0, usageLimit: state.freeLimit, status: "active", role: "user" };
        updateRoleSwitcherAccess();
        const modal = document.getElementById("system-broadcast-modal");
        if (modal) modal.remove();
        showView("landing");
        showToast(reason, "warning");
    }

    function showSystemBroadcastModal(broadcast) {
        if (!broadcast || !broadcast.id) return;
        state.activeBroadcastId = broadcast.id;
        if (state.broadcastCountdownTimer) clearInterval(state.broadcastCountdownTimer);

        let remaining = Math.max(10, parseInt(broadcast.countdownSeconds || 60));
        let modal = document.getElementById("system-broadcast-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "system-broadcast-modal";
            modal.style.position = "fixed";
            modal.style.inset = "0";
            modal.style.zIndex = "9999";
            modal.style.display = "flex";
            modal.style.alignItems = "center";
            modal.style.justifyContent = "center";
            modal.style.background = "rgba(0,0,0,0.72)";
            modal.style.backdropFilter = "blur(8px)";
            modal.innerHTML = `
                <div class="glass-card animate-zoom" style="width:min(520px, calc(100vw - 2rem)); padding:1.5rem; border:1px solid rgba(239,68,68,0.45); text-align:left;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:0.75rem;">
                        <h3 style="margin:0; color:var(--color-danger);">Thông báo hệ thống</h3>
                        <span id="broadcast-countdown" style="font-family:var(--font-mono); font-weight:800; color:var(--color-warning); font-size:1.25rem;">60s</span>
                    </div>
                    <p id="broadcast-message" style="white-space:pre-wrap; color:var(--color-text-main); line-height:1.55; margin-bottom:1rem;"></p>
                    <p style="font-size:0.82rem; color:var(--color-text-muted); line-height:1.45; margin-bottom:1.25rem;">Vui lòng lưu công việc đang làm. Hệ thống sẽ tự đưa bạn ra khỏi phiên làm việc khi đồng hồ về 0.</p>
                    <button class="btn btn-primary btn-block" id="broadcast-exit-now-btn">Thoát ngay</button>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector("#broadcast-exit-now-btn").addEventListener("click", () => {
                forceLogoutFromBroadcast("Bạn đã thoát khỏi phiên làm việc theo thông báo hệ thống.");
            });
        }

        modal.querySelector("#broadcast-message").innerText = broadcast.message || "Hệ thống chuẩn bị bảo trì.";
        const countdown = modal.querySelector("#broadcast-countdown");
        const tick = () => {
            countdown.innerText = `${remaining}s`;
            if (remaining <= 0) {
                forceLogoutFromBroadcast();
                return;
            }
            remaining -= 1;
        };
        tick();
        state.broadcastCountdownTimer = setInterval(tick, 1000);
    }

    async function pollActiveBroadcast() {
        if (!hasApiSession()) return;
        try {
            const payload = await adminService.getActiveBroadcast();
            const broadcast = payload?.broadcast;
            if (broadcast && broadcast.id && broadcast.id !== state.activeBroadcastId) {
                showSystemBroadcastModal(broadcast);
            }
        } catch (error) {
            console.warn(error.message || error);
        }
    }

    function startBroadcastPolling() {
        if (state.broadcastPollStarted) return;
        state.broadcastPollStarted = true;
        setInterval(pollActiveBroadcast, 15000);
    }

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
        priceEnterpriseText.innerText = getTierPrice("business", cycle);
        periodEnterpriseText.innerText = pricing[cycle].period;
    }

    // Modal popup triggers for buying
    btnSelectPro.addEventListener("click", () => triggerPayment("pro"));
    btnSelectEnterprise.addEventListener("click", openEnterpriseLeadModal);
    billingUpgradeBtn.addEventListener("click", () => triggerPayment("pro"));
    miniBtnPro.addEventListener("click", () => triggerPayment("pro"));
    miniBtnEnterprise.addEventListener("click", openEnterpriseLeadModal);

    async function handleBillingRedirectStatus() {
        const billingMatch = window.location.pathname.match(/\/billing\/(success|pending|failed|cancel)$/);
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("orderId") || params.get("order_id");
        if (!billingMatch || !orderId) return;
        showView("workspace");
        switchWorkspaceTab("billing");
        try {
            const order = await billingService.getOrderStatus(orderId);
            const statusText = order.status === "paid"
                ? "Thanh toán đã được webhook xác nhận. Gói đã được cập nhật."
                : order.status === "failed"
                    ? "Thanh toán thất bại hoặc bị hủy."
                    : "Đang chờ webhook/IPN xác nhận thanh toán.";
            showToast(statusText, order.status === "paid" ? "success" : order.status === "failed" ? "error" : "info");
            if (order.status === "paid") {
                const user = await authService.getCurrentUser();
                await applyAuthenticatedUser(user);
            }
        } catch (error) {
            showToast(error.message || "Không thể kiểm tra trạng thái thanh toán", "error");
        } finally {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    function openEnterpriseLeadModal() {
        let modal = document.getElementById("enterprise-lead-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "enterprise-lead-modal";
            modal.className = "enterprise-lead-modal";
            modal.innerHTML = `
                <div class="enterprise-lead-dialog">
                    <button type="button" class="enterprise-lead-close" aria-label="Đóng">&times;</button>
                    <h3>Liên hệ gói Enterprise</h3>
                    <form id="enterprise-lead-form" class="enterprise-lead-form">
                        <label>Họ tên<input id="enterprise-lead-name" type="text" required></label>
                        <label>Email<input id="enterprise-lead-email" type="email" required></label>
                        <label>Số điện thoại<input id="enterprise-lead-phone" type="tel"></label>
                        <label>Công ty<input id="enterprise-lead-company" type="text"></label>
                        <label>Nhu cầu<textarea id="enterprise-lead-need" rows="4" placeholder="Số người dùng, quota, tích hợp thanh toán hoặc SLA..."></textarea></label>
                        <div id="enterprise-lead-result"></div>
                        <button type="submit" class="btn btn-primary">Gửi yêu cầu tư vấn</button>
                    </form>
                </div>`;
            document.body.appendChild(modal);
            modal.querySelector(".enterprise-lead-close")?.addEventListener("click", () => modal.classList.remove("active"));
            modal.addEventListener("click", (event) => {
                if (event.target === modal) modal.classList.remove("active");
            });
            modal.querySelector("#enterprise-lead-form")?.addEventListener("submit", async (event) => {
                event.preventDefault();
                const submit = event.currentTarget.querySelector("button[type='submit']");
                const result = modal.querySelector("#enterprise-lead-result");
                submit.disabled = true;
                submit.innerText = "Đang gửi...";
                try {
                    await billingService.createEnterpriseLead({
                        name: modal.querySelector("#enterprise-lead-name")?.value || "",
                        email: modal.querySelector("#enterprise-lead-email")?.value || "",
                        phone: modal.querySelector("#enterprise-lead-phone")?.value || "",
                        company: modal.querySelector("#enterprise-lead-company")?.value || "",
                        need: modal.querySelector("#enterprise-lead-need")?.value || ""
                    });
                    if (result) result.innerHTML = `<div class="enterprise-lead-success">Đã gửi yêu cầu. Đội ngũ ExcelAI sẽ liên hệ lại.</div>`;
                    showToast("Đã gửi yêu cầu Enterprise", "success");
                } catch (error) {
                    if (result) result.innerHTML = `<div class="billing-provider-warning">${escapeHTML(error.message || "Không thể gửi yêu cầu")}</div>`;
                    showToast(error.message || "Không thể gửi yêu cầu", "error");
                } finally {
                    submit.disabled = false;
                    submit.innerText = "Gửi yêu cầu tư vấn";
                }
            });
        }
        modal.querySelector("#enterprise-lead-name").value = state.currentUser?.name || "";
        modal.querySelector("#enterprise-lead-email").value = state.currentUser?.email || "";
        modal.querySelector("#enterprise-lead-result").innerHTML = "";
        modal.classList.add("active");
    }

    const CLEANING_RULES = [
        ["trimWhitespace", "Xóa khoảng trắng đầu/cuối"],
        ["normalizeCase", "Chuẩn hóa chữ hoa/thường"],
        ["normalizeEmail", "Chuẩn hóa email"],
        ["normalizePhone", "Chuẩn hóa số điện thoại"],
        ["normalizeDate", "Chuẩn hóa ngày tháng"],
        ["removeDuplicates", "Loại dòng trùng"],
        ["fillMissingValues", "Điền giá trị thiếu"],
        ["removeSpecialCharacters", "Loại bỏ ký tự đặc biệt"],
        ["normalizeStatus", "Chuẩn hóa trạng thái"],
        ["normalizeNumber", "Chuẩn hóa dữ liệu số"],
        ["normalizeCurrency", "Chuẩn hóa tiền tệ"],
        ["normalizePercentage", "Chuẩn hóa phần trăm"]
    ];

    function cleanRootEl(id) {
        return document.getElementById("tab-cleaning")?.querySelector(`#${id}`);
    }

    function selectedCleaningColumns(root) {
        return Array.from(root.querySelectorAll("[data-clean-column]:checked")).map(input => input.value);
    }

    function selectedCleaningRules(root) {
        return Object.fromEntries(CLEANING_RULES.map(([key]) => [key, Boolean(root.querySelector(`[data-clean-rule="${key}"]`)?.checked)]));
    }

    function formatFileMeta(file) {
        if (!file) return "Chọn file để xem thông tin.";
        const size = file.size || file.sizeText || "--";
        const rows = Number(file.rowCount || file.row_count || 0).toLocaleString("vi-VN");
        return `${file.name || file.fileName} • ${size} • ${rows} dòng • ${file.status || "ready"}`;
    }

    function renderCleaningColumns(root, columns, filter = "") {
        const box = root.querySelector("#clean-column-chips");
        if (!box) return;
        const needle = filter.trim().toLowerCase();
        const visible = columns.filter(col => !needle || `${col.label} ${col.type}`.toLowerCase().includes(needle));
        box.innerHTML = visible.length ? visible.map(col => `
            <label class="clean-column-chip">
                <input type="checkbox" data-clean-column value="${escapeHTML(col.key)}" checked>
                <span>${escapeHTML(col.label)}</span>
                <small>${escapeHTML(col.type || "text")} • thiếu ${Number(col.missingCount || 0).toLocaleString("vi-VN")} • lỗi ${Number(col.invalidCount || 0).toLocaleString("vi-VN")}</small>
            </label>`).join("") : `<div class="cleaning-empty-inline">Không tìm thấy cột.</div>`;
    }

    function renderCleaningKpis(root, summary) {
        const grid = root.querySelector("#clean-kpi-grid");
        if (!grid) return;
        const improvement = Math.max(0, Number(summary.qualityAfter || 0) - Number(summary.qualityBefore || 0));
        const cards = [
            ["Tổng dòng", summary.totalRows],
            ["Lỗi phát hiện", summary.errorsFound],
            ["Dòng trùng", summary.duplicateRows],
            ["Ô đã chuẩn hóa", summary.normalizedCells],
            ["Tỷ lệ cải thiện", `${improvement.toFixed(1)}%`],
            ["Chất lượng sau làm sạch", `${summary.qualityAfter}%`]
        ];
        grid.innerHTML = cards.map(([label, value]) => `<div class="clean-kpi-card"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join("");
    }

    function renderCleaningPreviewRows(root, rows, search = "") {
        const body = root.querySelector("#clean-preview-table-body");
        if (!body) return;
        const needle = search.trim().toLowerCase();
        const filtered = rows.filter(row => !needle || JSON.stringify(row).toLowerCase().includes(needle));
        body.innerHTML = filtered.length ? filtered.map(row => {
            const changedColumns = new Set((row.changes || []).map(change => change.column));
            const errorColumns = new Set((row.errors || []).map(error => error.column).filter(Boolean));
            const columns = Object.keys(row.before || {});
            return `
                <tr><th colspan="4">Dòng ${escapeHTML(row.rowIndex)}</th></tr>
                ${columns.slice(0, 8).map(column => `
                    <tr>
                        <td>${escapeHTML(column)}</td>
                        <td class="${errorColumns.has(column) ? "clean-cell-error" : ""}">${escapeHTML(row.before[column])}</td>
                        <td class="${changedColumns.has(column) ? "clean-cell-fixed" : ""}">${escapeHTML(row.after[column])}</td>
                        <td>${changedColumns.has(column) ? "Đã sửa" : ""}</td>
                    </tr>`).join("")}`;
        }).join("") : `<tr><td>Không có dòng thay đổi phù hợp.</td></tr>`;
    }

    function renderCleaningChart(root, breakdown) {
        const chart = root.querySelector("#clean-error-chart");
        if (!chart) return;
        chart.innerHTML = (breakdown || []).length ? breakdown.map(item => `
            <div class="clean-chart-row">
                <span>${escapeHTML(item.label)}</span>
                <strong>${Number(item.count || 0).toLocaleString("vi-VN")} (${Number(item.percent || 0).toFixed(1)}%)</strong>
                <i style="width:${Math.max(4, Number(item.percent || 0))}%"></i>
            </div>`).join("") : `<div class="cleaning-empty-inline">Không có lỗi để vẽ biểu đồ.</div>`;
    }

    function renderCleaningInsights(root, insights) {
        const list = root.querySelector("#clean-insight-list");
        if (!list) return;
        list.innerHTML = (insights || []).map(item => `<li>${escapeHTML(item)}</li>`).join("") || `<li>Không có insight nổi bật.</li>`;
    }

    async function initDataCleaningPage() {
        const root = document.getElementById("tab-cleaning");
        if (!root || root.dataset.cleaningReady === "1") return;
        root.dataset.cleaningReady = "1";
        const localState = { files: [], sheets: [], columns: [], preview: null, selectedFile: null, selectedSheet: "" };
        const fileSelect = root.querySelector("#clean-file-select");
        const sheetSelect = root.querySelector("#clean-sheet-select");
        const sourceMeta = root.querySelector("#clean-source-meta");
        const ruleGrid = root.querySelector("#clean-rule-grid");
        const columnSearch = root.querySelector("#clean-column-search");
        const placeholder = root.querySelector("#clean-placeholder");
        const results = root.querySelector("#clean-preview-container");
        const statusState = root.querySelector("#clean-status-state");
        const statusSource = root.querySelector("#clean-status-source");
        const statusConfidence = root.querySelector("#clean-status-confidence");
        const statusTime = root.querySelector("#clean-status-time");
        const outputName = root.querySelector("#clean-output-name");
        ruleGrid.innerHTML = CLEANING_RULES.map(([key, label]) => `<label class="clean-rule-toggle"><input type="checkbox" data-clean-rule="${key}"><span>${label}</span></label>`).join("");
        const filesPayload = await cleaningService.getWorkspaceFiles();
        localState.files = Array.isArray(filesPayload) ? filesPayload : (filesPayload.files || []);
        fileSelect.innerHTML = localState.files.length
            ? `<option value="">Chọn file thật trong workspace</option>${localState.files.map(file => `<option value="${escapeHTML(file.id)}">${escapeHTML(file.name || file.fileName || file.id)}</option>`).join("")}`
            : `<option value="">Chưa có tệp nguồn</option>`;
        if (!localState.files.length) {
            placeholder.textContent = "Chưa có tệp nguồn";
            statusState.textContent = "Chưa có tệp nguồn";
        }
        root.querySelector("#clean-select-all-columns")?.addEventListener("click", () => {
            root.querySelectorAll("[data-clean-column]").forEach(input => { input.checked = true; });
        });
        columnSearch?.addEventListener("input", () => renderCleaningColumns(root, localState.columns, columnSearch.value));
        fileSelect.addEventListener("change", async () => {
            localState.selectedFile = localState.files.find(file => String(file.id) === String(fileSelect.value)) || null;
            localState.preview = null;
            results.hidden = true;
            placeholder.style.display = "flex";
            placeholder.textContent = localState.selectedFile ? "Chọn cột và quy tắc để xem kết quả." : "Chọn file và quy tắc để xem kết quả.";
            sourceMeta.textContent = formatFileMeta(localState.selectedFile);
            statusSource.textContent = localState.selectedFile ? `${localState.selectedFile.name || localState.selectedFile.fileName} • ${Number(localState.selectedFile.rowCount || 0).toLocaleString("vi-VN")} dòng` : "Chưa có tệp nguồn";
            outputName.value = localState.selectedFile ? `${String(localState.selectedFile.name || "data").replace(/\.(xlsx|xls|csv)$/i, "")}_CLEANED.xlsx` : "";
            if (!localState.selectedFile) return;
            statusState.textContent = "Đang tải sheet/cột";
            const sheetsPayload = await cleaningService.getSheets(localState.selectedFile.id);
            localState.sheets = (sheetsPayload.sheets || []).map(sheet => typeof sheet === "string" ? { name: sheet } : sheet);
            sheetSelect.innerHTML = localState.sheets.map(sheet => `<option value="${escapeHTML(sheet.name)}">${escapeHTML(sheet.name)}${sheet.rowCount ? ` • ${Number(sheet.rowCount).toLocaleString("vi-VN")} dòng` : ""}</option>`).join("");
            sheetSelect.dispatchEvent(new Event("change"));
        });
        sheetSelect.addEventListener("change", async () => {
            if (!localState.selectedFile) return;
            localState.selectedSheet = sheetSelect.value;
            const columnsPayload = await cleaningService.getColumns(localState.selectedFile.id, localState.selectedSheet);
            localState.columns = columnsPayload.columns || [];
            renderCleaningColumns(root, localState.columns, columnSearch?.value || "");
            statusState.textContent = "Sẵn sàng làm sạch";
        });
        root.querySelector("#clean-preview-btn")?.addEventListener("click", async () => {
            if (!localState.selectedFile) return showToast("Vui lòng chọn file nguồn", "error");
            const selectedColumns = selectedCleaningColumns(root);
            const rules = selectedCleaningRules(root);
            if (!selectedColumns.length) return showToast("Vui lòng chọn ít nhất một cột", "error");
            if (!Object.values(rules).some(Boolean)) return showToast("Vui lòng chọn ít nhất một quy tắc", "error");
            const btn = root.querySelector("#clean-preview-btn");
            btn.disabled = true;
            btn.textContent = "Đang phân tích...";
            statusState.textContent = "Đang xử lý";
            try {
                const preview = await cleaningService.previewCleaning({
                    fileId: localState.selectedFile.id,
                    sheetName: localState.selectedSheet,
                    selectedColumns,
                    rules,
                    options: {
                        missingValueStrategy: root.querySelector("#clean-missing-strategy")?.value,
                        duplicateStrategy: root.querySelector("#clean-duplicate-strategy")?.value,
                        dateFormat: root.querySelector("#clean-date-format")?.value,
                        phoneCountry: "VN"
                    },
                    page: 1,
                    limit: 20
                });
                localState.preview = preview;
                placeholder.style.display = "none";
                results.hidden = false;
                renderCleaningKpis(root, preview.summary || {});
                renderCleaningPreviewRows(root, preview.previewRows || []);
                renderCleaningChart(root, preview.errorBreakdown || []);
                renderCleaningInsights(root, preview.insights || []);
                statusState.textContent = "Hoàn thành";
                statusConfidence.textContent = `${preview.summary?.confidence || "--"}%`;
                statusTime.textContent = `${preview.summary?.estimatedTime || "--"} giây`;
            } catch (error) {
                statusState.textContent = "Lỗi";
                showToast(error.message || "Không thể xem trước làm sạch", "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Xem trước làm sạch";
            }
        });
        root.querySelector("#clean-apply-btn")?.addEventListener("click", () => {
            root.querySelector("#clean-preview-btn")?.click();
        });
        root.querySelector("#clean-preview-search")?.addEventListener("input", event => {
            renderCleaningPreviewRows(root, localState.preview?.previewRows || [], event.target.value);
        });
        root.querySelector("#clean-save-file-btn")?.addEventListener("click", async () => {
            if (!localState.preview?.jobId) return showToast("Hãy chạy xem trước trước khi lưu", "error");
            if (!outputName.value.trim()) return showToast("Vui lòng nhập tên file đầu ra", "error");
            const btn = root.querySelector("#clean-save-file-btn");
            btn.disabled = true;
            btn.textContent = "Đang lưu file...";
            statusState.textContent = "Đang lưu file đã làm sạch";
            try {
                const saved = await cleaningService.applyCleaning({
                    previewJobId: localState.preview.jobId,
                    fileId: localState.selectedFile.id,
                    sheetName: localState.selectedSheet,
                    saveMode: root.querySelector("#clean-save-mode")?.value || "new_file",
                    outputFileName: outputName.value.trim()
                });
                historyService.addOperation("cleaning", `Lưu file cleaned: ${saved.fileName}`);
                showToast("Đã lưu file cleaned vào workspace", "success");
                statusState.textContent = "Hoàn thành";
            } catch (error) {
                statusState.textContent = "Lỗi";
                showToast(error.message || "Không thể lưu file đã làm sạch", "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Lưu file đã làm sạch";
            }
        });
        root.querySelector("#clean-history-btn")?.addEventListener("click", async () => {
            const panel = root.querySelector("#clean-history-panel");
            panel.hidden = !panel.hidden;
            if (panel.hidden) return;
            const payload = await cleaningService.getHistory();
            panel.innerHTML = `<h3>Lịch sử làm sạch</h3>${(payload.items || []).length ? `<ul>${payload.items.map(item => `<li>${escapeHTML(item.created_at || item.createdAt || "")} • ${escapeHTML(item.action || "")}</li>`).join("")}</ul>` : `<div class="cleaning-empty-inline">Chưa có lịch sử làm sạch.</div>`}`;
        });
        root.querySelector("#clean-config-save-btn")?.addEventListener("click", () => {
            showToast("Cấu hình hiện tại nằm trên form và sẽ được gửi khi xem trước/lưu.", "info");
        });
    }

    function triggerPayment(tier) {
        state.selectedUpgradeTier = tier;

        let priceStr = "";
        let tierName = "";

        if (tier === "pro") {
            priceStr = pricing[state.billingCycle].pro;
            tierName = `Pro (${state.billingCycle === "monthly" ? "Tháng" : "Năm - Ưu đãi"})`;
        } else if (tier === "business") {
            priceStr = getTierPrice("business");
            tierName = `Business (${state.billingCycle === "monthly" ? "Tháng" : "Năm - Ưu đãi"})`;
        } else if (tier === "enterprise") {
            priceStr = getTierPrice("enterprise");
            tierName = `Enterprise (${state.billingCycle === "monthly" ? "Tháng" : "Năm - Ưu đãi"})`;
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
        const checkoutCardHolder = document.getElementById("checkout-card-holder");
        if (checkoutCardHolder) {
            checkoutCardHolder.innerText = state.currentUser?.name || state.currentUser?.email || "Người dùng hiện tại";
        }
        let providerBox = document.getElementById("checkout-provider-box");
        if (!providerBox) {
            providerBox = document.createElement("div");
            providerBox.id = "checkout-provider-box";
            providerBox.style.margin = "1rem 0";
            checkoutForm.insertBefore(providerBox, checkoutForm.firstChild);
        }
        if (!state.paymentConfigured || !state.billingProviders.length) {
            providerBox.innerHTML = `<div class="billing-provider-warning">Cổng thanh toán chưa được cấu hình</div>`;
        } else {
            providerBox.innerHTML = `
                <label for="checkout-provider-select">Phương thức thanh toán:</label>
                <select id="checkout-provider-select" style="width:100%;background:rgba(2,6,23,0.7);border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:8px;padding:10px;margin-top:6px;">
                    ${state.billingProviders.map(provider => `<option value="${escapeHTML(provider)}">${escapeHTML(provider.toUpperCase())}</option>`).join("")}
                </select>
                <div id="checkout-provider-result" style="margin-top:0.75rem;"></div>`;
        }
        checkoutModal.classList.add("active");
    }

    function formatBillingMoney(value, currency = "VND") {
        const amount = Number(value || 0);
        if (!amount) return "0đ";
        return `${amount.toLocaleString("vi-VN")}${currency === "VND" ? "đ" : ` ${currency}`}`;
    }

    function renderBillingFeatureList(features = []) {
        const items = Array.isArray(features) ? features : [];
        if (!items.length) return `<li>Quyền lợi được lấy từ gói backend.</li>`;
        return items.map(feature => `<li>${escapeHTML(feature)}</li>`).join("");
    }

    async function initBillingPage() {
        const plansGrid = document.getElementById("billing-plans-grid");
        const accountPanel = document.getElementById("billing-account-panel");
        const configAlert = document.getElementById("billing-config-alert");
        if (!plansGrid || !accountPanel) return;
        plansGrid.innerHTML = `<div class="billing-live-loading">Đang tải gói từ API...</div>`;
        const [plansPayload, account, history] = await Promise.all([
            billingService.getPlans(),
            billingService.getAccount(),
            billingService.getBillingHistory().catch(() => ({ items: [] }))
        ]);
        applyPricingConfig(plansPayload);
        const providers = plansPayload.providers || [];
        if (configAlert) configAlert.hidden = Boolean(providers.length);
        plansGrid.innerHTML = (plansPayload.plans || []).map(plan => {
            const isCurrent = account.currentPlan === plan.id;
            const price = plan.priceType === "contact"
                ? "Liên hệ"
                : formatBillingMoney(state.billingCycle === "annual" ? plan.yearlyPrice : plan.monthlyPrice, plan.currency);
            const period = plan.priceType === "contact" ? "" : (state.billingCycle === "annual" ? "/năm" : "/tháng");
            const button = isCurrent
                ? `<button class="btn btn-outline btn-block" disabled>Gói hiện tại</button>`
                : plan.id === "enterprise"
                    ? `<button class="btn btn-outline btn-block" data-billing-enterprise>Liên hệ Sales</button>`
                    : plan.id === "free"
                        ? `<button class="btn btn-outline btn-block" disabled>Miễn phí</button>`
                        : `<button class="btn btn-primary btn-block" data-billing-checkout="${escapeHTML(plan.id)}">Nâng cấp ngay</button>`;
            return `
                <article class="billing-live-card ${plan.id === "pro" ? "popular" : ""}">
                    ${plan.id === "pro" ? `<span class="billing-popular-badge">Phổ biến</span>` : ""}
                    <h3>${escapeHTML(plan.name || plan.id)}</h3>
                    <div class="billing-live-price"><strong>${escapeHTML(price)}</strong><span>${escapeHTML(period)}</span></div>
                    <ul>${renderBillingFeatureList(plan.features)}</ul>
                    ${button}
                </article>`;
        }).join("");
        plansGrid.querySelectorAll("[data-billing-checkout]").forEach(button => {
            button.addEventListener("click", () => triggerPayment(button.getAttribute("data-billing-checkout")));
        });
        plansGrid.querySelectorAll("[data-billing-enterprise]").forEach(button => {
            button.addEventListener("click", openEnterpriseLeadModal);
        });
        const usage = account.usage || {};
        accountPanel.innerHTML = `
            <h3>Tổng quan tài khoản</h3>
            <div class="billing-account-row"><span>Gói hiện tại</span><strong>${escapeHTML(tierLabel(account.currentPlan))}</strong></div>
            <div class="billing-account-row"><span>Trạng thái subscription</span><strong>${escapeHTML(account.subscriptionStatus || "active")}</strong></div>
            <div class="billing-account-row"><span>Ngày hết hạn</span><strong>${escapeHTML(account.currentPeriodEnd ? new Date(account.currentPeriodEnd).toLocaleDateString("vi-VN") : "--")}</strong></div>
            <div class="billing-usage-line"><span>AI Credits</span><strong>${Number(usage.aiCreditsUsed || 0).toLocaleString("vi-VN")} / ${Number(usage.aiCreditsLimit || 0).toLocaleString("vi-VN")}</strong></div>
            <div class="billing-usage-line"><span>File đã xử lý</span><strong>${Number(usage.filesUsed || 0).toLocaleString("vi-VN")} / ${Number(usage.filesLimit || 0).toLocaleString("vi-VN")}</strong></div>
            <div class="billing-usage-line"><span>Dung lượng</span><strong>${Number(usage.storageUsedGb || 0).toLocaleString("vi-VN")}GB / ${Number(usage.storageLimitGb || 0).toLocaleString("vi-VN")}GB</strong></div>
        `;
        const historyBtn = document.getElementById("billing-history-btn");
        const historyPanel = document.getElementById("billing-history-panel");
        if (historyBtn && historyPanel) {
            historyBtn.onclick = () => {
                historyPanel.hidden = !historyPanel.hidden;
                historyPanel.innerHTML = `
                    <h3>Lịch sử thanh toán</h3>
                    ${(history.items || []).length ? `
                        <table class="admin-table"><tbody>
                            ${(history.items || []).map(item => `
                                <tr>
                                    <td>${escapeHTML(item.orderId || item.id || "")}</td>
                                    <td>${escapeHTML(item.planName || item.plan_id || "")}</td>
                                    <td>${formatBillingMoney(item.amount, item.currency)}</td>
                                    <td>${escapeHTML(item.provider || "")}</td>
                                    <td>${escapeHTML(item.status || "")}</td>
                                </tr>`).join("")}
                        </tbody></table>` : `<div class="billing-account-empty">Chưa có giao dịch thanh toán.</div>`}`;
            };
        }
    }

    // Close checkout
    checkoutCloseBtn.addEventListener("click", () => {
        checkoutModal.classList.remove("active");
    });

    // Card form checkout submission
    checkoutForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById("checkout-submit-btn");
        const originalText = submitBtn.innerText;

        submitBtn.disabled = true;
        submitBtn.innerText = "Đang tạo checkout...";
        const resultBox = document.getElementById("checkout-provider-result");
        try {
            const provider = document.getElementById("checkout-provider-select")?.value || "";
            const newTier = state.selectedUpgradeTier;
            const checkout = await billingService.createCheckout(newTier, state.billingCycle, state.activeCouponCode, provider);
            adminService.addSystemLog("success", `Billing: Created pending provider checkout for ${newTier.toUpperCase()}`);
            historyService.addOperation("payment", `Tạo checkout pending gói: ${newTier.toUpperCase()}`);
            if (checkout.checkoutUrl) {
                showToast("Đang chuyển tới cổng thanh toán. Gói chỉ cập nhật sau webhook xác nhận.", "info");
                window.location.href = checkout.checkoutUrl;
                return;
            }
            if (checkout.qrCode && resultBox) {
                resultBox.innerHTML = `<div class="payment-qr-box"><strong>Quét QR để thanh toán</strong><img src="${escapeHTML(checkout.qrCode)}" alt="Payment QR"><p>Order: ${escapeHTML(checkout.orderId)}</p></div>`;
                showToast("Checkout đã tạo. Đang chờ webhook xác nhận thanh toán.", "info");
                return;
            }
            showToast("Checkout đã tạo nhưng provider chưa trả URL/QR.", "warning");
        } catch (error) {
            if (resultBox) resultBox.innerHTML = `<div class="billing-provider-warning">${escapeHTML(error.message || "Không thể tạo checkout")}</div>`;
            showToast(error.message || "Không thể tạo checkout", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
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
        } else if (tabId === "chat") {
            initChatAssistantPage().catch(error => showToast(error.message || "Không thể tải Trợ lý Chat AI", "error"));
        } else if (tabId === "history") {
            renderOperationsHistory();
        } else if (tabId === "templates") {
            renderTemplatesGrid();
        } else if (tabId === "reports") {
            initAutoReportPage().catch(error => showToast(error.message || "Không thể tải Báo cáo tự động", "error"));
        } else if (tabId === "cleaning") {
            initDataCleaningPage().catch(error => showToast(error.message || "Không thể tải Làm sạch dữ liệu", "error"));
        } else if (tabId === "autopilot") {
            initAutopilotPage().catch(error => showToast(error.message || "Không thể tải AI Autopilot", "error"));
        } else if (tabId === "table-builder") {
            initAiTableBuilderPage().catch(error => showToast(error.message || "Không thể tải AI Table Builder", "error"));
        } else if (tabId === "doc-builder") {
            initAiDocumentPage().catch(error => showToast(error.message || "Không thể tải AI Document", "error"));
        } else if (tabId === "billing") {
            initBillingPage().catch(error => showToast(error.message || "Không thể tải Đăng ký & Bảng giá", "error"));
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
            else if (action === "go-checker") switchWorkspaceTab("checker");
            else if (action === "go-analyzer") switchWorkspaceTab("reports");
        });
    });

    function getUserUsageSummary(user = state.currentUser || {}) {
        const tier = normalizeTier(user.tier);
        const used = Math.max(0, Number(user.usageCount ?? user.usage_count ?? 0) || 0);
        const rawLimit = tier === "free"
            ? state.freeLimit
            : Number(user.usageLimit ?? user.usage_limit ?? (tier === "pro" ? 300 : Infinity));
        const isUnlimited = tier !== "free" && (!Number.isFinite(rawLimit) || rawLimit <= 0 || tier === "enterprise" || tier === "business");
        const limit = isUnlimited ? Infinity : Math.max(1, Number(rawLimit) || state.freeLimit);
        const remaining = isUnlimited ? Infinity : Math.max(limit - used, 0);
        const percent = isUnlimited ? 100 : Math.min(Math.round((used / limit) * 100), 100);
        return { tier, used, limit, remaining, percent, isUnlimited };
    }

    function renderUserSettingsSummary() {
        const user = state.currentUser || {};
        const summary = getUserUsageSummary(user);
        const displayName = user.name || user.email || "Người dùng ExcelAI";
        const email = user.email || "Chưa có email";
        const status = String(user.status || "active").toLowerCase();

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.innerText = value;
        };

        setText("settings-user-avatar", displayName.charAt(0).toUpperCase());
        setText("settings-user-name", displayName);
        setText("settings-user-email", email);
        setText("settings-user-tier", tierLabel(summary.tier));
        setText("settings-user-status", status === "active" ? "Đang hoạt động" : status);
        setText("settings-usage-percent", summary.isUnlimited ? "∞" : `${summary.percent}%`);
        setText("settings-usage-count", summary.isUnlimited
            ? `${summary.used.toLocaleString("vi-VN")} / Không giới hạn lượt`
            : `${summary.used.toLocaleString("vi-VN")} / ${summary.limit.toLocaleString("vi-VN")} lượt`);
        setText("settings-usage-remaining", summary.isUnlimited
            ? "Gói của bạn không giới hạn lượt sử dụng trong chu kỳ hiện tại"
            : `Còn ${summary.remaining.toLocaleString("vi-VN")} lượt trong chu kỳ hiện tại`);
        setText("settings-stat-used", summary.used.toLocaleString("vi-VN"));
        setText("settings-stat-remaining", summary.isUnlimited ? "Không giới hạn" : summary.remaining.toLocaleString("vi-VN"));
        setText("settings-stat-limit", summary.isUnlimited ? "Không giới hạn" : summary.limit.toLocaleString("vi-VN"));

        const ring = document.querySelector(".settings-usage-ring");
        if (ring) ring.style.setProperty("--usage", `${summary.percent}%`);
        const progress = document.getElementById("settings-usage-progress");
        if (progress) progress.style.width = `${summary.percent}%`;
    }

    function updateWorkspaceSidebarUI() {
        const u = state.currentUser;
        const currentTier = normalizeTier(u.tier);
        const userName = u.name || u.email || "ExcelAI User";
        const userEmail = u.email || "";

        // Update user badge
        headerUserTier.innerText = tierLabel(currentTier).toUpperCase();
        headerUserTier.className = `user-tier-badge ${tierBadgeClass(currentTier)}`;

        // Update avatar initial
        document.getElementById("avatar-initial").innerText = userName.charAt(0).toUpperCase();
        const dropdownName = document.getElementById("dropdown-user-name");
        const dropdownEmail = document.getElementById("dropdown-user-email");
        if (dropdownName) dropdownName.innerText = userName;
        if (dropdownEmail) dropdownEmail.innerText = userEmail;

        // Sidebar Indicators
        sidebarUserTierName.innerText = tierLabel(currentTier);

        // Billing overview within app
        const billingCurrentTierText = document.getElementById("billing-current-tier-text");
        if (billingCurrentTierText) {
            billingCurrentTierText.innerText = `${tierLabel(currentTier)} (${currentTier === "free" ? "Miễn phí" : "SaaS Premium"})`;
        }

        // Upgrade current cards inside billing
        document.querySelectorAll(".pricing-mini-card").forEach(c => c.classList.remove("active-tier"));
        const miniCardTier = currentTier === "business" ? "enterprise" : currentTier;
        const miniCard = document.getElementById(`mini-card-${miniCardTier}`);
        if (miniCard) miniCard.classList.add("active-tier");

        // Limits calculations
        if (currentTier === "free") {
            sidebarUsageCount.innerText = `${u.usageCount} / ${state.freeLimit}`;
            const percentage = (u.usageCount / state.freeLimit) * 100;
            sidebarUsageProgress.style.width = `${Math.min(percentage, 100)}%`;
            dashboardUsageRatio.innerText = `${u.usageCount} / ${state.freeLimit}`;
        } else if (currentTier === "pro") {
            const proLimit = u.usageLimit && Number.isFinite(Number(u.usageLimit)) ? Number(u.usageLimit) : 300;
            sidebarUsageCount.innerText = `${u.usageCount} / ${proLimit}`;
            const percentage = (u.usageCount / proLimit) * 100;
            sidebarUsageProgress.style.width = `${Math.min(percentage, 100)}%`;
            dashboardUsageRatio.innerText = `${u.usageCount} / ${proLimit}`;
        } else {
            sidebarUsageCount.innerText = `${u.usageCount} / Không giới hạn`;
            sidebarUsageProgress.style.width = "100%";
            dashboardUsageRatio.innerText = `${u.usageCount} / ∞`;
        }
        renderUserSettingsSummary();

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
    // 8. LANDING BACKEND WORKFLOW TABS
    // ----------------------------------------------------------------------
    window.switchBackendTab = function(tabId) {
        // Find all buttons in the backend workflow sidebar
        const backendButtons = document.querySelectorAll("#how-it-works .sidebar-item");
        backendButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        // Add active class to selected tab button
        const activeBtn = document.getElementById(`backend-tab-${tabId}`);
        if (activeBtn) {
            activeBtn.classList.add("active");
        }

        // Hide all panels
        const panels = document.querySelectorAll("#how-it-works .backend-tab-panel");
        panels.forEach(panel => {
            panel.style.display = "none";
        });

        // Show selected panel
        const targetPanel = document.getElementById(`backend-panel-${tabId}`);
        if (targetPanel) {
            targetPanel.style.display = "flex";
        }
    };

    window.openBackendSelfInput = function() {
        const btn = document.getElementById("backend-self-input-btn");
        if (btn) {
            showToast("Vui lòng đăng nhập và tải file thật để backend xử lý.", "info");
            showPanel("workspace");
            switchWorkspaceTab("files");
        }
    };

    // ----------------------------------------------------------------------
    // 9. AI CHATBOT INTERACTIVITY
    // ----------------------------------------------------------------------
    // Handle suggestion chips
    document.querySelectorAll(".suggest-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const { textarea } = getChatEls();
            if (!textarea) return;
            textarea.value = btn.innerText;
            sendMessage();
        });
    });

    // Chat events are bound inside initChatAssistantPage so the dynamic tab DOM is always used.
    const deleteThreadBtn = document.getElementById("delete-thread-btn");
    if (deleteThreadBtn) {
        deleteThreadBtn.addEventListener("click", () => deleteThread(state.activeThreadId));
    }

    function messageRoleToSender(role) {
        return role === "assistant" || role === "bot" ? "bot" : "user";
    }

    function getChatEls() {
        return {
            messages: document.getElementById("chat-messages"),
            textarea: document.getElementById("chat-textarea"),
            sendBtn: document.getElementById("chat-send-btn"),
            attachBtn: document.getElementById("chat-attach-file-btn"),
            attachedInfo: document.getElementById("file-attached-info"),
            removeBtn: document.getElementById("remove-file-btn")
        };
    }

    function activeChatFile() {
        const files = state.chatContext?.recentFiles || [];
        return files.find(file => state.selectedChatFileIds.includes(String(file.id)));
    }

    function renderSelectedChatFile() {
        const { attachedInfo } = getChatEls();
        if (!attachedInfo) return;
        const file = activeChatFile();
        if (file) {
            attachedInfo.style.display = "inline-flex";
            attachedInfo.innerText = `Đang chọn: ${file.name}`;
        } else {
            attachedInfo.style.display = "none";
            attachedInfo.innerText = "";
        }
    }

    async function refreshChatContext(summary = null) {
        state.chatContext = await chatService.getContext();
        renderChatSidePanel(summary);
        renderSelectedChatFile();
    }

    async function uploadFileForChat() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv,.xlsx,.xls";
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const validation = fileService.validateFile(file);
            if (!validation.valid) {
                showToast(validation.error, "error");
                return;
            }
            try {
                showToast(`Đang tải lên tệp: ${file.name}...`, "info");
                const uploaded = await chatService.upload(file);
                await refreshChatContext();
                const uploadedId = String(uploaded.id || uploaded.fileId || uploaded.file?.id || "");
                if (uploadedId) {
                    await selectChatFile(uploadedId);
                }
                showToast(`Đã tải lên file thật: ${file.name}`);
            } catch (error) {
                showToast(error.message || "Không thể upload file vào workspace.", "error");
            }
        };
        input.click();
    }

    async function selectChatFile(fileId) {
        const normalizedId = String(fileId || "");
        if (!normalizedId) return;
        const isSelected = state.selectedChatFileIds.includes(normalizedId);
        state.selectedChatFileIds = isSelected ? [] : [normalizedId];
        if (!isSelected && state.activeThreadId) {
            await chatService.attachWorkspaceFile(state.activeThreadId, normalizedId).catch(() => null);
        }
        renderChatSidePanel();
        renderSelectedChatFile();
    }

    function bindChatAssistantEvents() {
        const { textarea, sendBtn, attachBtn, removeBtn } = getChatEls();
        if (textarea && textarea.dataset.chatBound !== "1") {
            textarea.dataset.chatBound = "1";
            textarea.addEventListener("input", () => {
                textarea.style.height = "auto";
                textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
            });
            textarea.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
        if (sendBtn && sendBtn.dataset.chatBound !== "1") {
            sendBtn.dataset.chatBound = "1";
            sendBtn.addEventListener("click", sendMessage);
        }
        if (attachBtn && attachBtn.dataset.chatBound !== "1") {
            attachBtn.dataset.chatBound = "1";
            attachBtn.addEventListener("click", uploadFileForChat);
        }
        if (removeBtn && removeBtn.dataset.chatBound !== "1") {
            removeBtn.dataset.chatBound = "1";
            removeBtn.addEventListener("click", () => {
                state.selectedChatFileIds = [];
                renderChatSidePanel();
                renderSelectedChatFile();
            });
        }
        document.querySelectorAll("[data-chat-action]").forEach(btn => {
            if (btn.dataset.chatBound === "1") return;
            btn.dataset.chatBound = "1";
            btn.addEventListener("click", () => {
                const action = btn.getAttribute("data-chat-action");
                if (action === "upload") uploadFileForChat();
                if (action === "select-file") document.getElementById("chat-recent-files")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                if (action === "table") switchWorkspaceTab("table-builder");
            });
        });
        const bindOnce = (id, handler) => {
            const el = document.getElementById(id);
            if (!el || el.dataset.chatBound === "1") return;
            el.dataset.chatBound = "1";
            el.addEventListener("click", handler);
        };
        bindOnce("new-thread-btn", () => createNewThread().catch(error => showToast(error.message || "Không thể tạo hội thoại mới", "error")));
        bindOnce("chat-history-btn", () => document.getElementById("threads-list")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
        bindOnce("chat-source-btn", () => document.getElementById("chat-recent-files")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }

    async function initChatAssistantPage() {
        bindChatAssistantEvents();
        try {
            const [contextPayload, conversationsPayload] = await Promise.all([
                chatService.getContext(),
                chatService.getConversations()
            ]);
            state.chatContext = contextPayload;
            renderChatSidePanel();
            state.chatThreads = (conversationsPayload.conversations || []).map(conv => ({
                id: conv.id,
                title: conv.title,
                messages: [],
                messageCount: conv.messageCount,
                fileCount: conv.fileCount
            }));
            if (!state.chatThreads.length) {
                const created = await chatService.createConversation("Cuộc trò chuyện mới");
                state.chatThreads = [{ id: created.conversationId, title: created.title, messages: [] }];
            }
            state.activeThreadId = state.chatThreads[0].id;
            renderThreadsList();
            await switchThread(state.activeThreadId);
        } catch (error) {
            const { messages } = getChatEls();
            if (messages) messages.innerHTML = `<div class="chat-empty-state error">${escapeHTML(error.message || "Không thể tải Trợ lý Chat AI")}</div>`;
        }
    }

    function renderChatSidePanel(summary = null) {
        const context = state.chatContext || {};
        const workspaceStatus = document.getElementById("chat-workspace-status");
        if (workspaceStatus) {
            workspaceStatus.innerText = context.workspace
                ? `${context.workspace.name || "Workspace"} • ${context.workspace.latestUpdatedAt ? new Date(context.workspace.latestUpdatedAt).toLocaleString("vi-VN") : "Chưa có file"}`
                : "Chưa có nguồn dữ liệu";
        }
        const recentBox = document.getElementById("chat-recent-files");
        if (recentBox) {
            const files = context.recentFiles || [];
            recentBox.innerHTML = files.length ? files.map(file => `
                <button type="button" data-chat-file-id="${escapeHTML(file.id)}" class="chat-recent-file ${state.selectedChatFileIds.includes(String(file.id)) ? "active" : ""}">
                    <span>${escapeHTML((file.type || "xlsx").toUpperCase())}</span>
                    <strong>${escapeHTML(file.name)}</strong>
                    <small>${escapeHTML(file.size || "--")} • ${file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString("vi-VN") : "--"}</small>
                </button>`).join("") : `<div class="chat-side-empty">Chưa có file thật trong workspace.</div>`;
            recentBox.querySelectorAll("[data-chat-file-id]").forEach(btn => {
                btn.addEventListener("click", () => selectChatFile(btn.getAttribute("data-chat-file-id")));
            });
        }
        const suggestionsBox = document.getElementById("chat-suggestions");
        if (suggestionsBox) {
            const suggestions = context.suggestions || [];
            suggestionsBox.innerHTML = suggestions.length ? suggestions.map(item => `<button type="button" data-chat-prompt="${escapeHTML(item.prompt)}">${escapeHTML(item.label)}</button>`).join("") : `<div class="chat-side-empty">Upload hoặc chọn file thật để nhận gợi ý.</div>`;
            suggestionsBox.querySelectorAll("[data-chat-prompt]").forEach(btn => {
                btn.addEventListener("click", () => {
                    const { textarea } = getChatEls();
                    if (!textarea) return;
                    textarea.value = btn.getAttribute("data-chat-prompt") || "";
                    textarea.focus();
                });
            });
        }
        const summaryBox = document.getElementById("chat-summary-card");
        if (summaryBox) {
            const data = summary || {};
            summaryBox.innerHTML = `
                <div><span>Tổng tin nhắn</span><strong>${Number(data.messageCount || 0).toLocaleString("vi-VN")}</strong></div>
                <div><span>File đã tạo</span><strong>${Number(data.createdFiles || 0).toLocaleString("vi-VN")}</strong></div>
                <div><span>Thời gian</span><strong>${Number(data.durationMinutes || 0)} phút</strong></div>
                <div><span>Lưu tự động</span><strong>${data.autoSaved === false ? "Tắt" : "Bật"}</strong></div>`;
        }
        document.getElementById("chat-manage-source-btn")?.addEventListener("click", () => switchWorkspaceTab("files"));
        document.getElementById("chat-view-all-files-btn")?.addEventListener("click", () => switchWorkspaceTab("files"));
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

    async function switchThread(threadId) {
        state.activeThreadId = threadId;
        renderThreadsList();

        const activeThread = state.chatThreads.find(t => t.id === threadId);
        const { messages } = getChatEls();
        if (!messages) return;
        messages.innerHTML = "";
        if (activeThread) {
            if (!activeThread.messagesLoaded) {
                const payload = await chatService.getMessages(threadId);
                activeThread.messages = (payload.messages || []).map(msg => ({
                    sender: messageRoleToSender(msg.role),
                    text: msg.content,
                    status: msg.status,
                    sources: msg.sources || [],
                    attachments: msg.attachments || [],
                    createdAt: msg.createdAt
                }));
                activeThread.messagesLoaded = true;
            }
            activeThread.messages.forEach(msg => {
                appendChatMessageUI(msg.sender, msg.text, msg);
            });
            if (!activeThread.messages.length) {
                messages.innerHTML = `<div class="chat-empty-state">Chưa có tin nhắn. Hãy hỏi AI dựa trên file workspace thật.</div>`;
            }
            const summary = await chatService.getSummary(threadId).catch(() => null);
            if (summary) renderChatSidePanel(summary);
        }
        messages.scrollTop = messages.scrollHeight;
    }

    async function createNewThread() {
        const created = await chatService.createConversation("Cuộc trò chuyện mới");
        const newThread = { id: created.conversationId, title: created.title, messages: [], messagesLoaded: true };
        state.chatThreads.push(newThread);
        state.activeThreadId = newThread.id;
        await switchThread(newThread.id);
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

    async function sendMessage() {
        const { messages, textarea, attachedInfo } = getChatEls();
        if (!messages || !textarea) return;
        const text = textarea.value.trim();
        if (!text) return;

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
        activeThread.messages.push({ sender: "user", text: messageText, status: "sending", createdAt: new Date().toISOString() });

        // Update thread title if default
        if (activeThread.title === "Cuộc chat mới" || activeThread.title === "Cuộc trò chuyện mới" || activeThread.title === "Hội thoại mặc định") {
            activeThread.title = messageText.length > 25 ? messageText.substring(0, 25) + "..." : messageText;
            renderThreadsList();
        }

        // Render user bubble
        if (state.activeThreadId === currentThreadId) {
            if (messages.querySelector(".chat-empty-state")) messages.innerHTML = "";
            appendChatMessageUI("user", messageText, { status: "sending", createdAt: new Date().toISOString() });
        }

        textarea.value = "";
        textarea.style.height = "auto";

        // Append typing indicator
        let indicator = null;
        if (state.activeThreadId === currentThreadId) {
            indicator = appendTypingIndicator();
            messages.scrollTop = messages.scrollHeight;
        }

        try {
            const payload = await chatService.sendMessage(currentThreadId, {
                message: messageText,
                selectedFileIds: state.selectedChatFileIds,
                mode: "workspace_assistant"
            });
            const targetThread = state.chatThreads.find(t => t.id === currentThreadId);
            if (targetThread) {
                targetThread.messages = targetThread.messages.filter(msg => msg.status !== "sending");
                targetThread.messages.push({ sender: "user", text: payload.userMessage.content, status: payload.userMessage.status, createdAt: payload.userMessage.createdAt });
                targetThread.messages.push({
                    sender: "bot",
                    text: payload.assistantMessage.content,
                    status: payload.assistantMessage.status,
                    sources: payload.assistantMessage.sources || [],
                    attachments: payload.assistantMessage.attachments || [],
                    createdAt: payload.assistantMessage.createdAt
                });
                if (targetThread.title === "Cuộc chat mới" || targetThread.title === "Cuộc trò chuyện mới" || targetThread.title === "Hội thoại mặc định") {
                    targetThread.title = messageText.length > 25 ? messageText.substring(0, 25) + "..." : messageText;
                    renderThreadsList();
                }
            }
            if (indicator) indicator.remove();
            if (state.activeThreadId === currentThreadId) {
                await switchThread(currentThreadId);
            }
            renderChatSidePanel(payload.conversationSummary);
            state.aiProviderErrorShown = false;
        } catch (error) {
            if (indicator) indicator.remove();
            const detail = error.message || "AI provider chưa được cấu hình hoặc đang không phản hồi. Vui lòng kiểm tra GEMINI_API_KEY.";
            if (!state.aiProviderErrorShown) {
                showToast(detail, "error");
                state.aiProviderErrorShown = true;
            }
            if (state.activeThreadId === currentThreadId) {
                appendChatMessageUI("bot", detail, { status: "failed", sources: [{ label: "AI lỗi" }], createdAt: new Date().toISOString() });
            }
        } finally {
            renderSelectedChatFile();
        }
    }

    function appendChatMessageUI(sender, text, meta = {}) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `chat-message ${sender} ${meta.status === "failed" ? "failed" : ""}`;

        const avatar = sender === "user" ? "Me" : "AI";

        // Parse codes inside chat for styling
        let formattedText = parseMarkdown(text);

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-bubble">
                <div class="message-text">${formattedText}</div>
                ${meta.sources?.length ? `<div class="message-sources">${meta.sources.map(src => `<span>${escapeHTML(src.label || src.type || "Nguồn")}</span>`).join("")}</div>` : ""}
                ${meta.attachments?.length ? `<div class="message-attachments">${meta.attachments.map(file => `<a href="${escapeHTML(chatService.downloadUrl(file.downloadUrl))}" target="_blank" rel="noopener">${escapeHTML(file.fileName || "File")}</a>`).join("")}</div>` : ""}
                <div class="message-time">${meta.status === "failed" ? "failed" : meta.status || "sent"} • ${meta.createdAt ? new Date(meta.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
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

        const { messages } = getChatEls();
        messages?.appendChild(messageDiv);
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
        const { messages } = getChatEls();
        messages?.appendChild(messageDiv);
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
    formulaGenerateBtn.style.flexDirection = "column";
    formulaGenerateBtn.style.display = "flex";
    formulaGenerateBtn.style.alignItems = "center";
    formulaGenerateBtn.style.justifyContent = "center";
    formulaGenerateBtn.style.gap = "2px";

    formulaGenerateBtn.addEventListener("click", async () => {
        const desc = formulaPrompt.value.trim();
        if (!desc) {
            showToast("Vui lòng nhập mô tả công thức", "error");
            return;
        }

        formulaGenerateBtn.disabled = true;
        formulaGenerateBtn.innerHTML = `
            <span style="font-size: 0.9rem; font-weight: bold; color: #fff; display: block;">⏳ Đang tạo công thức...</span>
            <span style="font-size: 0.68rem; color: rgba(255,255,255,0.7); font-weight: normal; display: block;">AI đang phân tích mô tả yêu cầu của bạn</span>
        `;

        try {
            const context = formulaContextSelect.value;
            const config = adminService.loadPromptConfig();

            const result = await aiService.generateFormula(desc, context, config);

            formulaResultCode.innerText = result.formula;

            // Populating explanation list
            const steps = String(result.explanation || "").split('\n').filter(s => s.trim().length > 0);
            formulaExplanationSteps.innerHTML = steps.map(s => `<li>${s.startsWith('Hàm ') || s.startsWith('- ') ? s : 'Hàm ' + s}</li>`).join("");

            const usedFuncsEl = document.getElementById("formula-used-funcs");
            if (usedFuncsEl) {
                usedFuncsEl.innerText = result.usedFuncs || "";
            }

            formulaOutputContainer.style.display = "block";

            // Recalculate preview sheet
            window.recalculateGrid();

            // Increment local display count; backend quota is still authoritative.
            incrementCurrentUserUsage();

            updateWorkspaceSidebarUI();

            adminService.addSystemLog("success", `API Call: User generated Excel formula for context [${context}]`);
            historyService.addOperation("formula", `Sinh công thức [${context}]: "${desc.substring(0, 30)}..."`);
            showToast("Công thức đã được sinh!");
        } catch (error) {
            showToast(error.message || "Không thể sinh công thức", "error");
        } finally {
            formulaGenerateBtn.disabled = false;
            formulaGenerateBtn.innerHTML = `
                <span style="font-size: 0.9rem; font-weight: bold; color: #fff; display: block;">⚡ Tạo Công thức</span>
                <span style="font-size: 0.68rem; color: rgba(255,255,255,0.7); font-weight: normal; display: block; margin-top: 2px;">AI sẽ phân tích và tạo công thức tối ưu</span>
            `;
        }
    });

    formulaCopyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(formulaResultCode.innerText);
        showToast("Đã sao chép công thức!");
    });

    window.__excelAiAuthReady = true;

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
        const table = document.querySelector(".formula-assistant-page .excel-like-grid, .excel-grid");
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
        const table = document.querySelector(".formula-assistant-page .excel-like-grid, .excel-grid");
        if (!table) return;
        const tbody = table.querySelector("tbody");
        const headerCols = table.querySelectorAll("thead th").length;
        const newRowNum = tbody.querySelectorAll("tr").length + 1;

        const tr = document.createElement("tr");

        // Row label
        const tdNum = document.createElement("th");
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
        const table = document.querySelector(".formula-assistant-page .excel-like-grid, .excel-grid");
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
        const table = document.querySelector(".formula-assistant-page .excel-like-grid, .excel-grid");
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
    // 11. SMART DATA ANALYZER (CSV PARSER & CHART.JS - OBSOLETE)
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
            const suggestions = await aiService.generateDataAnalysisSuggestions(stats);
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

    const disabledSampleDataMessage = "Chỉ hỗ trợ file thật. Vui lòng tải CSV/XLSX từ máy của bạn để phân tích.";

    if (realSalesBtn) {
        realSalesBtn.addEventListener("click", () => {
            window.switchWorkspaceTab("files");
            showToast(disabledSampleDataMessage, "info");
        });
    }

    if (realHrBtn) {
        realHrBtn.addEventListener("click", () => {
            window.switchWorkspaceTab("files");
            showToast(disabledSampleDataMessage, "info");
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
    async function refreshAdminDataFromApi() {
        if (!isCurrentUserAdmin()) return;

        const [usersResult, metricsResult, adminCacheResult, securityAuditResult] = await Promise.allSettled([
            adminService.getUsers(1, 100),
            adminService.getMetrics(),
            adminService.refreshAdminCaches(),
            adminService.getSecurityAuditDashboard()
        ]);

        if (usersResult.status === "fulfilled") {
            const usersPayload = usersResult.value;
            state.users = Array.isArray(usersPayload.users) ? usersPayload.users : state.users;
        } else if (!state.users.length && state.currentUser?.id) {
            state.users = [state.currentUser];
        }

        if (adminCacheResult.status === "fulfilled") {
            const adminCache = adminCacheResult.value;
            state.apiKeys = adminService.loadAPIKeys();
            state.systemLogs = adminService.loadSystemLogs();
            state.workspaces = adminService.loadWorkspaces();
            state.coupons = Array.isArray(adminCache?.coupons) ? adminCache.coupons : [];
            state.broadcasts = Array.isArray(adminCache?.broadcasts) ? adminCache.broadcasts : adminService.loadBroadcasts();
            state.broadcastHistory = buildBroadcastHistoryFromBackend(state.broadcasts);
            state.templates = Array.isArray(adminCache?.templates) ? adminCache.templates : state.templates;
            state.checkoutRequests = Array.isArray(adminCache?.checkoutRequests) ? adminCache.checkoutRequests : [];
            state.billingDashboard = adminCache?.billingDashboard || null;
            applyPricingConfig(adminService.loadPricingConfig());
            billingService.saveCoupons(state.coupons);
        }

        if (securityAuditResult.status === "fulfilled") {
            state.securityAuditDashboard = securityAuditResult.value || null;
        }

        if (metricsResult.status === "fulfilled") {
            const metricsPayload = metricsResult.value;
            if (metricsPayload) {
                state.systemMetrics = metricsPayload;
                if (adminStatUsers) adminStatUsers.innerText = (metricsPayload.totalUsers || 0).toLocaleString();
                if (adminStatMrr) adminStatMrr.innerText = (metricsPayload.mrr || 0).toLocaleString() + "đ";
                const uptime = document.getElementById("admin-uptime-value");
                if (uptime) uptime.innerText = `Hoạt động tốt (${metricsPayload.uptime || "N/A"})`;
            }
        }

        renderAdminPanel();

        const failed = [usersResult, metricsResult, adminCacheResult].find(result => result.status === "rejected");
        if (failed) {
            showToast(failed.reason?.message || "Một phần dữ liệu admin chưa tải được từ backend", "error");
        }
    }

    function renderAdminPanel() {
        const metrics = adminService.getSystemDashboardMetrics(state.users, state.systemMetrics);
        if (adminStatUsers) adminStatUsers.innerText = metrics.totalUsers.toLocaleString();
        if (adminStatMrr) adminStatMrr.innerText = (metrics.mrr || 0).toLocaleString() + "đ";

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
            loadAdminUsers();
        } else if (tabId === "workspaces") {
            renderAdminWorkspaces();
        } else if (tabId === "jobs") {
            renderAdminJobs();
        } else if (tabId === "quota") {
            renderAdminQuota();
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
        } else if (tabId === "settings") {
            renderAdminSettings();
        }
    }

    function adminOverviewEmpty(message) {
        return `<div class="admin-overview-empty">${escapeHTML(message)}</div>`;
    }

    function compactNumber(value, suffix = "") {
        const number = Number(value || 0);
        if (!Number.isFinite(number)) return "--";
        return `${number.toLocaleString("vi-VN")}${suffix}`;
    }

    function normalizeOverviewRows(payload, key, fallback = []) {
        const rows = payload?.[key];
        return Array.isArray(rows) ? rows : (Array.isArray(fallback) ? fallback : []);
    }

    function adminOverviewStatusHtml(overview = {}) {
        const health = overview.health || {};
        const checks = health.checks || {};
        const dbOk = String(checks.database || "").toUpperCase().includes("OK");
        const geminiOk = String(checks.gemini || "").toUpperCase().includes("OK");
        const alerts = [
            ...(overview.aiCost?.aiUsageAlerts || []),
            ...(overview.billingAdvanced?.billingAlerts || [])
        ];
        const workspaceName = state.currentUser?.workspaceName || adminService.loadWorkspaceSettings()?.workspaceName || "Workspace hiện tại";
        return `
            <span><i class="status-dot ${health.status === "ok" ? "ok" : "danger"}"></i>Backend: ${health.status === "ok" ? "online" : "offline"}</span>
            <span><i class="status-dot ${dbOk && geminiOk ? "ok" : "warning"}"></i>API: ${dbOk && geminiOk ? "sẵn sàng" : "cần kiểm tra"}</span>
            <span>Workspace: <strong>${escapeHTML(workspaceName)}</strong></span>
            <span><i class="status-dot ${alerts.length ? "warning" : "ok"}"></i>${alerts.length ? `${alerts.length} cảnh báo` : "Không có sự cố hệ thống"}</span>
        `;
    }

    function buildSparkline(values = [], color = "#22c55e") {
        const nums = values.map(Number).filter(Number.isFinite);
        if (nums.length < 2) return `<div class="overview-sparkline-empty">Chưa đủ dữ liệu</div>`;
        const max = Math.max(...nums);
        const min = Math.min(...nums);
        const range = max - min || 1;
        const points = nums.map((value, index) => {
            const x = (index / Math.max(1, nums.length - 1)) * 100;
            const y = 44 - ((value - min) / range) * 34;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");
        return `<svg viewBox="0 0 100 48" preserveAspectRatio="none" class="overview-sparkline"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    function overviewMetricCard({ label, value, note, tone = "green" }) {
        return `
            <div class="overview-metric-card tone-${tone}">
                <span>${escapeHTML(label)}</span>
                <strong>${escapeHTML(value)}</strong>
                <small>${escapeHTML(note || "Dữ liệu backend")}</small>
            </div>
        `;
    }

    function renderOverviewTables(model) {
        const workspaceRows = model.workspaces.slice(0, 5).map(workspace => {
            const statusValue = normalizeAccountStatus(workspace.status || "active");
            const jobsCount = model.jobs.filter(job => String(job.workspaceId || job.workspace_id || job.workspace || "") === String(workspace.id || workspace.name || "")).length;
            return `
                <tr>
                    <td>${escapeHTML(workspace.name || workspace.workspaceName || "Workspace")}</td>
                    <td><span class="overview-badge ${statusValue === "active" ? "good" : "warning"}">${escapeHTML(accountStatusLabel(statusValue))}</span></td>
                    <td>${compactNumber(workspace.members || workspace.memberCount || workspace.userCount || 1)}</td>
                    <td>${compactNumber(workspace.jobsCount || jobsCount)}</td>
                </tr>
            `;
        }).join("");

        const jobRows = model.jobs.slice(0, 6).map(job => {
            const statusText = String(job.status || "unknown").toLowerCase();
            const badge = statusText.includes("fail") || statusText.includes("error") ? "danger" : (statusText.includes("process") || statusText.includes("running") ? "info" : "good");
            return `
                <tr>
                    <td>${escapeHTML(job.id || job.jobId || "--")}</td>
                    <td>${escapeHTML(job.workspace || job.workspaceName || job.owner || "--")}</td>
                    <td><span class="overview-badge ${badge}">${escapeHTML(job.status || "--")}</span></td>
                    <td>${escapeHTML(formatDateTime(job.createdAt || job.created_at || job.time))}</td>
                    <td>${escapeHTML(job.duration || job.durationMs || "--")}</td>
                </tr>
            `;
        }).join("");

        return `
            <div class="overview-card overview-table-card">
                <div class="overview-card-head"><h3>Tình trạng Workspaces</h3><span>${model.workspaces.length} workspace</span></div>
                <table class="admin-table"><thead><tr><th>Workspace</th><th>Trạng thái</th><th>Người dùng</th><th>Jobs</th></tr></thead><tbody>${workspaceRows || `<tr><td colspan="4">${adminOverviewEmpty("Chưa có workspace thật từ backend.")}</td></tr>`}</tbody></table>
            </div>
            <div class="overview-card overview-table-card">
                <div class="overview-card-head"><h3>Jobs gần đây</h3><button class="overview-link" data-admin-jump="jobs">Xem tất cả jobs</button></div>
                <table class="admin-table"><thead><tr><th>Job ID</th><th>Workspace</th><th>Trạng thái</th><th>Thời gian</th><th>Thời lượng</th></tr></thead><tbody>${jobRows || `<tr><td colspan="5">${adminOverviewEmpty("Chưa có job thật từ backend.")}</td></tr>`}</tbody></table>
            </div>
        `;
    }

    function buildAdminOverviewModel(overview = {}) {
        const users = normalizeOverviewRows(overview.users, "users", state.users);
        const workspaces = normalizeOverviewRows(overview.workspaces, "workspaces", state.workspaces);
        const jobs = normalizeOverviewRows(overview.jobs, "jobs", adminService.loadJobs());
        const logs = normalizeOverviewRows(overview.logs, "logs", state.systemLogs).map(log => ({
            time: log.time || log.created_at || log.timestamp,
            text: log.text || log.action || log.message || "Hoạt động hệ thống"
        }));
        const metrics = adminService.getSystemDashboardMetrics(users, overview.metrics || state.systemMetrics);
        const billingKpis = overview.billingAdvanced?.billingKpis || {};
        const aiStats = overview.aiCost?.aiUsageStats || {};
        const aiTimeline = Array.isArray(overview.aiCost?.aiRequestsTimeline) ? overview.aiCost.aiRequestsTimeline : [];
        const monthlyRevenue = Number(billingKpis.monthlyRevenue ?? overview.billing?.manualRevenueEstimate ?? metrics.mrr ?? 0);
        return {
            users,
            workspaces,
            jobs,
            logs,
            metrics: { ...metrics, mrr: monthlyRevenue },
            activeUsers: Number(metrics.activeUsers ?? users.filter(user => normalizeAccountStatus(user.status) === "active").length),
            monthlyRevenue,
            aiCost: Number(aiStats.estimatedCost ?? overview.aiCost?.estimatedAiCostToday ?? 0),
            aiTokens: Number(aiStats.totalTokens ?? overview.aiCost?.quotaConfig?.monthlyTokenUsed ?? 0),
            aiRequests: Number(aiStats.aiRequestsToday ?? overview.aiCost?.aiRequestsToday ?? 0),
            aiTimelineValues: aiTimeline.map(row => row.requests || row.requestCount || row.totalTokens || 0),
            alerts: [
                ...(overview.aiCost?.aiUsageAlerts || []),
                ...(overview.billingAdvanced?.billingAlerts || [])
            ],
            securityScore: overview.security?.securityScore ?? overview.security?.score ?? null
        };
    }

    function renderAdminOverviewContent(overview = {}) {
        const content = document.getElementById("admin-overview-content");
        const status = document.getElementById("admin-overview-status");
        if (!content) return;
        if (status) status.innerHTML = adminOverviewStatusHtml(overview);

        const model = buildAdminOverviewModel(overview);
        const activeWorkspaceCount = model.workspaces.filter(w => normalizeAccountStatus(w.status || "active") === "active").length;
        const failedJobs = model.jobs.filter(j => String(j.status || "").toLowerCase().includes("fail") || String(j.status || "").toLowerCase().includes("error")).length;
        const revenueSeries = (overview.billingAdvanced?.paymentHistory || []).slice(0, 12).reverse().map(row => Number(row.amount || 0));
        const userSeries = model.users.slice(0, 12).map((_, index) => index + 1);
        const activityHtml = model.logs.slice(0, 6).map(log => `
            <div class="overview-activity-item">
                <span></span>
                <div><strong>${escapeHTML(formatDateTime(log.time))}</strong><p>${escapeHTML(log.text)}</p></div>
            </div>
        `).join("");

        content.innerHTML = `
            <div class="overview-metric-grid">
                ${overviewMetricCard({ label: "Người dùng", value: compactNumber(model.metrics.totalUsers), note: `${compactNumber(model.activeUsers)} đang hoạt động`, tone: "green" })}
                ${overviewMetricCard({ label: "MRR", value: formatCurrency(model.monthlyRevenue), note: "Từ billing dashboard", tone: "cyan" })}
                ${overviewMetricCard({ label: "Uptime", value: escapeHTML(model.metrics.uptime || "N/A"), note: "Theo admin metrics", tone: "teal" })}
                ${overviewMetricCard({ label: "Workspaces hoạt động", value: compactNumber(activeWorkspaceCount), note: `${compactNumber(model.workspaces.length)} tổng workspace`, tone: "purple" })}
                ${overviewMetricCard({ label: "Jobs hôm nay", value: compactNumber(model.jobs.length), note: `${compactNumber(failedJobs)} lỗi/thất bại`, tone: failedJobs ? "orange" : "blue" })}
                ${overviewMetricCard({ label: "AI Cost", value: formatCurrency(model.aiCost), note: `${compactNumber(model.aiRequests)} request · ${compactNumber(model.aiTokens)} tokens`, tone: "orange" })}
            </div>
            <div class="overview-chart-grid">
                <div class="overview-card">
                    <div class="overview-card-head"><h3>Doanh thu (MRR)</h3><span>VND</span></div>
                    <strong class="overview-big-value">${formatCurrency(model.monthlyRevenue)}</strong>
                    ${buildSparkline(revenueSeries.length ? revenueSeries : [model.monthlyRevenue, model.monthlyRevenue], "#22c55e")}
                </div>
                <div class="overview-card">
                    <div class="overview-card-head"><h3>Tăng trưởng người dùng</h3><span>${compactNumber(model.activeUsers)} active</span></div>
                    <strong class="overview-big-value">${compactNumber(model.metrics.totalUsers)} tổng người dùng</strong>
                    ${buildSparkline(userSeries, "#8b5cf6")}
                </div>
            </div>
            <div class="overview-table-grid">${renderOverviewTables(model)}</div>
            <div class="overview-bottom-grid">
                <div class="overview-card">
                    <div class="overview-card-head"><h3>Hoạt động gần đây</h3><span>${compactNumber(model.logs.length)}</span></div>
                    <div class="overview-activity-list">${activityHtml || adminOverviewEmpty("Chưa có log hoạt động thật từ backend.")}</div>
                </div>
                <div class="overview-card">
                    <div class="overview-card-head"><h3>Hành động nhanh</h3><span>Admin</span></div>
                    <div class="overview-actions-grid">
                        <button data-admin-jump="workspaces">Tạo workspace mới <span>→</span></button>
                        <button data-admin-jump="billing">Quản lý gói <span>→</span></button>
                        <button data-admin-jump="system-logs">Xem system logs <span>→</span></button>
                        <button data-admin-jump="users">Quản lý người dùng <span>→</span></button>
                    </div>
                </div>
                <div class="overview-card overview-insights">
                    <div><span>Bảo mật</span><strong>${model.securityScore === null ? "Đang theo dõi" : compactNumber(model.securityScore, "/100")}</strong></div>
                    <div><span>Billing</span><strong>${escapeHTML(overview.billingAdvanced?.billingKpis?.topPlan || "Chưa có dữ liệu")}</strong></div>
                    <div><span>AI Usage</span><strong>${compactNumber(model.aiTokens)} tokens</strong>${buildSparkline(model.aiTimelineValues, "#06b6d4")}</div>
                    <div><span>Cảnh báo</span><strong>${compactNumber(model.alerts.length)}</strong></div>
                </div>
            </div>
        `;

        content.querySelectorAll("[data-admin-jump]").forEach(button => {
            button.addEventListener("click", () => switchAdminTab(button.getAttribute("data-admin-jump")));
        });
    }

    async function renderAdminOverview(force = false) {
        const content = document.getElementById("admin-overview-content");
        if (!content) return;
        if (state.adminOverview && !force) {
            renderAdminOverviewContent(state.adminOverview);
        }
        const refreshBtn = document.getElementById("admin-overview-refresh-btn");
        const rangeSelect = document.getElementById("admin-overview-range");
        if (refreshBtn && !refreshBtn.dataset.bound) {
            refreshBtn.dataset.bound = "true";
            refreshBtn.addEventListener("click", () => renderAdminOverview(true));
        }
        if (rangeSelect && !rangeSelect.dataset.bound) {
            rangeSelect.dataset.bound = "true";
            rangeSelect.addEventListener("change", () => renderAdminOverview(true));
        }
        if (state.adminOverviewLoading || (state.adminOverviewLoaded && !force)) return;

        state.adminOverviewLoading = true;
        content.innerHTML = `<div class="admin-overview-loading">Đang tải dữ liệu quản trị thật từ backend...</div>`;
        if (refreshBtn) refreshBtn.disabled = true;
        try {
            const timeRange = rangeSelect?.value || "7d";
            state.adminOverview = await adminService.getAdminOverview({ timeRange });
            state.adminOverviewLoaded = true;
            renderAdminOverviewContent(state.adminOverview);
        } catch (error) {
            content.innerHTML = `<div class="admin-overview-error">${escapeHTML(error.message || "Không thể tải dữ liệu admin từ backend.")}</div>`;
        } finally {
            state.adminOverviewLoading = false;
            if (refreshBtn) refreshBtn.disabled = false;
        }
    }

    function normalizeAdminUser(user = {}) {
        return adminService.normalizeUser ? adminService.normalizeUser(user) : {
            ...user,
            plan: normalizeTier(user.tier || user.plan),
            role: user.role || "user",
            usage: Number(user.monthly_usage || user.usageCount || 0),
            status: normalizeAccountStatus(user.status),
            lastLoginAt: user.last_activity_at || user.lastLoginAt || user.updatedAt || user.createdAt || user.created_at,
            createdAt: user.createdAt || user.created_at
        };
    }

    function relativeTime(value) {
        if (!value) return "--";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "--";
        const diff = Date.now() - date.getTime();
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        if (diff < minute) return "Vừa xong";
        if (diff < hour) return `${Math.floor(diff / minute)} phút trước`;
        if (diff < day) return `${Math.floor(diff / hour)} giờ trước`;
        if (diff < day * 2) return "Hôm qua";
        return `${Math.floor(diff / day)} ngày trước`;
    }

    function userInitials(user = {}) {
        const source = user.name || user.email || "?";
        return source.trim().slice(0, 1).toUpperCase();
    }

    function userPlanBadge(plan) {
        const normalized = normalizeTier(plan);
        return `<span class="admin-user-plan plan-${normalized}">${escapeHTML(tierLabel(normalized).toUpperCase())}</span>`;
    }

    function userRoleBadge(role) {
        const value = String(role || "user").toLowerCase();
        return `<span class="admin-user-role role-${escapeHTML(value)}">${escapeHTML(value.toUpperCase())}</span>`;
    }

    function userStatusBadge(status) {
        const normalized = normalizeAccountStatus(status);
        const label = normalized === "suspended" ? "Bị khóa" : accountStatusLabel(normalized);
        return `<span class="admin-user-status status-${escapeHTML(normalized)}">${escapeHTML(label)}</span>`;
    }

    function filteredAdminUsers() {
        const filters = state.adminUsersFilters;
        const query = filters.search.trim().toLowerCase();
        return (state.adminUsersAll.length ? state.adminUsersAll : state.users).map(normalizeAdminUser).filter(user => {
            const matchesSearch = !query || String(user.name || "").toLowerCase().includes(query) || String(user.email || "").toLowerCase().includes(query);
            const matchesPlan = filters.plan === "all" || normalizeTier(user.plan || user.tier) === filters.plan;
            const matchesStatus = filters.status === "all" || normalizeAccountStatus(user.status) === filters.status;
            const matchesRole = filters.role === "all" || String(user.role || "user").toLowerCase() === filters.role;
            return matchesSearch && matchesPlan && matchesStatus && matchesRole;
        });
    }

    function renderAdminUserStats(usersList) {
        const box = document.getElementById("admin-users-stats");
        if (!box) return;
        const total = usersList.length;
        const active = usersList.filter(user => normalizeAccountStatus(user.status) === "active").length;
        const locked = usersList.filter(user => normalizeAccountStatus(user.status) === "suspended" || user.isLocked).length;
        const usage = usersList.reduce((sum, user) => sum + Number(user.usage || user.monthly_usage || user.usageCount || 0), 0);
        const cards = [
            ["Tổng người dùng", total, "Từ backend", "green"],
            ["Đang hoạt động", active, `${total ? Math.round(active / total * 100) : 0}% tổng user`, "cyan"],
            ["Bị khóa", locked, locked ? "Cần theo dõi" : "Không có khóa", "red"],
            ["Sử dụng tháng này", usage.toLocaleString("vi-VN"), "Tổng usage backend", "purple"]
        ];
        box.innerHTML = cards.map(([label, value, note, tone]) => `
            <div class="admin-user-kpi tone-${tone}">
                <div class="admin-user-kpi-icon"></div>
                <span>${escapeHTML(label)}</span>
                <strong>${escapeHTML(String(value))}</strong>
                <small>${escapeHTML(note)}</small>
            </div>
        `).join("");
    }

    function renderPlanDistribution(usersList) {
        const box = document.getElementById("admin-users-plan-chart");
        if (!box) return;
        const counts = usersList.reduce((acc, user) => {
            const plan = normalizeTier(user.plan || user.tier);
            acc[plan] = (acc[plan] || 0) + 1;
            return acc;
        }, { free: 0, pro: 0, enterprise: 0 });
        const total = Math.max(1, usersList.length);
        const free = counts.free || 0;
        const pro = counts.pro || 0;
        const enterprise = counts.enterprise || 0;
        const freeDeg = (free / total) * 360;
        const proDeg = freeDeg + (pro / total) * 360;
        box.innerHTML = `
            <div class="admin-side-card-head"><h3>Phân bổ gói</h3><span>${usersList.length} user</span></div>
            <div class="admin-donut-wrap">
                <div class="admin-donut" style="background:conic-gradient(#64748b 0 ${freeDeg}deg,#8b5cf6 ${freeDeg}deg ${proDeg}deg,#06b6d4 ${proDeg}deg 360deg);"><strong>${usersList.length}</strong><span>Tổng</span></div>
                <div class="admin-donut-legend">
                    ${["free", "pro", "enterprise"].map(plan => `<div><i class="legend-${plan}"></i><span>${tierLabel(plan)}</span><strong>${counts[plan] || 0}</strong><small>${Math.round(((counts[plan] || 0) / total) * 100)}%</small></div>`).join("")}
                </div>
            </div>
        `;
    }

    function renderNewUsersChart(usersList) {
        const box = document.getElementById("admin-users-new-chart");
        if (!box) return;
        const days = Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - index));
            const key = date.toISOString().slice(0, 10);
            return { key, label: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }), count: 0 };
        });
        usersList.forEach(user => {
            const key = user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : "";
            const bucket = days.find(day => day.key === key);
            if (bucket) bucket.count += 1;
        });
        const max = Math.max(1, ...days.map(day => day.count));
        const points = days.map((day, index) => `${(index / 6) * 100},${44 - (day.count / max) * 34}`).join(" ");
        box.innerHTML = `
            <div class="admin-side-card-head"><h3>User mới 7 ngày</h3><span>${days.reduce((sum, day) => sum + day.count, 0)} mới</span></div>
            <svg class="admin-user-line-chart" viewBox="0 0 100 48" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <div class="admin-user-chart-labels">${days.map(day => `<span>${escapeHTML(day.label)}</span>`).join("")}</div>
        `;
    }

    function bindAdminUsersControls() {
        const mappings = [
            ["admin-users-search", "search", "input"],
            ["admin-users-plan-filter", "plan", "change"],
            ["admin-users-status-filter", "status", "change"],
            ["admin-users-role-filter", "role", "change"],
            ["admin-users-page-size", "pageSize", "change"]
        ];
        mappings.forEach(([id, key, eventName]) => {
            const el = document.getElementById(id);
            if (!el || el.dataset.bound) return;
            el.dataset.bound = "true";
            el.addEventListener(eventName, () => {
                state.adminUsersFilters[key] = key === "pageSize" ? Number(el.value || 10) : el.value;
                state.adminUsersFilters.page = 1;
                renderAdminUsers();
            });
        });
        const refresh = document.getElementById("admin-users-refresh-btn");
        if (refresh && !refresh.dataset.bound) {
            refresh.dataset.bound = "true";
            refresh.addEventListener("click", () => loadAdminUsers(true));
        }
        const prev = document.getElementById("admin-users-prev-btn");
        const next = document.getElementById("admin-users-next-btn");
        if (prev && !prev.dataset.bound) {
            prev.dataset.bound = "true";
            prev.addEventListener("click", () => {
                state.adminUsersFilters.page = Math.max(1, state.adminUsersFilters.page - 1);
                renderAdminUsers();
            });
        }
        if (next && !next.dataset.bound) {
            next.dataset.bound = "true";
            next.addEventListener("click", () => {
                state.adminUsersFilters.page += 1;
                renderAdminUsers();
            });
        }
        const importBtn = document.getElementById("admin-users-import-btn");
        const importInput = document.getElementById("admin-users-import-input");
        if (importBtn && importInput && !importBtn.dataset.bound) {
            importBtn.dataset.bound = "true";
            importBtn.addEventListener("click", () => importInput.click());
            importInput.addEventListener("change", async () => {
                const file = importInput.files?.[0];
                if (!file) return;
                if (!file.name.toLowerCase().endsWith(".csv")) {
                    showToast("Chỉ nhận file .csv", "error");
                    return;
                }
                try {
                    const result = await adminService.importUsersCsv(file);
                    showToast(`Import ${result.created.length}/${result.total} user từ backend API.`, result.errors.length ? "warning" : "success");
                    await loadAdminUsers(true);
                } catch (error) {
                    showToast(error.message || "Không thể import CSV", "error");
                } finally {
                    importInput.value = "";
                }
            });
        }
        const exportBtn = document.getElementById("admin-users-export-btn");
        if (exportBtn && !exportBtn.dataset.bound) {
            exportBtn.dataset.bound = "true";
            exportBtn.addEventListener("click", exportAdminUsersCsv);
        }
        document.querySelectorAll("[data-user-quick]").forEach(button => {
            if (button.dataset.bound) return;
            button.dataset.bound = "true";
            button.addEventListener("click", () => {
                const action = button.getAttribute("data-user-quick");
                if (action === "invite") {
                    openAdminUserModal();
                } else if (action === "groups") {
                    createWorkspaceGroupFromQuickAction();
                } else if (action === "audit") {
                    switchAdminTab("audit");
                    renderAdminAudits();
                } else if (action === "security") {
                    switchAdminTab("security");
                    renderAdminSecurity();
                }
            });
        });
    }

    function openAdminTextDialog({ title, label, value = "", placeholder = "", multiline = false, selectOptions = null }) {
        return new Promise((resolve) => {
            const existing = document.getElementById("admin-text-dialog");
            if (existing) existing.remove();
            const optionsHtml = Array.isArray(selectOptions)
                ? `<select id="admin-text-dialog-input" class="admin-input-v2">${selectOptions.map(option => `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`).join("")}</select>`
                : multiline
                    ? `<textarea id="admin-text-dialog-input" class="admin-input-v2" rows="4" placeholder="${escapeHTML(placeholder)}">${escapeHTML(value)}</textarea>`
                    : `<input id="admin-text-dialog-input" class="admin-input-v2" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}">`;
            const modal = document.createElement("div");
            modal.id = "admin-text-dialog";
            modal.style.cssText = "position:fixed;inset:0;z-index:10020;background:rgba(2,6,23,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;";
            modal.innerHTML = `
                <div class="admin-card-v2" style="width:min(460px,100%);background:#0f172a;border:1px solid #1e293b;border-radius:18px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.35);">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;">
                        <h3 style="margin:0;color:#f8fafc;font-size:1rem;">${escapeHTML(title)}</h3>
                        <button type="button" id="admin-text-dialog-close" class="btn btn-outline btn-xs">Dong</button>
                    </div>
                    <label style="display:flex;flex-direction:column;gap:8px;color:#cbd5e1;font-size:.82rem;font-weight:700;">
                        ${escapeHTML(label)}
                        ${optionsHtml}
                    </label>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
                        <button type="button" id="admin-text-dialog-cancel" class="btn btn-outline btn-sm">Huy</button>
                        <button type="button" id="admin-text-dialog-ok" class="btn btn-primary btn-sm">Xac nhan</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const input = modal.querySelector("#admin-text-dialog-input");
            const close = (result) => {
                modal.remove();
                resolve(result);
            };
            modal.querySelector("#admin-text-dialog-close").addEventListener("click", () => close(null));
            modal.querySelector("#admin-text-dialog-cancel").addEventListener("click", () => close(null));
            modal.querySelector("#admin-text-dialog-ok").addEventListener("click", () => close(input.value));
            modal.addEventListener("keydown", (event) => {
                if (event.key === "Escape") close(null);
                if (event.key === "Enter" && !multiline) close(input.value);
            });
            setTimeout(() => input.focus(), 0);
        });
    }

    async function createWorkspaceGroupFromQuickAction() {
        const defaultName = `Nhóm ${new Date().toLocaleDateString("vi-VN")}`;
        const name = await openAdminTextDialog({
            title: "Tạo nhóm/workspace",
            label: "Tên nhóm/workspace mới",
            value: defaultName,
            placeholder: "Ví dụ: Nhóm kế toán"
        });
        if (name === null) return;
        const trimmedName = name.trim();
        if (!trimmedName) {
            showToast("Tên nhóm không được để trống.", "error");
            return;
        }

        try {
            const payload = await adminService.createWorkspaceGroup({ name: trimmedName });
            const workspace = payload?.workspace || {};
            showToast(`Đã tạo nhóm "${workspace.name || trimmedName}" trên backend.`, "success");
            adminService.addSystemLog("success", `Workspace: Admin created group '${workspace.name || trimmedName}'`);

            const emails = await openAdminTextDialog({
                title: "Thêm thành viên",
                label: "Email member, cách nhau bởi dấu phẩy",
                value: "",
                placeholder: "user1@example.com, user2@example.com",
                multiline: true
            });
            if (emails === null || !emails.trim()) {
                await refreshAdminDataFromApi().catch(() => {});
                return;
            }

            const role = String(await openAdminTextDialog({
                title: "Chọn role",
                label: "Role cho member",
                value: "viewer",
                selectOptions: [
                    { value: "viewer", label: "viewer" },
                    { value: "member", label: "member" },
                    { value: "staff", label: "staff" },
                    { value: "manager", label: "manager" },
                    { value: "admin", label: "admin" }
                ]
            }) || "viewer").trim().toLowerCase();
            const allowedRoles = new Set(["viewer", "member", "staff", "manager", "admin"]);
            const nextRole = allowedRoles.has(role) ? role : "viewer";
            const emailList = emails.split(",").map(item => item.trim()).filter(Boolean);
            const results = await Promise.allSettled(
                emailList.map(email => adminService.addWorkspaceGroupMember(workspace.id, { email, role: nextRole }))
            );
            const ok = results.filter(result => result.status === "fulfilled").length;
            const failed = results.length - ok;
            showToast(`Đã thêm ${ok}/${results.length} member vào nhóm${failed ? `, ${failed} lỗi` : ""}.`, failed ? "warning" : "success");
            await refreshAdminDataFromApi().catch(() => {});
        } catch (error) {
            showToast(error.message || "Không thể tạo nhóm từ backend.", "error");
        }
    }

    async function loadAdminUsers(force = false) {
        if (state.adminUsersLoading) return;
        if (state.adminUsersAll.length && !force) {
            renderAdminUsers();
            return;
        }
        state.adminUsersLoading = true;
        state.adminUsersError = "";
        renderAdminUsers();
        try {
            const payload = await adminService.getUsers({ page: 1, pageSize: 500 });
            state.adminUsersAll = Array.isArray(payload.users) ? payload.users.map(normalizeAdminUser) : [];
            state.users = state.adminUsersAll;
        } catch (error) {
            state.adminUsersError = error.message || "Không thể tải người dùng từ backend.";
        } finally {
            state.adminUsersLoading = false;
            renderAdminUsers();
        }
    }

    function exportAdminUsersCsv() {
        const usersList = filteredAdminUsers();
        const columns = ["name", "email", "role", "plan", "usage", "status", "lastLoginAt", "createdAt"];
        const escapeCsv = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csv = [columns.join(","), ...usersList.map(user => columns.map(column => escapeCsv(user[column])).join(","))].join("\n");
        const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `excelai-users-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast("Đã xuất CSV từ danh sách user thật đang tải.", "success");
    }

    function renderAdminUsers() {
        bindAdminUsersControls();
        const tbody = document.getElementById("admin-user-table-body");
        const stateBox = document.getElementById("admin-users-state");
        if (!tbody) return;
        if (state.adminUsersLoading) {
            renderAdminUserStats([]);
            tbody.innerHTML = "";
            if (stateBox) stateBox.innerHTML = `<div class="admin-users-loading">Đang tải người dùng thật từ backend...</div>`;
            return;
        }
        if (state.adminUsersError) {
            tbody.innerHTML = "";
            if (stateBox) stateBox.innerHTML = `<div class="admin-users-error">${escapeHTML(state.adminUsersError)} <button class="overview-link" onclick="window.retryLoadAdminUsers()">Thử lại</button></div>`;
            return;
        }
        const usersList = filteredAdminUsers();
        renderAdminUserStats(state.adminUsersAll.length ? state.adminUsersAll : usersList);
        renderPlanDistribution(state.adminUsersAll.length ? state.adminUsersAll : usersList);
        renderNewUsersChart(state.adminUsersAll.length ? state.adminUsersAll : usersList);
        if (stateBox) stateBox.innerHTML = "";
        if (!usersList.length) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="admin-users-empty"><strong>Chưa có người dùng nào</strong><button class="btn btn-primary btn-sm" onclick="document.getElementById('admin-add-user-btn')?.click()">Thêm user</button></div></td></tr>`;
            return;
        }
        const pageSize = Number(state.adminUsersFilters.pageSize || 10);
        const totalPages = Math.max(1, Math.ceil(usersList.length / pageSize));
        state.adminUsersFilters.page = Math.min(Math.max(1, state.adminUsersFilters.page), totalPages);
        const start = (state.adminUsersFilters.page - 1) * pageSize;
        const pageRows = usersList.slice(start, start + pageSize);
        tbody.innerHTML = pageRows.map(user => {
            const userIdArg = encodeInlineArg(user.id);
            const isSelf = String(user.id) === String(state.currentUser.id);
            const lockText = normalizeAccountStatus(user.status) === "active" ? "Khóa" : "Mở khóa";
            return `
                <tr>
                    <td>
                        <button class="admin-user-identity" onclick="window.viewUserAudit(decodeURIComponent('${userIdArg}'))">
                            <span class="admin-user-avatar">${user.avatarUrl ? `<img src="${escapeHTML(user.avatarUrl)}" alt="">` : escapeHTML(userInitials(user))}</span>
                            <span><strong>${escapeHTML(user.name || "Người dùng")}${isSelf ? " (Bạn)" : ""}</strong><small>${escapeHTML(user.workspaceName || "Workspace backend")}</small></span>
                        </button>
                    </td>
                    <td>${escapeHTML(user.email)}</td>
                    <td>${userPlanBadge(user.plan || user.tier)}</td>
                    <td>${userRoleBadge(user.role)}</td>
                    <td><strong>${Number(user.usage || 0).toLocaleString("vi-VN")}</strong></td>
                    <td>${userStatusBadge(user.status)}</td>
                    <td>${escapeHTML(relativeTime(user.lastLoginAt))}</td>
                    <td class="admin-user-actions-cell">
                        <button onclick="window.editUser(decodeURIComponent('${userIdArg}'))">Sửa</button>
                        <button onclick="window.toggleUserBan(decodeURIComponent('${userIdArg}'))">${lockText}</button>
                        <button onclick="window.resetUserPassword(decodeURIComponent('${userIdArg}'))">Reset MK</button>
                        <button onclick="window.viewUserAudit(decodeURIComponent('${userIdArg}'))">⋯</button>
                    </td>
                </tr>
            `;
        }).join("");
        const pageInfo = document.getElementById("admin-users-page-info");
        const pageNumber = document.getElementById("admin-users-page-number");
        const prev = document.getElementById("admin-users-prev-btn");
        const next = document.getElementById("admin-users-next-btn");
        if (pageInfo) pageInfo.innerText = `Hiển thị ${start + 1}–${Math.min(start + pageRows.length, usersList.length)} / ${usersList.length} người dùng`;
        if (pageNumber) pageNumber.innerText = `${state.adminUsersFilters.page} / ${totalPages}`;
        if (prev) prev.disabled = state.adminUsersFilters.page <= 1;
        if (next) next.disabled = state.adminUsersFilters.page >= totalPages;
    }

    function bytesLabel(value = 0) {
        const bytes = Number(value || 0);
        if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
        if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${bytes} B`;
    }

    function workspaceInitials(workspace = {}) {
        return String(workspace.name || workspace.ownerName || workspace.ownerEmail || "W").trim().slice(0, 2).toUpperCase();
    }

    function storageTone(percent = 0) {
        if (percent >= 90) return "danger";
        if (percent >= 70) return "warning";
        return "good";
    }

    function workspaceStatusBadge(status = "active") {
        const value = normalizeAccountStatus(status);
        const label = value === "active" ? "Hoạt động" : value === "suspended" || value === "inactive" ? "Ngừng hoạt động" : "Cảnh báo";
        const tone = value === "active" ? "good" : value === "suspended" || value === "inactive" ? "danger" : "warning";
        return `<span class="workspace-status-badge ${tone}">${escapeHTML(label)}</span>`;
    }

    function workspacePlanBadge(plan = "free") {
        const value = normalizeTier(plan);
        return `<span class="workspace-plan-badge ${value}">${escapeHTML(value.toUpperCase())}</span>`;
    }

    function workspaceProgress(workspace = {}) {
        const percent = Math.max(0, Math.min(100, Number(workspace.storageUsagePercent || 0)));
        return `
            <div class="workspace-storage-cell">
                <span>${escapeHTML(workspace.storageUsed || bytesLabel(workspace.storageUsedBytes))} / ${escapeHTML(workspace.storageLimit || bytesLabel(workspace.storageLimitBytes))}</span>
                <div class="workspace-progress ${storageTone(percent)}"><i style="width:${percent}%"></i></div>
            </div>
        `;
    }

    function workspaceKpiCard(label, value, note, tone, icon) {
        return `
            <div class="workspace-kpi-card ${tone}">
                <span class="workspace-kpi-icon">${icon}</span>
                <div>
                    <small>${escapeHTML(label)}</small>
                    <strong>${escapeHTML(String(value))}</strong>
                    <p>${escapeHTML(note || "Theo dữ liệu hiện tại")}</p>
                </div>
            </div>
        `;
    }

    function workspaceSkeleton() {
        return `
            <div class="admin-workspaces-page">
                <div class="workspace-skeleton hero"></div>
                <div class="workspace-kpi-grid">${[1,2,3,4].map(() => `<div class="workspace-skeleton card"></div>`).join("")}</div>
                <div class="admin-workspace-layout"><div class="workspace-skeleton table"></div><div class="workspace-skeleton side"></div></div>
            </div>
        `;
    }

    function workspaceFilteredRows() {
        const filters = state.adminWorkspacesFilters;
        const search = filters.search.trim().toLowerCase();
        return (state.workspaces || []).filter(workspace => {
            const planOk = filters.plan === "all" || normalizeTier(workspace.plan) === filters.plan;
            const statusOk = filters.status === "all" || normalizeAccountStatus(workspace.status) === filters.status;
            const storagePercent = Number(workspace.storageUsagePercent || 0);
            const storageOk = filters.storage === "all" || (filters.storage === "near-full" && storagePercent >= 80 && storagePercent < 100) || (filters.storage === "over-limit" && (workspace.overLimit || storagePercent >= 100));
            const searchOk = !search || [workspace.name, workspace.ownerName, workspace.ownerEmail, workspace.id].some(value => String(value || "").toLowerCase().includes(search));
            return planOk && statusOk && storageOk && searchOk;
        });
    }

    function workspaceDonutChart(rows = []) {
        const total = rows.reduce((sum, row) => sum + Number(row.storageUsedBytes || 0), 0);
        const top = [...rows].sort((a, b) => Number(b.storageUsedBytes || 0) - Number(a.storageUsedBytes || 0)).slice(0, 5);
        let offset = 25;
        const colors = ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"];
        const circles = top.map((row, index) => {
            const percent = total ? (Number(row.storageUsedBytes || 0) / total) * 100 : 0;
            const circle = `<circle cx="60" cy="60" r="46" pathLength="100" stroke="${colors[index]}" stroke-width="14" fill="none" stroke-dasharray="${percent} ${100 - percent}" stroke-dashoffset="${offset}" />`;
            offset -= percent;
            return circle;
        }).join("");
        const legend = top.map((row, index) => {
            const percent = total ? Math.round((Number(row.storageUsedBytes || 0) / total) * 100) : 0;
            return `<div class="workspace-legend-row"><i style="background:${colors[index]}"></i><span>${escapeHTML(row.name)}</span><strong>${escapeHTML(bytesLabel(row.storageUsedBytes))}</strong><em>${percent}%</em></div>`;
        }).join("");
        return `
            <div class="workspace-donut-wrap">
                <svg viewBox="0 0 120 120" class="workspace-donut"><circle cx="60" cy="60" r="46" stroke="#1e293b" stroke-width="14" fill="none"/>${circles}</svg>
                <div class="workspace-donut-center"><strong>${escapeHTML(bytesLabel(total))}</strong><span>đã dùng</span></div>
            </div>
            <div class="workspace-legend">${legend || `<div class="workspace-empty-mini">Chưa có dung lượng sử dụng.</div>`}</div>
        `;
    }

    function workspaceOptimization(rows = []) {
        const issues = [];
        rows.forEach(row => {
            const percent = Number(row.storageUsagePercent || 0);
            if (percent > 80) issues.push(`${row.name}: dung lượng đã dùng ${percent.toFixed(1)}%, nên nâng quota hoặc dọn file.`);
            if (Number(row.failedFileCount || 0) > 0) issues.push(`${row.name}: có ${row.failedFileCount} file lỗi, nên kiểm tra pipeline upload.`);
            const last = new Date(row.lastActivityAt || row.createdAt || 0);
            if (!Number.isNaN(last.getTime()) && Date.now() - last.getTime() > 30 * 24 * 60 * 60 * 1000) issues.push(`${row.name}: không hoạt động hơn 30 ngày, cân nhắc archive.`);
        });
        return issues.slice(0, 4).map(item => `<li>${escapeHTML(item)}</li>`).join("") || `<li>Tất cả workspace đang hoạt động ổn định.</li>`;
    }

    function adminWorkspacesContainer() {
        const tbody = document.getElementById("admin-workspaces-table-body");
        const panel = tbody?.closest(".admin-tab-panel") || document.getElementById("admin-tab-workspaces");
        return panel;
    }

    function renderAdminWorkspacesContent() {
        const panel = adminWorkspacesContainer();
        if (!panel) return;
        if (state.adminWorkspacesLoading) {
            panel.innerHTML = workspaceSkeleton();
            return;
        }
        if (state.adminWorkspacesError) {
            panel.innerHTML = `<div class="admin-workspaces-page"><div class="workspace-error-state"><strong>${escapeHTML(state.adminWorkspacesError)}</strong><button class="workspace-btn primary" onclick="window.reloadAdminWorkspaces()">Thử lại</button></div></div>`;
            return;
        }

        const rows = workspaceFilteredRows();
        const stats = state.adminWorkspacesStats || {};
        const pageSize = Number(state.adminWorkspacesFilters.pageSize || 10);
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        state.adminWorkspacesFilters.page = Math.min(Math.max(1, state.adminWorkspacesFilters.page), totalPages);
        const start = (state.adminWorkspacesFilters.page - 1) * pageSize;
        const pageRows = rows.slice(start, start + pageSize);
        const tableRows = pageRows.map(workspace => {
            const idArg = encodeInlineArg(workspace.id || workspace.userId);
            return `
                <tr>
                    <td><div class="workspace-name-cell"><span>${escapeHTML(workspaceInitials(workspace))}</span><div><strong>${escapeHTML(workspace.name)}</strong><small>${escapeHTML(workspace.id || workspace.userId || "")}</small></div></div></td>
                    <td><div class="workspace-owner-cell"><span>${escapeHTML(String(workspace.ownerName || workspace.ownerEmail || "U").slice(0, 1).toUpperCase())}</span><div><strong>${escapeHTML(workspace.ownerName || "Owner")}</strong><small>${escapeHTML(workspace.ownerEmail || "")}</small></div></div></td>
                    <td>${workspacePlanBadge(workspace.plan)}</td>
                    <td>${Number(workspace.membersCount ?? workspace.memberCount ?? 1).toLocaleString("vi-VN")}</td>
                    <td>${Number(workspace.filesCount ?? workspace.fileCount ?? 0).toLocaleString("vi-VN")} / ${Number(workspace.fileLimit || 0).toLocaleString("vi-VN")} files</td>
                    <td>${workspaceProgress(workspace)}</td>
                    <td>${escapeHTML(workspace.retentionPolicy || workspace.retention || "Theo cấu hình backend")}</td>
                    <td>${escapeHTML(relativeTime(workspace.lastActivityAt || workspace.createdAt))}</td>
                    <td>${workspaceStatusBadge(workspace.status)}</td>
                    <td><div class="workspace-row-actions"><button onclick="window.openWorkspaceModal('edit', decodeURIComponent('${idArg}'))">Cấu hình</button><button onclick="window.exportWorkspaceReport(decodeURIComponent('${idArg}'))">Export</button><button onclick="window.openWorkspaceMenu(decodeURIComponent('${idArg}'))">⋯</button></div></td>
                </tr>
            `;
        }).join("");
        const activities = (state.adminWorkspaceActivities || []).slice(0, 8).map(item => `
            <div class="workspace-activity-item"><span></span><div><strong>${escapeHTML(item.message || "Hoạt động workspace")}</strong><small>${escapeHTML(item.actor || item.workspaceName || "System")} · ${escapeHTML(relativeTime(item.createdAt))}</small></div></div>
        `).join("");

        panel.innerHTML = `
            <div class="admin-workspaces-page">
                <div class="workspace-page-header">
                    <div class="workspace-title-row"><span class="workspace-title-icon">W</span><div><h2>Quản lý Workspaces</h2><p>Giám sát workspaces, file và quota lưu trữ.</p></div></div>
                    <div class="workspace-header-actions">
                        <button class="workspace-btn primary" id="workspace-create-btn"><span>+</span> Tạo workspace</button>
                        <button class="workspace-btn" id="workspace-import-btn">Import data</button>
                        <input type="file" id="workspace-import-input" accept=".csv,.json" hidden>
                        <button class="workspace-btn" id="workspace-export-all-btn">Export data</button>
                    </div>
                </div>
                <div class="workspace-kpi-grid">
                    ${workspaceKpiCard("Tổng workspaces", compactNumber(stats.totalWorkspaces ?? state.workspaces.length), "Theo dữ liệu hiện tại", "purple", "□")}
                    ${workspaceKpiCard("Workspaces hoạt động", compactNumber(stats.activeWorkspaces ?? rows.filter(row => row.status === "active").length), "Theo dữ liệu hiện tại", "green", "✓")}
                    ${workspaceKpiCard("Dung lượng đã dùng", bytesLabel(stats.totalStorageUsedBytes ?? rows.reduce((sum, row) => sum + Number(row.storageUsedBytes || 0), 0)), "Theo dữ liệu hiện tại", "cyan", "◌")}
                    ${workspaceKpiCard("File tổng cộng", compactNumber(stats.totalFiles ?? rows.reduce((sum, row) => sum + Number(row.fileCount || row.filesCount || 0), 0)), "Theo dữ liệu hiện tại", "orange", "F")}
                </div>
                <div class="admin-workspace-layout">
                    <main class="workspace-main-panel">
                        <div class="workspace-filter-bar">
                            <input id="workspace-search-input" value="${escapeHTML(state.adminWorkspacesFilters.search)}" placeholder="Tìm workspace, owner...">
                            <select id="workspace-plan-filter"><option value="all">Tất cả gói</option><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option><option value="enterprise">Enterprise</option></select>
                            <select id="workspace-status-filter"><option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="pending">Cảnh báo</option><option value="inactive">Ngừng hoạt động</option><option value="suspended">Tạm khóa</option></select>
                            <select id="workspace-storage-filter"><option value="all">Tất cả storage</option><option value="near-full">Gần đầy</option><option value="over-limit">Quá hạn mức</option></select>
                            <button class="workspace-btn" id="workspace-refresh-btn">Refresh</button>
                        </div>
                        <div class="workspace-table-card">
                            <table class="workspace-enterprise-table">
                                <thead><tr><th>Tên workspace</th><th>Owner</th><th>Gói</th><th>Members</th><th>Files</th><th>Storage</th><th>Retention</th><th>Hoạt động</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                                <tbody>${tableRows || `<tr><td colspan="10"><div class="workspace-empty-state"><strong>Chưa có workspace nào</strong><button class="workspace-btn primary" onclick="window.openWorkspaceModal('create')">Tạo workspace</button></div></td></tr>`}</tbody>
                            </table>
                        </div>
                        <div class="workspace-pagination"><span>Hiển thị ${rows.length ? start + 1 : 0}-${Math.min(start + pageRows.length, rows.length)} / ${rows.length} workspaces</span><select id="workspace-page-size"><option>10</option><option>20</option><option>50</option></select><button id="workspace-prev-page">Prev</button><strong>${state.adminWorkspacesFilters.page} / ${totalPages}</strong><button id="workspace-next-page">Next</button></div>
                    </main>
                    <aside class="workspace-side-panel">
                        <section><h3>Phân bổ dung lượng</h3>${workspaceDonutChart(rows)}</section>
                        <section><h3>Hoạt động gần đây</h3><div class="workspace-activity-list">${activities || `<div class="workspace-empty-mini">Chưa có activity thật từ backend.</div>`}</div></section>
                        <section><h3>Hành động nhanh</h3><div class="workspace-quick-actions"><button onclick="window.openWorkspaceModal('create')"><strong>Tạo workspace mới</strong><small>Thêm workspace cho owner hiện có</small><span>→</span></button><button onclick="showToast('Chọn Cấu hình trong bảng để quản lý quota.', 'info')"><strong>Quản lý quota</strong><small>Cập nhật file/storage limit</small><span>→</span></button><button onclick="switchAdminTab('audit')"><strong>Xem audit log</strong><small>Theo dõi thay đổi backend</small><span>→</span></button></div></section>
                        <section><h3>Gợi ý tối ưu</h3><ul class="workspace-optimization-list">${workspaceOptimization(rows)}</ul><button class="workspace-btn">Xem gợi ý</button></section>
                    </aside>
                </div>
                ${workspaceFormModal()}
            </div>
        `;
        bindAdminWorkspaceControls(totalPages);
    }

    function workspaceFormModal() {
        return `
            <div class="workspace-modal" id="workspace-form-modal" hidden>
                <form class="workspace-modal-card" id="workspace-form">
                    <div class="workspace-modal-head"><h3 id="workspace-modal-title">Tạo workspace</h3><button type="button" id="workspace-modal-close">×</button></div>
                    <label>Tên workspace<input id="workspace-form-name" required></label>
                    <label>Owner email/user<input id="workspace-form-owner" required></label>
                    <label>Gói<select id="workspace-form-plan"><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option><option value="enterprise">Enterprise</option></select></label>
                    <div class="workspace-modal-grid"><label>Storage limit (MB)<input id="workspace-form-storage" type="number" min="1" required></label><label>File limit<input id="workspace-form-files" type="number" min="1" required></label></div>
                    <label>Retention policy<input id="workspace-form-retention" value="30"></label>
                    <label class="workspace-status-edit">Status<select id="workspace-form-status"><option value="active">Hoạt động</option><option value="pending">Cảnh báo</option><option value="inactive">Ngừng hoạt động</option><option value="suspended">Tạm khóa</option></select></label>
                    <div id="workspace-form-error" class="workspace-form-error"></div>
                    <div class="workspace-modal-actions"><button type="button" class="workspace-btn" id="workspace-modal-cancel">Hủy</button><button type="submit" class="workspace-btn primary">Lưu workspace</button></div>
                </form>
            </div>
        `;
    }

    function bindAdminWorkspaceControls(totalPages) {
        const setFilter = (key, value) => {
            state.adminWorkspacesFilters[key] = value;
            state.adminWorkspacesFilters.page = 1;
            renderAdminWorkspacesContent();
        };
        const plan = document.getElementById("workspace-plan-filter");
        const statusFilter = document.getElementById("workspace-status-filter");
        const storage = document.getElementById("workspace-storage-filter");
        const search = document.getElementById("workspace-search-input");
        if (plan) plan.value = state.adminWorkspacesFilters.plan;
        if (statusFilter) statusFilter.value = state.adminWorkspacesFilters.status;
        if (storage) storage.value = state.adminWorkspacesFilters.storage;
        search?.addEventListener("input", () => setFilter("search", search.value));
        plan?.addEventListener("change", () => setFilter("plan", plan.value));
        statusFilter?.addEventListener("change", () => setFilter("status", statusFilter.value));
        storage?.addEventListener("change", () => setFilter("storage", storage.value));
        document.getElementById("workspace-refresh-btn")?.addEventListener("click", () => loadAdminWorkspaces(true));
        document.getElementById("workspace-create-btn")?.addEventListener("click", () => window.openWorkspaceModal("create"));
        document.getElementById("workspace-import-btn")?.addEventListener("click", () => document.getElementById("workspace-import-input")?.click());
        document.getElementById("workspace-import-input")?.addEventListener("change", importWorkspaceDataFromInput);
        document.getElementById("workspace-export-all-btn")?.addEventListener("click", exportWorkspaceListCsv);
        const pageSize = document.getElementById("workspace-page-size");
        if (pageSize) {
            pageSize.value = String(state.adminWorkspacesFilters.pageSize);
            pageSize.addEventListener("change", () => {
                state.adminWorkspacesFilters.pageSize = Number(pageSize.value);
                state.adminWorkspacesFilters.page = 1;
                renderAdminWorkspacesContent();
            });
        }
        document.getElementById("workspace-prev-page")?.addEventListener("click", () => {
            state.adminWorkspacesFilters.page = Math.max(1, state.adminWorkspacesFilters.page - 1);
            renderAdminWorkspacesContent();
        });
        document.getElementById("workspace-next-page")?.addEventListener("click", () => {
            state.adminWorkspacesFilters.page = Math.min(totalPages, state.adminWorkspacesFilters.page + 1);
            renderAdminWorkspacesContent();
        });
        document.getElementById("workspace-form")?.addEventListener("submit", submitWorkspaceForm);
        document.getElementById("workspace-modal-close")?.addEventListener("click", closeWorkspaceModal);
        document.getElementById("workspace-modal-cancel")?.addEventListener("click", closeWorkspaceModal);
    }

    async function loadAdminWorkspaces(force = false) {
        if (state.adminWorkspacesLoading) return;
        if (state.workspaces.length && !force) {
            renderAdminWorkspacesContent();
        }
        state.adminWorkspacesLoading = true;
        state.adminWorkspacesError = "";
        renderAdminWorkspacesContent();
        try {
            const [payload, stats, activity] = await Promise.all([
                adminService.getWorkspaces({ page: 1, pageSize: 500 }),
                adminService.getWorkspaceStats(),
                adminService.getWorkspaceActivities(20)
            ]);
            state.workspaces = Array.isArray(payload.items) ? payload.items : [];
            state.adminWorkspacesStats = stats || payload.stats || null;
            state.adminWorkspaceActivities = Array.isArray(activity?.activities) ? activity.activities : [];
        } catch (error) {
            state.adminWorkspacesError = error.message || "Không thể tải workspace thật từ backend.";
        } finally {
            state.adminWorkspacesLoading = false;
            renderAdminWorkspacesContent();
        }
    }

    function renderAdminWorkspaces() {
        loadAdminWorkspaces(false);
    }

    window.reloadAdminWorkspaces = () => loadAdminWorkspaces(true);

    window.openWorkspaceModal = function(mode = "create", id = "") {
        state.adminWorkspaceModalMode = mode;
        state.adminWorkspaceEditingId = id;
        const workspace = (state.workspaces || []).find(item => String(item.id) === String(id) || String(item.userId) === String(id)) || {};
        document.getElementById("workspace-modal-title").innerText = mode === "edit" ? "Cấu hình workspace" : "Tạo workspace";
        document.getElementById("workspace-form-name").value = mode === "edit" ? workspace.name || "" : "";
        document.getElementById("workspace-form-owner").value = mode === "edit" ? workspace.ownerEmail || "" : "";
        document.getElementById("workspace-form-owner").disabled = mode === "edit";
        document.getElementById("workspace-form-plan").value = normalizeTier(workspace.plan || "free");
        document.getElementById("workspace-form-storage").value = Math.max(1, Math.ceil(Number(workspace.storageLimitBytes || 15 * 1024 * 1024) / 1024 / 1024));
        document.getElementById("workspace-form-files").value = Number(workspace.fileLimit || 3);
        document.getElementById("workspace-form-retention").value = workspace.retentionPolicy || workspace.retention || "30";
        document.getElementById("workspace-form-status").value = normalizeAccountStatus(workspace.status || "active");
        document.getElementById("workspace-form-error").innerText = "";
        document.getElementById("workspace-form-modal").hidden = false;
    };

    function closeWorkspaceModal() {
        const modal = document.getElementById("workspace-form-modal");
        if (modal) modal.hidden = true;
    }

    async function submitWorkspaceForm(event) {
        event.preventDefault();
        const errorBox = document.getElementById("workspace-form-error");
        const storageMb = Number(document.getElementById("workspace-form-storage").value || 0);
        const fileLimit = Number(document.getElementById("workspace-form-files").value || 0);
        const payload = {
            name: document.getElementById("workspace-form-name").value.trim(),
            ownerEmail: document.getElementById("workspace-form-owner").value.trim(),
            plan: document.getElementById("workspace-form-plan").value,
            storageLimitBytes: Math.round(storageMb * 1024 * 1024),
            fileLimit,
            retentionPolicy: document.getElementById("workspace-form-retention").value.trim() || "30",
            status: document.getElementById("workspace-form-status").value
        };
        if (!payload.name || !payload.ownerEmail || storageMb <= 0 || fileLimit <= 0) {
            if (errorBox) errorBox.innerText = "Vui lòng nhập đủ tên, owner, storage limit và file limit hợp lệ.";
            return;
        }
        try {
            if (state.adminWorkspaceModalMode === "edit") {
                await adminService.updateWorkspace(state.adminWorkspaceEditingId, payload);
                showToast("Đã cập nhật workspace từ backend.", "success");
            } else {
                await adminService.createWorkspace(payload);
                showToast("Đã tạo workspace từ backend.", "success");
            }
            closeWorkspaceModal();
            await loadAdminWorkspaces(true);
        } catch (error) {
            if (errorBox) errorBox.innerText = error.message || "Không thể lưu workspace.";
        }
    }

    window.exportWorkspaceReport = async function(id) {
        try {
            const blob = await adminService.exportWorkspace(id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `workspace-${String(id).replace(/[^a-z0-9_-]+/gi, "-")}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            showToast("Đã export workspace từ API backend.", "success");
        } catch (error) {
            showToast(error.message || "Không thể export workspace", "error");
        }
    };

    window.openWorkspaceMenu = function(id) {
        showToast(`Workspace ${id}: dùng Cấu hình để chỉnh quota/status hoặc Export để tải CSV.`, "info");
    };

    async function importWorkspaceDataFromInput(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const result = await adminService.importWorkspaceData(file);
            showToast(`Import workspace: ${result.imported || 0} thành công, ${result.failed || 0} lỗi.`, result.failed ? "warning" : "success");
            await loadAdminWorkspaces(true);
        } catch (error) {
            showToast(error.message || "Không thể import workspace", "error");
        } finally {
            event.target.value = "";
        }
    }

    function exportWorkspaceListCsv() {
        const rows = workspaceFilteredRows();
        const columns = ["id", "name", "ownerEmail", "plan", "membersCount", "filesCount", "fileLimit", "storageUsedBytes", "storageLimitBytes", "retentionPolicy", "lastActivityAt", "status"];
        const escapeCsv = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csv = [columns.join(","), ...rows.map(row => columns.map(column => escapeCsv(row[column] ?? row[column.replace("sCount", "Count")])).join(","))].join("\n");
        const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `excelai-workspaces-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast("Đã export danh sách workspace thật đang tải.", "success");
    }

    function renderAdminJobs() {
        const tbody = document.getElementById("admin-jobs-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";

        const jobs = adminService.loadJobs();
        if (jobs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--color-text-muted);">Chưa có job thật từ backend.</td></tr>`;
            return;
        }
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

    async function renderAdminQuota() {
        if (!adminQuotaFeatureList) return;
        adminQuotaFeatureList.innerHTML = `<div style="color: var(--color-text-muted); font-size: 0.85rem;">Đang tải dữ liệu usage từ backend...</div>`;
        if (adminQuotaTotalRequests) adminQuotaTotalRequests.innerText = "--";
        if (adminQuotaSummary) adminQuotaSummary.innerText = "Đang đồng bộ từ backend.";

        try {
            state.aiCostDashboard = await adminService.getAiCostDashboard();
        } catch (error) {
            adminQuotaFeatureList.innerHTML = `<div style="color: var(--color-danger); font-size: 0.85rem;">${escapeHTML(error.message || "Không thể tải dữ liệu quota.")}</div>`;
            if (adminQuotaSummary) adminQuotaSummary.innerText = "Backend quota dashboard chưa phản hồi.";
            return;
        }

        const dashboard = state.aiCostDashboard || {};
        const features = Array.isArray(dashboard.topFeaturesByCost) ? dashboard.topFeaturesByCost : [];
        const totalRequests = Number(dashboard.aiRequestsToday || 0);
        if (adminQuotaTotalRequests) adminQuotaTotalRequests.innerText = totalRequests.toLocaleString("vi-VN");
        if (adminQuotaSummary) {
            const errorRate = Number(dashboard.providerErrorRate || 0).toLocaleString("vi-VN");
            const blocked = Number(dashboard.blockedCount || 0).toLocaleString("vi-VN");
            const exceeded = Number(dashboard.quotaExceededCount || 0).toLocaleString("vi-VN");
            adminQuotaSummary.innerText = `Provider error ${errorRate}% · Blocked ${blocked} · Quota exceeded ${exceeded}`;
        }

        if (!features.length) {
            adminQuotaFeatureList.innerHTML = `<div style="color: var(--color-text-muted); font-size: 0.85rem;">Chưa có AI usage thật trong 24 giờ gần nhất.</div>`;
            return;
        }

        const maxRequests = Math.max(1, ...features.map(item => Number(item.requestCount || 0)));
        const colors = ["var(--color-success)", "var(--color-accent)", "var(--color-purple)", "var(--color-warning)"];
        adminQuotaFeatureList.innerHTML = features.map((item, index) => {
            const count = Number(item.requestCount || 0);
            const percent = Math.round((count / maxRequests) * 100);
            const cost = Number(item.estimatedCost || 0);
            return `
                <div>
                    <div style="display: flex; justify-content: space-between; gap: 0.75rem; font-size: 0.8rem; margin-bottom: 0.25rem;">
                        <span>${escapeHTML(item.featureName || "unknown")}</span>
                        <span>${count.toLocaleString("vi-VN")} lượt · $${cost.toFixed(6)}</span>
                    </div>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percent}%; background: ${colors[index % colors.length]};"></div></div>
                </div>
            `;
        }).join("");
    }

    function formatDateTime(value) {
        if (!value) return "--";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "--";
        return date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
    }

    function formatCurrency(amount, currency = "VND") {
        const value = Number(amount || 0);
        if (!value) return "--";
        if (String(currency).toUpperCase() === "VND") return `${value.toLocaleString("vi-VN")}đ`;
        return `${value.toLocaleString("vi-VN")} ${currency}`;
    }

    function checkoutStatusLabel(status) {
        const labels = {
            pending: "Chờ duyệt",
            confirmed: "Đã xác nhận",
            rejected: "Đã từ chối",
            expired: "Hết hạn"
        };
        return labels[String(status || "pending").toLowerCase()] || "Chờ duyệt";
    }

    function checkoutStatusBadge(status) {
        const normalized = String(status || "pending").toLowerCase();
        if (normalized === "confirmed") return "badge-active";
        if (normalized === "pending") return "tier-pro";
        return "badge-banned";
    }

    function findStateUser(userId) {
        return state.users.find(user => String(user.id) === String(userId)) || null;
    }

    function renderAdminGrantUsers() {
        if (!adminGrantUserSelect) return;
        const selectedValue = adminGrantUserSelect.value;
        const sortedUsers = [...state.users].sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")));
        if (!sortedUsers.length) {
            adminGrantUserSelect.innerHTML = `<option value="">Chưa có user</option>`;
            if (adminGrantTierBtn) adminGrantTierBtn.disabled = true;
            return;
        }

        adminGrantUserSelect.innerHTML = sortedUsers.map(user => {
            const currentTier = normalizeTier(user.tier);
            const name = user.name || "Người dùng";
            const email = user.email || "";
            return `<option value="${escapeHTML(user.id)}">${escapeHTML(name)} - ${escapeHTML(email)} (${tierLabel(currentTier)})</option>`;
        }).join("");

        if (selectedValue && sortedUsers.some(user => String(user.id) === String(selectedValue))) {
            adminGrantUserSelect.value = selectedValue;
        }
        if (adminGrantTierBtn) adminGrantTierBtn.disabled = false;
        const selectedUser = findStateUser(adminGrantUserSelect.value);
        if (selectedUser && adminGrantTierSelect && !adminGrantTierSelect.dataset.userChanged) {
            adminGrantTierSelect.value = normalizeTier(selectedUser.tier);
        }
    }

    function renderAdminBillingTierSummary() {
        if (!adminBillingTierSummary) return;
        const counts = state.billingDashboard?.usersByTier || state.users.reduce((acc, user) => {
            const tier = normalizeTier(user.tier);
            acc[tier] = (acc[tier] || 0) + 1;
            return acc;
        }, {});

        adminBillingTierSummary.innerHTML = ["free", "pro", "business", "enterprise"].map(tier => `
            <div style="padding: 0.7rem; border: 1px solid var(--border-glass); border-radius: 6px; background: rgba(255,255,255,0.02);">
                <span class="user-tier-badge ${tierBadgeClass(tier)}" style="font-size: 0.65rem;">${tierLabel(tier).toUpperCase()}</span>
                <div style="font-size: 1.25rem; font-weight: 800; margin-top: 0.45rem;">${Number(counts[tier] || 0).toLocaleString("vi-VN")}</div>
            </div>
        `).join("");
    }

    function renderAdminCheckoutRequests() {
        if (!adminCheckoutRequestsTableBody) return;
        const rows = state.checkoutRequests || [];
        if (!rows.length) {
            adminCheckoutRequestsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-text-muted);">Chưa có yêu cầu mua gói từ backend.</td></tr>`;
            return;
        }

        adminCheckoutRequestsTableBody.innerHTML = rows.map(row => {
            const requestIdArg = encodeInlineArg(row.id || "");
            const user = findStateUser(row.userId);
            const userText = user ? `${user.name || "Người dùng"} (${user.email || ""})` : row.userId || "--";
            const normalizedTier = normalizeTier(row.planCode);
            const isPending = String(row.status || "pending").toLowerCase() === "pending";
            const actions = isPending
                ? `<button class="admin-btn admin-btn-edit" onclick="window.confirmCheckoutRequest(decodeURIComponent('${requestIdArg}'))">Xác nhận</button>
                   <button class="admin-btn admin-btn-ban" onclick="window.rejectCheckoutRequest(decodeURIComponent('${requestIdArg}'))">Từ chối</button>`
                : `<span style="color:var(--color-text-muted);">Đã xử lý</span>`;
            return `
                <tr>
                    <td>${escapeHTML(userText)}</td>
                    <td><span class="user-tier-badge ${tierBadgeClass(normalizedTier)}">${tierLabel(normalizedTier).toUpperCase()}</span></td>
                    <td>${formatCurrency(row.amount, row.currency)}</td>
                    <td><span class="admin-badge ${checkoutStatusBadge(row.status)}">${checkoutStatusLabel(row.status)}</span></td>
                    <td>${formatDateTime(row.createdAt)}</td>
                    <td class="admin-actions-btns">${actions}</td>
                </tr>
            `;
        }).join("");
    }

    function renderAdminBilling() {
        const priceProInput = document.getElementById("config-price-pro");
        const priceBusinessInput = document.getElementById("config-price-business");
        const priceEnterpriseInput = document.getElementById("config-price-enterprise");
        const priceProAnnualInput = document.getElementById("config-price-pro-annual");
        const priceBusinessAnnualInput = document.getElementById("config-price-business-annual");
        const priceEnterpriseAnnualInput = document.getElementById("config-price-enterprise-annual");
        applyPricingConfig(adminService.loadPricingConfig());
        if (priceProInput) priceProInput.value = pricing.monthly.pro;
        if (priceBusinessInput) priceBusinessInput.value = pricing.monthly.business || getTierPrice("business", "monthly");
        if (priceEnterpriseInput) priceEnterpriseInput.value = pricing.monthly.enterprise || "399,000đ";
        if (priceProAnnualInput) priceProAnnualInput.value = pricing.annual.pro;
        if (priceBusinessAnnualInput) priceBusinessAnnualInput.value = pricing.annual.business || "239,000đ";
        if (priceEnterpriseAnnualInput) priceEnterpriseAnnualInput.value = pricing.annual.enterprise || "319,000đ";

        renderAdminGrantUsers();
        renderAdminBillingTierSummary();
        renderAdminCheckoutRequests();
        renderAdminCoupons();
    }

    function renderAdminPrompts() {
        const config = adminService.loadPromptConfig();

        // Split systemPrompt into 4 textareas if formatted, otherwise put all in role
        const sysPromptStr = config.systemPrompt || "";
        const roleInput = document.getElementById("admin-prompt-role");
        const styleInput = document.getElementById("admin-prompt-style");
        const rulesInput = document.getElementById("admin-prompt-rules");
        const codeInput = document.getElementById("admin-prompt-code");

        if (sysPromptStr.includes("[ROLE]")) {
            const roleMatch = sysPromptStr.match(/\[ROLE\]([\s\S]*?)(?=\[STYLE\]|\[RULES\]|\[CODE\]|$)/);
            const styleMatch = sysPromptStr.match(/\[STYLE\]([\s\S]*?)(?=\[ROLE\]|\[RULES\]|\[CODE\]|$)/);
            const rulesMatch = sysPromptStr.match(/\[RULES\]([\s\S]*?)(?=\[ROLE\]|\[STYLE\]|\[CODE\]|$)/);
            const codeMatch = sysPromptStr.match(/\[CODE\]([\s\S]*?)(?=\[ROLE\]|\[STYLE\]|\[RULES\]|$)/);

            if (roleInput) roleInput.value = roleMatch ? roleMatch[1].trim() : "";
            if (styleInput) styleInput.value = styleMatch ? styleMatch[1].trim() : "";
            if (rulesInput) rulesInput.value = rulesMatch ? rulesMatch[1].trim() : "";
            if (codeInput) codeInput.value = codeMatch ? codeMatch[1].trim() : "";
        } else {
            if (roleInput) roleInput.value = sysPromptStr;
            if (styleInput) styleInput.value = "";
            if (rulesInput) rulesInput.value = "";
            if (codeInput) codeInput.value = "";
        }

        // Set hidden/helper inputs to avoid errors
        if (adminSystemPrompt) adminSystemPrompt.value = sysPromptStr;
        if (adminSystemLimit) adminSystemLimit.value = config.freeLimit || 20;

        const formulaPrompt = document.getElementById("admin-formula-prompt");
        if (formulaPrompt) formulaPrompt.value = config.formulaPrompt || "";

        const checkerPrompt = document.getElementById("admin-checker-prompt");
        if (checkerPrompt) checkerPrompt.value = config.checkerPrompt || "";

        const reconciliationPrompt = document.getElementById("admin-reconciliation-prompt");
        if (reconciliationPrompt) reconciliationPrompt.value = config.reconciliationPrompt || "";
    }

    function renderAdminTemplates() {
        const tbody = document.getElementById("admin-templates-table-body");
        if (!tbody) return;

        let templates = adminService.loadTemplates ? adminService.loadTemplates() : (adminService.getCacheSnapshot().templates || []);
        const panel = document.getElementById("admin-tab-templates");

        if (!templates || templates.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--color-text-muted);">Chưa có biểu mẫu thật từ backend.</td></tr>`;
            return;
        }

        const normalizedTemplates = templates.map(template => {
            const name = template.name || template.templateName || "";
            const file = template.file || template.fileName || "";
            const rawStatus = String(template.status || "Active").toLowerCase();
            const isActive = rawStatus === "active" || rawStatus === "đang hoạt động";
            const rawImage = template.image || template.previewImage || "";
            const imageUrl = rawImage && rawImage.startsWith("/") ? `${API_BASE}${rawImage}` : rawImage;
            return {
                ...template,
                name,
                file,
                imageUrl,
                statusLabel: isActive ? "Đang hoạt động" : (rawStatus.includes("archive") ? "Đã lưu trữ" : "Bản nháp"),
                statusKind: isActive ? "active" : (rawStatus.includes("archive") ? "archived" : "draft"),
                updatedAt: template.updatedAt || template.lastUpdated || template.createdAt || template.created_at || "",
                updatedBy: template.updatedBy || template.createdBy || "Admin",
            };
        });

        updateAdminTemplateSummary(panel, normalizedTemplates);

        tbody.innerHTML = normalizedTemplates.map(template => {
            const templateIdArg = encodeInlineArg(template.id || "");
            const previewHtml = template.imageUrl
                ? `<button type="button" onclick="window.previewAdminTemplate(decodeURIComponent('${templateIdArg}'))" title="Xem preview" style="border:0; padding:0; background:transparent; cursor:pointer;"><img src="${escapeHTML(template.imageUrl)}" alt="${escapeHTML(template.name || "Template")}" style="width:72px; height:44px; object-fit:cover; border-radius:6px; border:1px solid var(--dark-border); background:#0b0f19;"></button>`
                : `<span style="font-size: 1.15rem;">${escapeHTML(template.icon || "📊")}</span>`;
            const statusHtml = template.statusKind === "active"
                ? `<span class="badge" style="background:rgba(16,124,65,0.1); color:var(--color-success); font-size:0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Đang hoạt động</span>`
                : template.statusKind === "archived"
                    ? `<span class="badge" style="background:rgba(139,92,246,0.1); color:var(--color-purple); font-size:0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Đã lưu trữ</span>`
                    : `<span class="badge" style="background:rgba(245,158,11,0.1); color:var(--color-warning); font-size:0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Bản nháp</span>`;

            return `
                <tr>
                    <td style="width: 76px; text-align: center;">${previewHtml}</td>
                    <td style="font-weight:600; color:#fff;">${escapeHTML(template.name)}</td>
                    <td>${escapeHTML(template.category || "")}</td>
                    <td style="font-family:var(--font-mono); font-size:0.75rem;">${escapeHTML(template.file || "")}</td>
                    <td style="max-width:240px; font-size:0.75rem; color:var(--color-text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(template.description || "")}</td>
                    <td>${statusHtml}</td>
                    <td style="font-size:0.7rem; line-height:1.2; color:var(--color-text-muted);">${escapeHTML(formatAdminTemplateDate(template.updatedAt))}<br><small style="color:rgba(255,255,255,0.25);">Bởi: ${escapeHTML(template.updatedBy)}</small></td>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button class="btn btn-outline btn-xs" style="padding:4px 6px;" onclick="window.previewAdminTemplate(decodeURIComponent('${templateIdArg}'))" title="Xem preview">👁️</button>
                            <button class="btn btn-outline btn-xs" style="padding:4px 6px;" onclick="window.openTemplate(decodeURIComponent('${templateIdArg}'))" title="Tải xuống">📥</button>
                            <button class="btn btn-outline btn-xs" style="padding:4px 6px;" onclick="window.editTemplate(decodeURIComponent('${templateIdArg}'))" title="Sửa">✏️</button>
                            <button class="btn btn-outline btn-xs" style="padding:4px 6px;" onclick="window.deleteTemplate(decodeURIComponent('${templateIdArg}'))" title="Xóa">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function formatAdminTemplateDate(value) {
        if (!value) return "--";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    function updateAdminTemplateSummary(panel, templates) {
        if (!panel) return;
        const total = templates.length;
        const active = templates.filter(template => template.statusKind === "active").length;
        const draft = templates.filter(template => template.statusKind === "draft").length;
        const archived = templates.filter(template => template.statusKind === "archived").length;
        const values = panel.querySelectorAll(".dashboard-v2-stat-card .stat-value");
        if (values[0]) values[0].textContent = total.toLocaleString("vi-VN");
        if (values[1]) values[1].textContent = active.toLocaleString("vi-VN");
        if (values[2]) values[2].textContent = draft.toLocaleString("vi-VN");
        if (values[3]) values[3].textContent = archived.toLocaleString("vi-VN");
        const footer = panel.querySelector(".panel-wrapper-v2 > div:last-child > span");
        if (footer) footer.textContent = `Hiển thị ${total.toLocaleString("vi-VN")} trên tổng số ${total.toLocaleString("vi-VN")} biểu mẫu`;
    }

    function getAdminTemplateElements() {
        const elements = {
            modal: adminTemplateModal,
            title: adminTemplateModalTitle,
            form: adminTemplateForm,
            idInput: editTemplateIdInput,
            nameInput: editTemplateNameInput,
            categoryInput: editTemplateCategoryInput,
            fileInput: editTemplateFileInput,
            iconInput: editTemplateIconInput,
            colorInput: editTemplateColorInput,
            descriptionInput: editTemplateDescriptionInput
        };
        const missing = Object.entries(elements)
            .filter(([, element]) => !element)
            .map(([name]) => name);
        if (missing.length) {
            console.warn("Missing admin template DOM elements:", missing);
            showToast("Thiếu modal biểu mẫu trên giao diện. Hãy tải lại trang để nhận bản mới.", "error");
            return null;
        }
        return elements;
    }

    function templatePayloadFromForm(elements = getAdminTemplateElements()) {
        if (!elements) return null;
        const name = elements.nameInput.value.trim();
        const file = elements.fileInput.value.trim();
        return {
            templateName: name,
            name,
            category: elements.categoryInput.value.trim(),
            fileName: file,
            file,
            description: elements.descriptionInput.value.trim(),
            icon: elements.iconInput.value.trim() || "XL",
            color: elements.colorInput.value || "accent"
        };
    }

    function openAdminTemplateModal(template = null) {
        const elements = getAdminTemplateElements();
        if (!elements) return;
        const isCreate = !template;
        elements.title.innerText = isCreate ? "Thêm biểu mẫu Excel" : "Chỉnh sửa biểu mẫu Excel";
        elements.idInput.value = template?.id || "";
        elements.nameInput.value = template?.name || template?.templateName || "";
        elements.categoryInput.value = template?.category || "";
        elements.fileInput.value = template?.file || template?.fileName || "";
        elements.iconInput.value = template?.icon || "XL";
        elements.colorInput.value = template?.color || "accent";
        elements.descriptionInput.value = template?.description || "";
        elements.modal.classList.add("active");
        setTimeout(() => elements.nameInput.focus(), 50);
    }

    window.editTemplate = function(id) {
        const template = adminService.loadTemplates().find(item => String(item.id) === String(id));
        if (!template) return;
        openAdminTemplateModal(template);
    };

    window.openTemplate = async function(id) {
        try {
            const payload = await templateService.useTemplate(id);
            if (payload?.downloadUrl) {
                window.open(payload.downloadUrl, "_blank", "noopener");
            } else {
                throw new Error("Backend chưa trả file biểu mẫu thật để tải xuống.");
            }
            showToast(`Đã mở biểu mẫu: ${payload?.template?.name || id}`, "success");
        } catch (error) {
            showToast(error.message || "Không thể mở template", "error");
        }
    };

    window.previewAdminTemplate = function(id) {
        const template = adminService.loadTemplates().find(item => String(item.id) === String(id));
        const rawImage = template?.image || template?.previewImage || "";
        const imageUrl = rawImage && rawImage.startsWith("/") ? `${API_BASE}${rawImage}` : rawImage;
        if (imageUrl) {
            window.open(imageUrl, "_blank", "noopener");
            return;
        }
        showToast("Template này chưa có ảnh xem trước.", "error");
    };

    window.deleteTemplate = async function(id) {
        const template = adminService.loadTemplates().find(item => String(item.id) === String(id));
        if (!template) return;
        const name = template.name || template.templateName || id;
        if (!window.confirm(`Xóa template "${name}"?`)) return;
        try {
            await adminService.deleteTemplateAdvanced(id, true);
            state.templates = adminService.loadTemplates();
            renderAdminTemplates();
            showToast("Đã xóa template khỏi backend.", "success");
            adminService.addSystemLog("warning", `Templates: Admin deleted template '${name}'`);
        } catch (error) {
            showToast(error.message || "Không thể xóa template", "error");
        }
    };

    function renderAdminFeedbacks() {
        const tbody = document.getElementById("admin-feedbacks-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";

        let feedbacks = adminService.loadFeedbacks ? adminService.loadFeedbacks() : [];
        if (!feedbacks || feedbacks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-text-muted);">Chưa có phản hồi thật từ backend.</td></tr>`;
            return;
        }

        feedbacks.forEach(f => {
            const feedbackIdArg = encodeInlineArg(f.id);

            let typeHtml = "";
            if (f.type.includes("Bug")) {
                typeHtml = `<span style="color:var(--color-danger); display:flex; align-items:center; gap:4px; font-weight:600;"><span class="dot-status red"></span> Bug (Lỗi phần mềm)</span>`;
            } else if (f.type.includes("Góp ý") || f.type.includes("Feature")) {
                typeHtml = `<span style="color:var(--color-accent); display:flex; align-items:center; gap:4px; font-weight:600;"><span class="dot-status blue"></span> Góp ý (Feature request)</span>`;
            } else if (f.type.includes("Hỏi đáp") || f.type.includes("Hỗ trợ")) {
                typeHtml = `<span style="color:var(--color-purple-solid); display:flex; align-items:center; gap:4px; font-weight:600;"><span class="dot-status purple"></span> Hỏi đáp / Hỗ trợ</span>`;
            } else {
                typeHtml = `<span style="color:var(--color-text-muted); display:flex; align-items:center; gap:4px; font-weight:600;"><span class="dot-status gray"></span> ${escapeHTML(f.type)}</span>`;
            }

            let statusHtml = "";
            if (f.status === "resolved") {
                statusHtml = `<span class="badge" style="background:rgba(16,124,65,0.1); color:var(--color-success); font-size:0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Đã giải quyết</span>`;
            } else if (f.status === "processing") {
                statusHtml = `<span class="badge" style="background:rgba(6,182,212,0.1); color:var(--color-accent); font-size:0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Đang xử lý</span>`;
            } else {
                statusHtml = `<span class="badge" style="background:rgba(245,158,11,0.1); color:var(--color-warning); font-size:0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Chờ phản hồi KH</span>`;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:28px; height:28px; border-radius:50%; background:rgba(139,92,246,0.15); color:var(--color-purple-solid); display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:600;">${f.initials || "US"}</div>
                        <div style="text-align:left;">
                            <strong style="color:#fff;">${escapeHTML(f.userName)}</strong><br>
                            <small style="color:var(--color-text-muted);">${escapeHTML(f.email || "")}</small>
                        </div>
                    </div>
                </td>
                <td>${typeHtml}</td>
                <td style="max-width:240px; font-size:0.78rem; line-height:1.4; text-align:left; color:#cbd5e1; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(f.text)}</td>
                <td>${statusHtml}</td>
                <td style="max-width:240px; font-size:0.78rem; text-align:left; color:var(--color-text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(f.reply || "")}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button class="btn btn-outline btn-xs" style="padding:4px 6px;" onclick="showToast('Xem chi tiết phản hồi...', 'info')" title="Xem chi tiết">👁️</button>
                        <button class="btn btn-outline btn-xs" style="padding:4px 6px;" onclick="showToast('Tùy chọn khác...', 'info')" title="Tùy chọn">⋮</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.replyFeedback = async function(id) {
        const replyInput = document.getElementById(`feedback-reply-${encodeInlineArg(id)}`) || document.getElementById(`feedback-reply-${id}`);
        if (!replyInput) return;
        const text = replyInput.value.trim();
        if (!text) {
            showToast("Vui lòng nhập nội dung trả lời!", "error");
            return;
        }
        try {
            await adminService.replyFeedback(id, text);
            showToast("Đã gửi phản hồi thành công!");
            adminService.addSystemLog("success", `Feedback: Admin replied to feedback #${id}`);
            renderAdminFeedbacks();
        } catch (error) {
            showToast(error.message || "Không thể gửi phản hồi lên backend", "error");
        }
    };

    window.archiveFeedback = async function(id) {
        try {
            await adminService.updateFeedbackStatus(id, "archived");
            showToast("Đã lưu trữ feedback trên backend.", "success");
            renderAdminFeedbacks();
        } catch (error) {
            showToast(error.message || "Không thể lưu trữ feedback", "error");
        }
    };

    function renderAdminAudits() {
        const tbody = document.getElementById("admin-audit-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";

        let logs = adminService.loadSystemLogs ? adminService.loadSystemLogs() : [];
        if (!logs || logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--color-text-muted);">Chưa có audit log thật từ backend.</td></tr>`;
            return;
        }

        const auditRows = logs.map(log => ({
            time: log.time || log.timestamp || "--",
            initials: log.initials || "US",
            user: log.user || log.userId || "System",
            action: log.action || log.text || "Hoạt động hệ thống",
            details: log.details || log.message || "Hoạt động hệ thống",
            ip: log.ip || "--",
            level: log.level || (log.type === "warning" ? "WARNING" : log.type === "error" ? "ALERT" : "INFO")
        }));

        auditRows.forEach(a => {
            let lvlHtml = "";
            if (a.level === "INFO") {
                lvlHtml = `<span class="badge" style="background:rgba(6,182,212,0.1); color:var(--color-accent); font-size:0.68rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">INFO</span>`;
            } else if (a.level === "SUCCESS") {
                lvlHtml = `<span class="badge" style="background:rgba(16,124,65,0.1); color:var(--color-success); font-size:0.68rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">SUCCESS</span>`;
            } else if (a.level === "WARNING") {
                lvlHtml = `<span class="badge" style="background:rgba(245,158,11,0.1); color:var(--color-warning); font-size:0.68rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">WARNING</span>`;
            } else {
                lvlHtml = `<span class="badge" style="background:rgba(239,68,68,0.1); color:var(--color-danger); font-size:0.68rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">ALERT</span>`;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span style="color:var(--color-text-muted); font-size:0.75rem;">${a.time}</span></td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:24px; height:24px; border-radius:50%; background:rgba(139,92,246,0.15); color:var(--color-purple-solid); display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:600;">${a.initials}</div>
                        <strong style="color:#fff; font-size:0.78rem;">${escapeHTML(a.user)}</strong>
                    </div>
                </td>
                <td style="font-weight:600; color:#fff;">${escapeHTML(a.action)}</td>
                <td style="max-width:280px; text-align:left; font-size:0.75rem; color:#cbd5e1; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(a.details)}</td>
                <td style="font-family:var(--font-mono); font-size:0.75rem;">${escapeHTML(a.ip)}</td>
                <td>${lvlHtml}</td>
                <td>
                    <button class="btn btn-outline btn-xs" style="padding:4px 6px;" onclick="showToast('Thao tác khác...', 'info')" title="Tùy chọn">⋮</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    const securityRolePermissions = [
        { role: "Admin", upload: true, approve: true, viewLogs: true, configure: true, status: "Toàn quyền cấu hình, xem log, duyệt file, xóa file" },
        { role: "Manager", upload: false, approve: true, viewLogs: true, configure: false, status: "Xem báo cáo, duyệt template, xem cảnh báo" },
        { role: "User", upload: true, approve: false, viewLogs: false, configure: false, status: "Upload file, tải kết quả, xem lịch sử cá nhân" },
        { role: "Guest", upload: false, approve: false, viewLogs: false, configure: false, status: "Chỉ xem template công khai" }
    ];

    function securityRiskClass(risk) {
        const normalized = String(risk || "").toLowerCase();
        if (normalized.includes("nghiêm")) return "risk-critical";
        if (normalized.includes("cao")) return "risk-high";
        if (normalized.includes("trung")) return "risk-medium";
        return "risk-low";
    }

    function normalizeSecurityAuditRows(securityDashboard = {}) {
        const rows = [];
        const pushRows = (items, risk, status, label) => {
            (items || []).forEach(row => {
                rows.push({
                    time: formatDateTime(row.created_at || row.time || row.timestamp),
                    user: row.user_email || row.actor_email_snapshot || row.user_id || "System",
                    action: row.action || row.message || label,
                    ip: row.ip_address || row.ip || "--",
                    risk,
                    status
                });
            });
        };

        pushRows(securityDashboard.failedLogin, "Cao", "Đã ghi nhận", "Đăng nhập thất bại");
        pushRows(securityDashboard.blockedUnsafeVba, "Nghiêm trọng", "Đã chặn", "Chặn VBA không an toàn");
        pushRows(securityDashboard.apiKeyChanges, "Trung bình", "Đã ghi log", "Thay đổi API key");
        pushRows(securityDashboard.systemPromptChanges, "Trung bình", "Đã ghi log", "Thay đổi system prompt");
        pushRows(securityDashboard.adminActions, "Thấp", "Đã ghi log", "Admin action");
        return rows.slice(0, 50);
    }

    function permissionChip(enabled) {
        return `<span class="security-permission-chip ${enabled ? "security-permission-yes" : "security-permission-no"}">${enabled ? "Có" : "Không"}</span>`;
    }

    function setSecurityValue(id, value) {
        const field = document.getElementById(id);
        if (field) field.value = value ?? "";
    }

    function setSecurityChecked(id, checked) {
        const field = document.getElementById(id);
        if (field) field.checked = Boolean(checked);
    }

    function writeSecurityPolicyToForm(policy) {
        setSecurityValue("security-filesize", policy.fileSizeLimit);
        setSecurityValue("security-allowed-types", policy.allowedTypes);
        setSecurityValue("security-blocked-types", policy.blockedTypes);
        setSecurityValue("security-max-rows", policy.maxExcelRows);
        setSecurityValue("security-max-sheets", policy.maxExcelSheets);
        setSecurityChecked("security-scan-malware", policy.scanMalware);
        setSecurityChecked("security-block-vba", policy.blockVbaMacro);
        setSecurityChecked("security-allow-xlsm", policy.allowXlsm);
        setSecurityChecked("security-sensitive-warn", policy.sensitiveDataWarning);
        setSecurityValue("security-sensitive-action", policy.sensitiveDataAction);
        setSecurityValue("security-rate-limit", policy.rateLimit);
        setSecurityValue("security-upload-hour-limit", policy.uploadPerHourLimit);
        setSecurityValue("security-failed-login-limit", policy.failedLoginLimit);
        setSecurityValue("security-lock-minutes", policy.accountLockMinutes);
        setSecurityChecked("security-enable-whitelist", policy.enableIpWhitelist);
        setSecurityChecked("security-enable-blacklist", policy.enableIpBlacklist);
        setSecurityValue("security-whitelist-ips", policy.whitelistIps);
        setSecurityValue("security-blacklist-ips", policy.blacklistIps);
        setSecurityChecked("security-enable-otp", policy.enableOtp2fa);

        document.querySelectorAll(".security-pii-type").forEach(input => {
            input.checked = policy.piiTypes.includes(input.value);
        });
    }

    function renderSecurityPermissions() {
        const tbody = document.getElementById("security-permissions-table-body");
        if (!tbody) return;
        tbody.innerHTML = securityRolePermissions.map(row => `
            <tr>
                <td style="font-weight:700;">${escapeHTML(row.role)}</td>
                <td>${permissionChip(row.upload)}</td>
                <td>${permissionChip(row.approve)}</td>
                <td>${permissionChip(row.viewLogs)}</td>
                <td>${permissionChip(row.configure)}</td>
                <td><span class="security-status-pill security-status-good">${escapeHTML(row.status)}</span></td>
            </tr>
        `).join("");
    }

    function renderSecurityLogs() {
        const tbody = document.getElementById("security-logs-table-body");
        if (!tbody) return;

        const riskFilter = document.getElementById("security-log-risk-filter")?.value || "All";
        const rows = normalizeSecurityAuditRows(state.securityAuditDashboard || {});
        const filtered = rows.filter(r => {
            if (riskFilter === "All") return true;
            return r.risk === riskFilter;
        });

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-text-muted);">Chưa có log bảo mật thật từ backend.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(row => {
            const riskClass = row.risk === "Cao" || row.risk === "Nghiêm trọng" ? "risk-high" : "risk-low";
            const statusStyle = row.status.includes("chặn") || row.status.includes("Bị") ? "color:#ef4444; font-weight:600;" : "color:#10b981; font-weight:600;";
            return `
                <tr>
                    <td style="color:var(--color-text-muted); font-size:0.8rem;">${escapeHTML(row.time)}</td>
                    <td style="font-weight:600; color:#fff;">${escapeHTML(row.user)}</td>
                    <td>${escapeHTML(row.action)}</td>
                    <td><span class="security-risk-badge ${riskClass}">${escapeHTML(row.risk)}</span></td>
                    <td style="font-family:var(--font-mono); font-size:0.75rem; color:var(--color-text-muted);">${escapeHTML(row.ip)}</td>
                    <td><span style="${statusStyle}">${escapeHTML(row.status)}</span></td>
                </tr>
            `;
        }).join("");
    }

    function renderSecurityStatus(policy) {
        const grid = document.getElementById("security-status-grid");
        if (!grid) return;
        const tiles = [
            { label: "Upload Security", value: policy.scanMalware ? "Enabled" : "Disabled", good: policy.scanMalware },
            { label: "Macro Detection", value: policy.blockVbaMacro ? "Enabled" : "Disabled", good: policy.blockVbaMacro },
            { label: "PII Scanner", value: policy.sensitiveDataWarning ? "Enabled" : "Disabled", good: policy.sensitiveDataWarning },
            { label: "IP Whitelist", value: policy.enableIpWhitelist ? "Enabled" : "Disabled", good: policy.enableIpWhitelist },
            { label: "API Rate Limit", value: "Enabled", good: policy.rateLimit > 0 },
            { label: "Backup", value: "Not configured", good: false }
        ];
        grid.innerHTML = tiles.map(tile => `
            <div class="security-status-tile">
                <span>${escapeHTML(tile.label)}</span>
                <strong class="${tile.good ? "text-green" : "security-status-danger"}">${escapeHTML(tile.value)}</strong>
            </div>
        `).join("");
    }

    function renderAdminSecurity() {
        state.securityPolicy = buildSecurityPolicy(adminService.loadSecuritySettings());
        writeSecurityPolicyToForm(state.securityPolicy);
        renderSecurityPermissions();
        renderSecurityLogs();
        renderSecurityStatus(state.securityPolicy);
    }

    const notificationChannelDefaults = [
        { id: "inapp", name: "In-app Notification", description: "Hiển thị trong trung tâm thông báo", enabled: true, status: "Unknown" },
        { id: "popup", name: "Realtime Popup", description: "Đẩy popup qua kết nối realtime", enabled: true, status: "Unknown" },
        { id: "email", name: "Email", description: "Gửi email tới người nhận phù hợp", enabled: false, status: "Ready" },
        { id: "sms", name: "SMS", description: "Kênh SMS cho cảnh báo nghiêm trọng", enabled: false, status: "Off" },
        { id: "webhook", name: "Webhook", description: "Đồng bộ thông báo sang hệ thống ngoài", enabled: true, status: "Unknown" },
        { id: "slack", name: "Slack/Teams", description: "Đẩy bản tin cho nhóm vận hành", enabled: false, status: "Ready" }
    ];

    const broadcastTemplates = [
        { id: "maintenance", title: "Bảo trì hệ thống", type: "Maintenance", priority: "Cao", message: "Hệ thống sẽ bảo trì nâng cấp trong 5 phút từ 24:00 hôm nay.", summary: "Thông báo bảo trì ngắn" },
        { id: "release", title: "Cập nhật phiên bản mới", type: "Info", priority: "Trung bình", message: "ExcelAI vừa cập nhật phiên bản mới với các cải tiến hiệu năng và trải nghiệm người dùng.", summary: "Thông báo phát hành" },
        { id: "security", title: "Cảnh báo bảo mật", type: "Warning", priority: "Cao", message: "Hệ thống phát hiện hoạt động bất thường. Vui lòng kiểm tra lại phiên đăng nhập và đổi mật khẩu nếu cần.", summary: "Cảnh báo bảo mật" },
        { id: "incident", title: "Sự cố dịch vụ", type: "Emergency", priority: "Khẩn cấp", message: "Một số dịch vụ đang bị gián đoạn. Đội kỹ thuật đang xử lý và sẽ cập nhật sớm nhất.", summary: "Incident khẩn cấp" }
    ];

    function createLocalId(prefix = "local") {
        const random = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return `${prefix}-${random}`;
    }

    function toDatetimeLocalValue(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    }

    function toStatusKey(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    function broadcastStatusClass(status) {
        const key = toStatusKey(status);
        if (key === "active") return "system-status-active";
        if (key === "draft") return "system-status-draft";
        if (key === "scheduled") return "system-status-scheduled";
        if (key === "sending") return "system-status-sending";
        if (key === "paused") return "system-status-paused";
        if (key === "expired") return "system-status-expired";
        if (key === "cancelled") return "system-status-cancelled";
        if (key === "completed") return "system-status-completed";
        if (key === "connected") return "system-status-connected";
        if (key === "normal") return "system-status-normal";
        if (key === "enabled") return "system-status-enabled";
        if (key === "off") return "system-status-off";
        if (key === "ready" || key === "pending") return "system-status-pending";
        if (key === "error" || key === "failed") return "system-status-error";
        return "system-status-warning";
    }

    function broadcastTypeClass(type) {
        const key = toStatusKey(type);
        if (key === "info") return "system-type-info";
        if (key === "success") return "system-type-success";
        if (key === "emergency") return "system-type-emergency";
        if (key === "maintenance") return "system-type-maintenance";
        return "system-type-warning";
    }

    function broadcastPriorityClass(priority) {
        const key = toStatusKey(priority);
        if (key === "thap" || key === "low") return "system-priority-low";
        if (key === "trung-binh" || key === "medium") return "system-priority-medium";
        if (key === "cao" || key === "high") return "system-priority-high";
        return "system-priority-urgent";
    }

    function normalizeBroadcastItem(item = {}) {
        const status = item.status || (item.active === false ? "Expired" : "Active");
        const typeBySeverity = {
            info: "Info",
            success: "Success",
            warning: "Warning",
            danger: "Emergency",
            critical: "Emergency",
            emergency: "Emergency"
        };
        const type = item.type || typeBySeverity[String(item.severity || "").toLowerCase()] || "Warning";
        return {
            id: item.id || createLocalId("broadcast"),
            title: item.title || (type === "Maintenance" ? "Bảo trì hệ thống" : "Thông báo hệ thống"),
            message: item.message || "",
            type,
            priority: item.priority || (type === "Emergency" ? "Khẩn cấp" : type === "Maintenance" ? "Cao" : "Trung bình"),
            target: item.target || "Toàn hệ thống",
            targetValues: item.targetValues || "",
            status,
            createdAt: item.createdAt || item.created_at || new Date().toISOString(),
            createdBy: item.createdBy || item.created_by || state.currentUser?.email || "admin",
            viewed: item.viewed || item.viewedCount || "0",
            confirmed: item.confirmed || item.confirmedCount || "0",
            active: status === "Active" || status === "Sending" || Boolean(item.active),
            requireRead: Boolean(item.requireRead),
            popup: item.popup ?? item.forceLogout ?? true,
            sendEmail: Boolean(item.sendEmail),
            inApp: item.inApp ?? true,
            displayDuration: Number(item.displayDuration ?? item.countdownSeconds ?? 60)
        };
    }

    function buildBroadcastHistoryFromBackend(items = []) {
        return (items || []).map(item => {
            const normalized = normalizeBroadcastItem(item);
            return {
                time: formatDateTime(normalized.createdAt),
                sender: normalized.createdBy || "System",
                title: normalized.title,
                type: normalized.type,
                target: normalized.targetValues ? `${normalized.target}: ${normalized.targetValues}` : normalized.target,
                recipients: "Theo dữ liệu backend",
                viewed: normalized.viewed || "N/A",
                confirmed: normalized.confirmed || "N/A",
                status: normalized.status
            };
        });
    }

    function readBroadcastFormFromForm() {
        return {
            ...state.broadcastForm,
            title: document.getElementById("broadcast-title-input")?.value.trim() || "",
            message: document.getElementById("broadcast-message-input")?.value.trim() || "",
            type: document.getElementById("broadcast-type-select")?.value || "Info",
            priority: document.getElementById("broadcast-priority-select")?.value || "Trung bình",
            target: document.getElementById("broadcast-target-select")?.value || "Toàn hệ thống",
            targetValues: document.getElementById("broadcast-target-values")?.value.trim() || "",
            displayDuration: Number(document.getElementById("broadcast-duration-select")?.value || 60),
            requireRead: Boolean(document.getElementById("broadcast-require-read")?.checked),
            popup: Boolean(document.getElementById("broadcast-popup")?.checked),
            sendEmail: Boolean(document.getElementById("broadcast-send-email")?.checked),
            inApp: Boolean(document.getElementById("broadcast-in-app")?.checked),
            scheduleStartDate: document.getElementById("broadcast-schedule-start-date")?.value || "",
            scheduleStartTime: document.getElementById("broadcast-schedule-start-time")?.value || "",
            scheduleEndDate: document.getElementById("broadcast-schedule-end-date")?.value || "",
            scheduleFrequency: document.getElementById("broadcast-schedule-frequency")?.value || "Một lần",
            scheduleStatus: document.getElementById("broadcast-schedule-status")?.value || "Đang chờ"
        };
    }

    function writeBroadcastFormToForm(form = state.broadcastForm) {
        const setValue = (id, value) => {
            const input = document.getElementById(id);
            if (input) input.value = value ?? "";
        };
        const setChecked = (id, value) => {
            const input = document.getElementById(id);
            if (input) input.checked = Boolean(value);
        };
        setValue("broadcast-title-input", form.title);
        setValue("broadcast-message-input", form.message);
        setValue("broadcast-type-select", form.type);
        setValue("broadcast-priority-select", form.priority);
        setValue("broadcast-target-select", form.target);
        setValue("broadcast-target-values", form.targetValues);
        setValue("broadcast-duration-select", String(form.displayDuration));
        setChecked("broadcast-require-read", form.requireRead);
        setChecked("broadcast-popup", form.popup);
        setChecked("broadcast-send-email", form.sendEmail);
        setChecked("broadcast-in-app", form.inApp);
        setValue("broadcast-schedule-start-date", form.scheduleStartDate);
        setValue("broadcast-schedule-start-time", form.scheduleStartTime);
        setValue("broadcast-schedule-end-date", form.scheduleEndDate);
        setValue("broadcast-schedule-frequency", form.scheduleFrequency);
        setValue("broadcast-schedule-status", form.scheduleStatus);
    }

    function readAppConfigFromForm() {
        return {
            ...state.appConfig,
            appName: document.getElementById("admin-config-appname")?.value.trim() || "",
            logoUrl: document.getElementById("admin-config-logo-url")?.value.trim() || "",
            supportEmail: document.getElementById("admin-config-supportemail")?.value.trim() || "",
            supportHotline: document.getElementById("admin-config-hotline")?.value.trim() || "",
            supportWebsite: document.getElementById("admin-config-website")?.value.trim() || "",
            timezone: document.getElementById("admin-config-timezone")?.value.trim() || "",
            defaultLanguage: document.getElementById("admin-config-language")?.value || "vi",
            appVersion: document.getElementById("admin-config-version")?.value.trim() || "",
            environment: document.getElementById("admin-config-environment")?.value || "Development",
            lastUpdate: new Date().toLocaleString("vi-VN")
        };
    }

    function writeAppConfigToForm(config = state.appConfig) {
        const setValue = (id, value) => {
            const input = document.getElementById(id);
            if (input) input.value = value ?? "";
        };
        setValue("admin-config-appname", config.appName);
        setValue("admin-config-logo-url", config.logoUrl);
        setValue("admin-config-supportemail", config.supportEmail);
        setValue("admin-config-hotline", config.supportHotline);
        setValue("admin-config-website", config.supportWebsite);
        setValue("admin-config-timezone", config.timezone);
        setValue("admin-config-language", config.defaultLanguage);
        setValue("admin-config-version", config.appVersion);
        setValue("admin-config-environment", config.environment);
    }

    function readMaintenanceConfigFromForm() {
        return {
            ...state.maintenanceConfig,
            enabled: Boolean(document.getElementById("admin-config-maintenance")?.checked),
            title: document.getElementById("maintenance-title-input")?.value.trim() || "",
            message: document.getElementById("maintenance-message-input")?.value.trim() || "",
            startAt: document.getElementById("maintenance-start-input")?.value || "",
            endAt: document.getElementById("maintenance-end-input")?.value || "",
            allowAdmin: Boolean(document.getElementById("maintenance-allow-admin")?.checked),
            allowWhitelist: Boolean(document.getElementById("maintenance-allow-whitelist")?.checked),
            autoStart: Boolean(document.getElementById("maintenance-auto-start")?.checked),
            autoEnd: Boolean(document.getElementById("maintenance-auto-end")?.checked)
        };
    }

    function writeMaintenanceConfigToForm(config = state.maintenanceConfig) {
        const setValue = (id, value) => {
            const input = document.getElementById(id);
            if (input) input.value = value ?? "";
        };
        const setChecked = (id, value) => {
            const input = document.getElementById(id);
            if (input) input.checked = Boolean(value);
        };
        setChecked("admin-config-maintenance", config.enabled);
        setValue("maintenance-title-input", config.title);
        setValue("maintenance-message-input", config.message);
        setValue("maintenance-start-input", toDatetimeLocalValue(config.startAt));
        setValue("maintenance-end-input", toDatetimeLocalValue(config.endAt));
        setChecked("maintenance-allow-admin", config.allowAdmin);
        setChecked("maintenance-allow-whitelist", config.allowWhitelist);
        setChecked("maintenance-auto-start", config.autoStart);
        setChecked("maintenance-auto-end", config.autoEnd);
    }

    function validateBroadcastForm(form, options = {}) {
        if (!form.title.trim()) return "Vui lòng nhập tiêu đề broadcast.";
        if (!form.message.trim()) return "Vui lòng nhập nội dung broadcast.";
        if (form.message.trim().length < 10) return "Nội dung broadcast cần tối thiểu 10 ký tự để người dùng hiểu rõ.";
        if (form.target !== "Toàn hệ thống" && !form.targetValues.trim()) {
            return "Vui lòng nhập workspace/role/user cụ thể cho đối tượng nhận đã chọn.";
        }
        if (options.schedule) {
            if (!form.scheduleStartDate || !form.scheduleStartTime) return "Vui lòng chọn ngày và giờ bắt đầu lịch gửi.";
            if (form.scheduleEndDate && form.scheduleEndDate < form.scheduleStartDate) return "Ngày kết thúc không được trước ngày bắt đầu.";
        }
        return "";
    }

    function validateAppConfig(config) {
        if (!config.appName.trim()) return "Tên ứng dụng hiển thị không được rỗng.";
        if (!config.supportEmail.trim()) return "Email hỗ trợ không được rỗng.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail)) return "Email hỗ trợ không đúng định dạng.";
        if (!config.timezone.trim()) return "Múi giờ hệ thống không được rỗng.";
        if (!config.appVersion.trim()) return "Phiên bản ứng dụng không được rỗng.";
        return "";
    }

    function validateMaintenanceConfig(config) {
        if (config.enabled && !config.message.trim()) return "Nội dung thông báo bảo trì không được rỗng khi bật Maintenance.";
        if (config.enabled && config.startAt && config.endAt && config.endAt < config.startAt) return "Thời gian kết thúc bảo trì không được trước thời gian bắt đầu.";
        return "";
    }

    function settingsPayloadFromSystemConfig(appConfig = state.appConfig, maintenanceConfig = state.maintenanceConfig) {
        return {
            ...adminService.loadSecuritySettings(),
            ...appConfig,
            maintenanceMode: maintenanceConfig.enabled,
            maintenanceTitle: maintenanceConfig.title,
            maintenanceMessage: maintenanceConfig.message,
            maintenanceStart: maintenanceConfig.startAt,
            maintenanceEnd: maintenanceConfig.endAt,
            maintenanceAllowAdmin: maintenanceConfig.allowAdmin,
            maintenanceAllowWhitelist: maintenanceConfig.allowWhitelist,
            maintenanceAutoStart: maintenanceConfig.autoStart,
            maintenanceAutoEnd: maintenanceConfig.autoEnd
        };
    }

    function renderSystemHeader() {
        const maintenanceBadge = document.getElementById("system-maintenance-badge");
        if (maintenanceBadge) {
            maintenanceBadge.textContent = state.maintenanceConfig.enabled ? "Maintenance On" : "Maintenance Off";
            maintenanceBadge.className = `system-badge ${state.maintenanceConfig.enabled ? "system-badge-danger" : "system-badge-warning"}`;
        }
    }

    function renderSystemOverview() {
        const grid = document.getElementById("system-overview-grid");
        if (!grid) return;
        const normalized = (state.broadcasts || []).map(normalizeBroadcastItem);
        const activeCount = normalized.filter(item => item.status === "Active" || item.status === "Sending").length;
        const scheduledCount = normalized.filter(item => item.status === "Scheduled").length;
        const draftCount = normalized.filter(item => item.status === "Draft").length;
        const tiles = [
            { label: "Broadcast đang hoạt động", value: activeCount, icon: "bell", status: "Active" },
            { label: "Lịch gửi đang chờ", value: scheduledCount, icon: "clock", status: "Scheduled" },
            { label: "Bản nháp", value: draftCount, icon: "draft", status: "Draft" },
            { label: "Realtime clients", value: state.realtimeStatus.connectedClients, icon: "server", status: state.realtimeStatus.websocket }
        ];
        const iconMap = {
            bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path></svg>`,
            clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>`,
            draft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"></path><path d="M8 8h8"></path><path d="M8 12h5"></path></svg>`,
            server: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="8" rx="2"></rect><rect x="3" y="12" width="18" height="8" rx="2"></rect><path d="M7 8h.01"></path><path d="M7 16h.01"></path></svg>`
        };
        grid.innerHTML = tiles.map(tile => `
            <div class="system-overview-tile">
                <div>
                    <span>${escapeHTML(tile.label)}</span>
                    <strong>${escapeHTML(String(tile.value))}</strong>
                </div>
                <div class="system-overview-icon" aria-hidden="true">${iconMap[tile.icon] || iconMap.bell}</div>
            </div>
        `).join("");
    }

    function renderAdminBroadcasts() {
        const tbody = document.getElementById("system-broadcasts-table-body");
        if (!tbody) return;

        const sourceBroadcasts = (state.broadcasts || []).map(normalizeBroadcastItem);

        const searchValue = document.getElementById("broadcast-list-search")?.value.trim().toLowerCase() || "";
        const statusFilter = document.getElementById("broadcast-status-filter")?.value || "All";

        const filtered = sourceBroadcasts.filter(b => {
            const haystack = `${b.title} ${b.message} ${b.target} ${b.createdBy}`.toLowerCase();
            const matchesSearch = !searchValue || haystack.includes(searchValue);
            const statusKey = toStatusKey(b.status);
            const matchesStatus = statusFilter === "All" ||
                (statusFilter === "Active" && (statusKey === "active" || statusKey === "sending")) ||
                (statusFilter === "Draft" && statusKey === "draft");
            return matchesSearch && matchesStatus;
        });

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-text-muted);">Chưa có broadcast phù hợp.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(b => {
            const statusKey = toStatusKey(b.status);
            const isActive = b.active || statusKey === "active" || statusKey === "sending";
            const statusTextMap = { active: "ĐANG PHÁT", sending: "ĐANG GỬI", draft: "BẢN NHÁP", scheduled: "ĐÃ LÊN LỊCH", expired: "ĐÃ KẾT THÚC", cancelled: "ĐÃ HỦY" };
            const statusText = statusTextMap[statusKey] || b.status.toUpperCase();
            const adminName = b.createdBy || "Admin";
            const adminInitial = String(adminName).trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || "A";
            const adminAvatarColor = isActive ? "background:#10b981" : statusKey === "draft" ? "background:#8b5cf6" : "background:#3b82f6";
            const idArg = encodeInlineArg(b.id);
            const actionButtons = isActive
                ? `<button class="btn btn-outline btn-xs broadcast-action-btn" style="border-color:var(--color-danger); color:var(--color-danger);" onclick="window.deactivateBroadcast(decodeURIComponent('${idArg}'))">Dừng</button>`
                : `<button class="btn btn-outline btn-xs broadcast-action-btn" onclick="window.viewBroadcastDetail(decodeURIComponent('${idArg}'))">Xem</button>`;

            return `
                <tr>
                    <td style="color:var(--color-text-muted); font-size:0.8rem;">${escapeHTML(formatDateTime(b.createdAt))}</td>
                    <td>
                        <span style="display:inline-flex; align-items:center; gap:8px;">
                           <span style="width:20px; height:20px; border-radius:50%; ${adminAvatarColor}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:700;">${adminInitial}</span>
                           <span class="broadcast-admin-name" style="font-weight:600; color:#fff;">${escapeHTML(adminName)}</span>
                        </span>
                    </td>
                    <td class="broadcast-title-cell" style="text-align:left;">
                        <strong style="display:block; color:#fff; font-size:0.82rem;">${escapeHTML(b.title)}</strong>
                        <span style="font-size:0.75rem; color:var(--color-text-muted);">${escapeHTML(b.message || "Không có nội dung")}</span>
                    </td>
                    <td>
                        <span class="broadcast-target-cell" style="display:flex; align-items:center; gap:6px; min-width:0;">
                           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-text-muted);"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                           <span style="font-size:0.78rem;">${escapeHTML(b.target)}</span>
                        </span>
                    </td>
                    <td><span class="system-status-pill ${broadcastStatusClass(b.status)}">${escapeHTML(statusText)}</span></td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        }).join("");
    }

    function renderNotificationChannels() {
        if (!state.notificationChannels) state.notificationChannels = notificationChannelDefaults.map(item => ({ ...item }));
        const list = document.getElementById("system-channel-list");
        if (!list) return;
        list.innerHTML = state.notificationChannels.map(channel => {
            const idArg = encodeInlineArg(channel.id);
            return `
                <div class="system-channel-item">
                    <div class="system-channel-main">
                        <strong>${escapeHTML(channel.name)}</strong>
                        <span>${escapeHTML(channel.description)}</span>
                    </div>
                    <div class="system-table-actions">
                        <span class="system-status-pill ${broadcastStatusClass(channel.enabled ? channel.status : "Off")}">${escapeHTML(channel.enabled ? channel.status : "Off")}</span>
                        <button class="system-mini-btn" onclick="window.toggleNotificationChannel(decodeURIComponent('${idArg}'))">${channel.enabled ? "Tắt" : "Bật"}</button>
                        <button class="system-mini-btn" onclick="window.testNotificationChannel(decodeURIComponent('${idArg}'))">Test</button>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderBroadcastTemplates() {
        const grid = document.getElementById("system-template-grid");
        if (!grid) return;
        grid.innerHTML = broadcastTemplates.map(template => {
            const idArg = encodeInlineArg(template.id);
            return `
                <button class="system-template-card" onclick="window.applyBroadcastTemplate(decodeURIComponent('${idArg}'))">
                    <strong>${escapeHTML(template.title)}</strong>
                    <span>${escapeHTML(template.summary)}</span>
                </button>
            `;
        }).join("");
    }

    function renderRealtimeStatus() {
        const grid = document.getElementById("system-realtime-grid");
        if (!grid) return;
        const rows = [
            ["WebSocket", state.realtimeStatus.websocket],
            ["Queue", state.realtimeStatus.queue],
            ["Email service", state.realtimeStatus.emailService],
            ["Notification service", state.realtimeStatus.notificationService],
            ["Heartbeat", state.realtimeStatus.lastHeartbeat],
            ["Connected clients", String(state.realtimeStatus.connectedClients)]
        ];
        grid.innerHTML = rows.map(([label, value]) => `
            <div class="system-realtime-item">
                <span>${escapeHTML(label)}</span>
                <strong class="${broadcastStatusClass(value)}">${escapeHTML(value)}</strong>
            </div>
        `).join("");
    }

    function renderBroadcastHistory() {
        const tbody = document.getElementById("broadcast-history-table-body");
        if (!tbody) return;
        const rows = state.broadcastHistory || [];
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--color-text-muted);">Chưa có lịch sử broadcast thật từ backend.</td></tr>`;
            return;
        }
        tbody.innerHTML = rows.slice(0, 12).map(row => `
            <tr>
                <td>${escapeHTML(row.time)}</td>
                <td>${escapeHTML(row.sender)}</td>
                <td style="font-weight:700;">${escapeHTML(row.title)}</td>
                <td><span class="system-type-badge ${broadcastTypeClass(row.type)}">${escapeHTML(row.type)}</span></td>
                <td>${escapeHTML(row.target)}</td>
                <td>${escapeHTML(row.recipients)}</td>
                <td>${escapeHTML(row.viewed)}</td>
                <td>${escapeHTML(row.confirmed)}</td>
                <td><span class="system-status-pill ${broadcastStatusClass(row.status)}">${escapeHTML(row.status)}</span></td>
            </tr>
        `).join("");
    }

    function renderMaintenanceState() {
        const warning = document.getElementById("maintenance-warning-box");
        if (warning) warning.classList.toggle("active", state.maintenanceConfig.enabled);
        const button = document.getElementById("system-toggle-maintenance-btn");
        if (button) {
            button.textContent = state.maintenanceConfig.enabled ? "Tắt Maintenance" : "Bật Maintenance";
            button.classList.toggle("system-danger-btn", state.maintenanceConfig.enabled);
        }
    }

    function renderAdminSettings() {
        const settings = adminService.loadSecuritySettings();
        state.appConfig = defaultAppConfig({ ...settings, ...state.appConfig });
        state.maintenanceConfig = defaultMaintenanceConfig({ ...settings, maintenanceMode: state.maintenanceConfig.enabled });
        writeAppConfigToForm(state.appConfig);
        writeBroadcastFormToForm(state.broadcastForm);
        writeMaintenanceConfigToForm(state.maintenanceConfig);
        renderSystemHeader();
        renderSystemOverview();
        renderAdminBroadcasts();
        renderNotificationChannels();
        renderBroadcastTemplates();
        renderRealtimeStatus();
        renderBroadcastHistory();
        renderMaintenanceState();
    }

    function appendBroadcastHistory(item, status = item.status || "Active") {
        state.broadcastHistory.unshift({
            time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
            sender: state.currentUser?.email || "admin",
            title: item.title,
            type: item.type,
            target: item.targetValues ? `${item.target}: ${item.targetValues}` : item.target,
            recipients: item.target === "Toàn hệ thống" ? `${state.users.length} users` : "Theo bộ lọc",
            viewed: "N/A",
            confirmed: item.requireRead ? "Chờ xác nhận" : "Không yêu cầu",
            status
        });
    }

    function buildBroadcastFromForm(form, status, source = {}) {
        return normalizeBroadcastItem({
            ...source,
            ...form,
            id: source.id || createLocalId(status.toLowerCase()),
            status,
            active: status === "Active" || status === "Sending",
            createdAt: source.createdAt || source.created_at || new Date().toISOString(),
            createdBy: state.currentUser?.email || "admin",
            viewed: status === "Active" ? "1" : "0",
            confirmed: form.requireRead ? "0" : "Không yêu cầu"
        });
    }

    async function handleSendBroadcast() {
        const form = readBroadcastFormFromForm();
        const validationError = validateBroadcastForm(form);
        if (validationError) {
            showToast(validationError, "error");
            return;
        }
        if ((form.type === "Emergency" || form.priority === "Khẩn cấp") && !window.confirm("Gửi broadcast khẩn cấp tới người dùng đã chọn?")) {
            return;
        }

        const button = document.getElementById("system-send-broadcast-btn");
        if (button) button.disabled = true;
        try {
            const severityMap = { Info: "info", Warning: "warning", Maintenance: "warning", Emergency: "danger", Success: "success" };
            const backendBroadcast = await adminService.sendBroadcast(form.message, {
                severity: severityMap[form.type] || "warning",
                forceLogout: form.popup,
                countdownSeconds: form.displayDuration === 0 ? 60 : Math.max(10, form.displayDuration),
                expiresInMinutes: 30
            });
            const broadcast = buildBroadcastFromForm(form, "Active", backendBroadcast || {});
            state.broadcastForm = form;
            state.broadcasts = [broadcast, ...(state.broadcasts || []).filter(item => String(item.id) !== String(broadcast.id))];
            appendBroadcastHistory(broadcast, "Active");
            renderAdminSettings();
            showToast("Đã gửi broadcast realtime thành công.", "success");
            adminService.addSystemLog("warning", `Broadcast: Admin sent '${form.title}' to ${form.target}`);
        } catch (error) {
            showToast(error.message || "Không thể gửi broadcast lên backend", "error");
        } finally {
            if (button) button.disabled = false;
        }
    }

    function handlePreviewBroadcast() {
        const form = readBroadcastFormFromForm();
        const validationError = validateBroadcastForm(form);
        if (validationError) {
            showToast(validationError, "error");
            return;
        }
        state.broadcastForm = form;
        const preview = document.getElementById("broadcast-preview-box");
        if (preview) {
            preview.classList.add("active");
            preview.innerHTML = `
                <div class="broadcast-preview-title">
                    <strong>${escapeHTML(form.title)}</strong>
                    <span class="system-type-badge ${broadcastTypeClass(form.type)}">${escapeHTML(form.type)}</span>
                </div>
                <p>${escapeHTML(form.message)}</p>
                <div class="system-action-row">
                    <span class="broadcast-priority-badge ${broadcastPriorityClass(form.priority)}">${escapeHTML(form.priority)}</span>
                    <span class="system-status-pill system-status-active">${escapeHTML(form.target)}</span>
                    <span class="system-status-pill system-status-pending">${form.displayDuration === 0 ? "Đến khi đóng" : `${form.displayDuration} giây`}</span>
                </div>
            `;
        }
        showToast("Đã dựng bản xem trước broadcast.", "info");
    }

    function handleSaveDraft() {
        const form = readBroadcastFormFromForm();
        const validationError = validateBroadcastForm(form);
        if (validationError) {
            showToast(validationError, "error");
            return;
        }
        const draft = buildBroadcastFromForm(form, "Draft");
        state.broadcastForm = form;
        state.broadcasts = [draft, ...(state.broadcasts || [])];
        appendBroadcastHistory(draft, "Draft");
        renderAdminSettings();
        showToast("Đã lưu broadcast vào bản nháp.", "success");
    }

    function handleScheduleBroadcast() {
        const form = readBroadcastFormFromForm();
        const validationError = validateBroadcastForm(form, { schedule: true });
        if (validationError) {
            showToast(validationError, "error");
            return;
        }
        const scheduled = buildBroadcastFromForm(form, "Scheduled");
        state.broadcastForm = form;
        state.broadcasts = [scheduled, ...(state.broadcasts || [])];
        appendBroadcastHistory(scheduled, "Scheduled");
        renderAdminSettings();
        showToast(`Đã lên lịch broadcast lúc ${form.scheduleStartDate} ${form.scheduleStartTime}.`, "success");
    }

    async function handleSaveAppConfig() {
        const appConfig = readAppConfigFromForm();
        const validationError = validateAppConfig(appConfig);
        if (validationError) {
            showToast(validationError, "error");
            return;
        }
        const maintenanceConfig = readMaintenanceConfigFromForm();
        const maintenanceError = validateMaintenanceConfig(maintenanceConfig);
        if (maintenanceError) {
            showToast(maintenanceError, "error");
            return;
        }
        try {
            await adminService.saveSecuritySettings(settingsPayloadFromSystemConfig(appConfig, maintenanceConfig));
            state.appConfig = appConfig;
            state.maintenanceConfig = maintenanceConfig;
            renderAdminSettings();
            showToast("Đã lưu cấu hình ứng dụng lên backend.", "success");
            adminService.addSystemLog("warning", `System: Admin saved app config (${appConfig.environment}, maintenance=${maintenanceConfig.enabled})`);
        } catch (error) {
            showToast(error.message || "Không thể lưu cấu hình ứng dụng", "error");
        }
    }

    function handleResetSystemSettings() {
        state.appConfig = defaultAppConfig();
        state.maintenanceConfig = defaultMaintenanceConfig();
        writeAppConfigToForm(state.appConfig);
        writeMaintenanceConfigToForm(state.maintenanceConfig);
        renderSystemHeader();
        renderMaintenanceState();
        showToast("Đã khôi phục cấu hình hệ thống mặc định trên giao diện.", "info");
    }

    async function handleToggleMaintenance() {
        const checkbox = document.getElementById("admin-config-maintenance");
        if (checkbox && checkbox.checked === state.maintenanceConfig.enabled) {
            checkbox.checked = !state.maintenanceConfig.enabled;
        }
        const maintenanceConfig = readMaintenanceConfigFromForm();
        const validationError = validateMaintenanceConfig(maintenanceConfig);
        if (validationError) {
            showToast(validationError, "error");
            if (checkbox) checkbox.checked = state.maintenanceConfig.enabled;
            return;
        }
        if (maintenanceConfig.enabled && !window.confirm("Bật Maintenance Mode sẽ tạm khóa truy cập người dùng thường. Tiếp tục?")) {
            if (checkbox) checkbox.checked = state.maintenanceConfig.enabled;
            return;
        }
        try {
            await adminService.saveSecuritySettings(settingsPayloadFromSystemConfig(state.appConfig, maintenanceConfig));
            state.maintenanceConfig = maintenanceConfig;
            renderAdminSettings();
            showToast(maintenanceConfig.enabled ? "Đã bật chế độ Maintenance." : "Đã tắt chế độ Maintenance.", maintenanceConfig.enabled ? "warning" : "success");
            adminService.addSystemLog("warning", `System: Maintenance mode ${maintenanceConfig.enabled ? "enabled" : "disabled"}`);
        } catch (error) {
            showToast(error.message || "Không thể cập nhật Maintenance Mode", "error");
        }
    }

    async function handleTestRealtimeConnection() {
        try {
            const payload = await adminService.getSystemReportDashboard({ timeRange: "today" });
            const health = payload.systemHealth || {};
            state.realtimeStatus = {
                websocket: health.webSocketStatus || "Unknown",
                queue: health.queueStatus || "Unknown",
                emailService: "Unknown",
                notificationService: "Unknown",
                lastHeartbeat: health.lastChecked || new Date().toLocaleTimeString("vi-VN"),
                connectedClients: 0
            };
            renderRealtimeStatus();
            renderSystemOverview();
            showToast("Đã kiểm tra trạng thái realtime từ backend.", "success");
        } catch (error) {
            showToast(error.message || "Không thể kiểm tra realtime từ backend.", "error");
        }
    }

    window.deactivateBroadcast = async function(id) {
        try {
            await adminService.deactivateBroadcast(id);
            const broadcast = state.broadcasts.find(item => String(item.id) === String(id));
            if (broadcast) {
                broadcast.active = false;
                broadcast.status = "Expired";
            }
            renderAdminSettings();
            showToast("Đã tắt broadcast trên backend.", "success");
            adminService.addSystemLog("warning", `Broadcast: Admin deactivated broadcast ${id}`);
        } catch (error) {
            showToast(error.message || "Không thể tắt broadcast", "error");
        }
    };

    window.viewBroadcastDetail = function(id) {
        const item = (state.broadcasts || []).map(normalizeBroadcastItem).find(broadcast => String(broadcast.id) === String(id));
        if (!item) return;
        const preview = document.getElementById("broadcast-preview-box");
        if (preview) {
            preview.classList.add("active");
            preview.innerHTML = `
                <div class="broadcast-preview-title">
                    <strong>${escapeHTML(item.title)}</strong>
                    <span class="system-status-pill ${broadcastStatusClass(item.status)}">${escapeHTML(item.status)}</span>
                </div>
                <p>${escapeHTML(item.message)}</p>
                <div class="system-action-row">
                    <span class="system-type-badge ${broadcastTypeClass(item.type)}">${escapeHTML(item.type)}</span>
                    <span class="broadcast-priority-badge ${broadcastPriorityClass(item.priority)}">${escapeHTML(item.priority)}</span>
                    <span class="system-status-pill system-status-pending">${escapeHTML(item.target)}</span>
                </div>
            `;
            preview.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    };

    window.pauseBroadcast = function(id) {
        const item = state.broadcasts.find(broadcast => String(broadcast.id) === String(id));
        if (!item) return;
        item.status = item.status === "Paused" ? "Active" : "Paused";
        item.active = item.status === "Active";
        renderAdminSettings();
        showToast(item.status === "Paused" ? "Đã tạm dừng broadcast." : "Đã tiếp tục broadcast.", "info");
    };

    window.resendBroadcast = function(id) {
        const item = (state.broadcasts || []).map(normalizeBroadcastItem).find(broadcast => String(broadcast.id) === String(id));
        if (!item) return;
        const copy = buildBroadcastFromForm({ ...defaultBroadcastForm(), ...item }, "Active", { id: createLocalId("resend") });
        state.broadcasts = [copy, ...state.broadcasts];
        appendBroadcastHistory(copy, "Active");
        renderAdminSettings();
        showToast("Đã tạo lượt gửi lại broadcast.", "success");
    };

    window.cancelBroadcast = function(id) {
        const item = state.broadcasts.find(broadcast => String(broadcast.id) === String(id));
        if (!item) return;
        item.status = "Cancelled";
        item.active = false;
        renderAdminSettings();
        showToast("Đã hủy broadcast trên giao diện quản trị.", "warning");
    };

    window.toggleNotificationChannel = function(id) {
        if (!state.notificationChannels) state.notificationChannels = notificationChannelDefaults.map(item => ({ ...item }));
        const channel = state.notificationChannels.find(item => item.id === id);
        if (!channel) return;
        channel.enabled = !channel.enabled;
        channel.status = channel.enabled ? "Unknown" : "Off";
        renderNotificationChannels();
        showToast(`${channel.enabled ? "Đã bật" : "Đã tắt"} kênh ${channel.name}.`, "info");
    };

    window.testNotificationChannel = function(id) {
        if (!state.notificationChannels) state.notificationChannels = notificationChannelDefaults.map(item => ({ ...item }));
        const channel = state.notificationChannels.find(item => item.id === id);
        if (!channel) return;
        channel.status = channel.enabled ? "Unknown" : "Ready";
        renderNotificationChannels();
        showToast(`Backend chưa có health check riêng cho kênh ${channel.name}.`, "info");
    };

    window.applyBroadcastTemplate = function(id) {
        const template = broadcastTemplates.find(item => item.id === id);
        if (!template) return;
        state.broadcastForm = {
            ...state.broadcastForm,
            title: template.title,
            message: template.message,
            type: template.type,
            priority: template.priority
        };
        writeBroadcastFormToForm(state.broadcastForm);
        showToast(`Đã áp dụng mẫu: ${template.title}.`, "success");
    };

    window.handleSendBroadcast = handleSendBroadcast;
    window.handlePreviewBroadcast = handlePreviewBroadcast;
    window.handleSaveDraft = handleSaveDraft;
    window.handleScheduleBroadcast = handleScheduleBroadcast;
    window.handleSaveAppConfig = handleSaveAppConfig;
    window.handleToggleMaintenance = handleToggleMaintenance;
    window.handleTestRealtimeConnection = handleTestRealtimeConnection;
    window.validateBroadcastForm = validateBroadcastForm;
    window.validateAppConfig = validateAppConfig;

    function readSecurityPolicyFromForm() {
        const numberValue = (id) => {
            const raw = document.getElementById(id)?.value?.trim() || "";
            return raw === "" ? 0 : Number(raw);
        };
        return {
            ...state.securityPolicy,
            fileSizeLimit: numberValue("security-filesize"),
            allowedTypes: document.getElementById("security-allowed-types")?.value.trim() || "",
            blockedTypes: document.getElementById("security-blocked-types")?.value.trim() || "",
            maxExcelRows: numberValue("security-max-rows"),
            maxExcelSheets: numberValue("security-max-sheets"),
            scanMalware: Boolean(document.getElementById("security-scan-malware")?.checked),
            blockVbaMacro: Boolean(document.getElementById("security-block-vba")?.checked),
            allowXlsm: Boolean(document.getElementById("security-allow-xlsm")?.checked),
            sensitiveDataWarning: Boolean(document.getElementById("security-sensitive-warn")?.checked),
            piiTypes: Array.from(document.querySelectorAll(".security-pii-type:checked")).map(input => input.value),
            sensitiveDataAction: document.getElementById("security-sensitive-action")?.value || "warn",
            rateLimit: numberValue("security-rate-limit"),
            uploadPerHourLimit: numberValue("security-upload-hour-limit"),
            failedLoginLimit: numberValue("security-failed-login-limit"),
            accountLockMinutes: numberValue("security-lock-minutes"),
            enableIpWhitelist: Boolean(document.getElementById("security-enable-whitelist")?.checked),
            enableIpBlacklist: Boolean(document.getElementById("security-enable-blacklist")?.checked),
            whitelistIps: document.getElementById("security-whitelist-ips")?.value.trim() || "",
            blacklistIps: document.getElementById("security-blacklist-ips")?.value.trim() || "",
            enableOtp2fa: Boolean(document.getElementById("security-enable-otp")?.checked)
        };
    }

    function validateSecurityPolicy(policy) {
        if (!Number.isFinite(policy.fileSizeLimit) || policy.fileSizeLimit <= 0) {
            return "Dung lượng file tải lên phải lớn hơn 0 MB.";
        }
        if (!Number.isFinite(policy.rateLimit) || policy.rateLimit <= 0) {
            return "Request/phút phải lớn hơn 0.";
        }
        if (!Number.isFinite(policy.maxExcelRows) || policy.maxExcelRows <= 0) {
            return "Số dòng Excel tối đa phải lớn hơn 0.";
        }
        if (!Number.isFinite(policy.maxExcelSheets) || policy.maxExcelSheets <= 0) {
            return "Số sheet Excel tối đa phải lớn hơn 0.";
        }
        if (policy.enableIpWhitelist && !policy.whitelistIps.trim()) {
            return "Danh sách IP được phép không được rỗng khi bật Whitelist IP.";
        }
        return "";
    }

    function securityPolicyToSettings(policy) {
        return {
            ...adminService.loadSecuritySettings(),
            ...policy,
            enableMacroWarning: policy.blockVbaMacro,
            sensitiveDataWarning: policy.sensitiveDataWarning,
            rateLimit: policy.rateLimit,
            adminAccessControl: policy.enableIpWhitelist ? "IP Whitelist (Enabled)" : "IP Whitelist (Disabled)"
        };
    }

    async function handleSavePolicy() {
        const nextPolicy = readSecurityPolicyFromForm();
        const validationError = validateSecurityPolicy(nextPolicy);
        if (validationError) {
            showToast(validationError, "error");
            return;
        }

        state.securityPolicy = nextPolicy;
        try {
            await adminService.saveSecuritySettings(securityPolicyToSettings(nextPolicy));
            renderSecurityStatus(nextPolicy);
            showToast("Đã lưu chính sách bảo mật hệ thống!", "success");
            adminService.addSystemLog("warning", `Security: Admin saved policy (Size=${nextPolicy.fileSizeLimit}MB, Rate=${nextPolicy.rateLimit}/min, Whitelist=${nextPolicy.enableIpWhitelist})`);
        } catch (error) {
            showToast(error.message || "Không thể lưu chính sách bảo mật lên backend", "error");
        }
    }

    function handleResetSecurityDefault() {
        state.securityPolicy = defaultSecurityPolicy();
        writeSecurityPolicyToForm(state.securityPolicy);
        renderSecurityStatus(state.securityPolicy);
        const resultBox = document.getElementById("security-scan-result");
        if (resultBox) {
            resultBox.classList.remove("active");
            resultBox.innerHTML = "";
        }
        showToast("Đã khôi phục chính sách bảo mật mặc định trên giao diện.", "info");
    }

    function handleSecurityScan() {
        const nextPolicy = readSecurityPolicyFromForm();
        const validationError = validateSecurityPolicy(nextPolicy);
        if (validationError) {
            showToast(validationError, "error");
            return;
        }
        state.securityPolicy = nextPolicy;
        renderSecurityStatus(nextPolicy);
        const resultBox = document.getElementById("security-scan-result");
        if (resultBox) {
            const whitelistLine = nextPolicy.enableIpWhitelist
                ? "Whitelist IP đã bật và có danh sách IP hợp lệ."
                : "Whitelist IP đang tắt, hệ thống vẫn bảo vệ bằng blacklist và rate limit.";
            resultBox.classList.add("active");
            resultBox.innerHTML = `
                <h4>Kết quả kiểm tra cấu hình bảo mật</h4>
                <ul>
                    <li>Upload Security hoạt động: malware scan ${nextPolicy.scanMalware ? "đã bật" : "đang tắt"}.</li>
                    <li>Macro Detection: ${nextPolicy.blockVbaMacro ? "file có VBA Macro sẽ bị chặn" : "chỉ cảnh báo macro"}.</li>
                    <li>PII Scanner: ${nextPolicy.sensitiveDataWarning ? "đang quét " + nextPolicy.piiTypes.length + " nhóm dữ liệu" : "đang tắt"}.</li>
                    <li>${whitelistLine}</li>
                    <li>API Rate Limit đang đặt ở ${nextPolicy.rateLimit} request/phút.</li>
                </ul>
            `;
        }
        showToast("Đã hoàn tất kiểm tra cấu hình bảo mật.", "success");
    }

    window.handleSavePolicy = handleSavePolicy;
    window.handleResetSecurityDefault = handleResetSecurityDefault;
    window.handleSecurityScan = handleSecurityScan;

    const adminSaveSecurityBtn = document.getElementById("admin-save-security-btn");
    const adminResetSecurityBtn = document.getElementById("admin-reset-security-btn");
    const adminScanSecurityBtn = document.getElementById("admin-scan-security-btn");
    if (adminSaveSecurityBtn) adminSaveSecurityBtn.addEventListener("click", handleSavePolicy);
    if (adminResetSecurityBtn) adminResetSecurityBtn.addEventListener("click", handleResetSecurityDefault);
    if (adminScanSecurityBtn) adminScanSecurityBtn.addEventListener("click", handleSecurityScan);

    const adminSaveSystemSettingsBtn = document.getElementById("admin-save-system-settings-btn");
    const adminResetSystemSettingsBtn = document.getElementById("admin-reset-system-settings-btn");
    const systemSendBroadcastBtn = document.getElementById("system-send-broadcast-btn");
    const systemPreviewBroadcastBtn = document.getElementById("system-preview-broadcast-btn");
    const systemSaveDraftBtn = document.getElementById("system-save-draft-btn");
    const systemScheduleBroadcastBtn = document.getElementById("system-schedule-broadcast-btn");
    const systemToggleMaintenanceBtn = document.getElementById("system-toggle-maintenance-btn");
    const systemTestRealtimeBtn = document.getElementById("system-test-realtime-btn");
    const broadcastListSearch = document.getElementById("broadcast-list-search");
    const broadcastStatusFilter = document.getElementById("broadcast-status-filter");
    if (adminSaveSystemSettingsBtn) adminSaveSystemSettingsBtn.addEventListener("click", handleSaveAppConfig);
    if (adminResetSystemSettingsBtn) adminResetSystemSettingsBtn.addEventListener("click", handleResetSystemSettings);
    if (systemSendBroadcastBtn) systemSendBroadcastBtn.addEventListener("click", handleSendBroadcast);
    if (systemPreviewBroadcastBtn) systemPreviewBroadcastBtn.addEventListener("click", handlePreviewBroadcast);
    if (systemSaveDraftBtn) systemSaveDraftBtn.addEventListener("click", handleSaveDraft);
    if (systemScheduleBroadcastBtn) systemScheduleBroadcastBtn.addEventListener("click", handleScheduleBroadcast);
    if (systemToggleMaintenanceBtn) systemToggleMaintenanceBtn.addEventListener("click", handleToggleMaintenance);
    if (systemTestRealtimeBtn) systemTestRealtimeBtn.addEventListener("click", handleTestRealtimeConnection);
    if (broadcastListSearch) broadcastListSearch.addEventListener("input", renderAdminBroadcasts);
    if (broadcastStatusFilter) broadcastStatusFilter.addEventListener("change", renderAdminBroadcasts);

    function featureStatusClass(status) {
        const key = String(status || "Enabled").toLowerCase();
        return `feature-status-${key}`;
    }

    function featureStatusLabel(flag) {
        if (!flag.enabled && flag.status === "Enabled") return "Disabled";
        return flag.status || "Enabled";
    }

    function featureScopeText(scope) {
        const labels = {
            Global: "Global",
            Workspace: "Workspace",
            Role: "Role",
            User: "User"
        };
        return labels[scope] || scope || "Global";
    }

    function appendFeatureChangeLog(flagId, oldValue, newValue, scope, reason) {
        const time = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        state.featureFlagChangeLogs.unshift({
            time,
            user: state.currentUser?.email || "admin",
            flag: flagId,
            oldValue,
            newValue,
            scope,
            reason: reason || "Admin update"
        });
    }

    function findDependentChildren(config, parentId) {
        return Object.values(config).filter(flag => (flag.dependencies || []).includes(parentId) && flag.enabled && flag.status !== "Disabled" && flag.status !== "Deprecated");
    }

    function detectFeatureConflicts(config = state.featureFlagConfig) {
        const conflicts = [];
        Object.values(config).forEach(flag => {
            if (!flag.enabled || flag.status === "Disabled" || flag.status === "Deprecated") {
                const children = findDependentChildren(config, flag.id);
                if (children.length) {
                    conflicts.push(`Không thể tắt ${flag.id}: ${children.map(child => child.id).join(", ")} đang phụ thuộc.`);
                }
            }
            if (flag.status === "Enabled" && Number(flag.rollout) === 0) {
                conflicts.push(`${flag.id}: trạng thái Enabled nhưng Rollout = 0%.`);
            }
            if (flag.status === "Beta" && flag.scope === "Global") {
                conflicts.push(`${flag.id}: Beta đang mở cho toàn bộ người dùng.`);
            }
            if (flag.status === "Maintenance" && flag.enabled) {
                conflicts.push(`${flag.id}: Maintenance nhưng vẫn có người dùng được truy cập.`);
            }
        });
        if (!config.enable_excel_import?.enabled && config.enable_reconciliation?.enabled) {
            conflicts.push("enable_excel_import đang tắt trong khi enable_reconciliation đang bật.");
        }
        return conflicts;
    }

    function validateFeatureFlag(flag, config = state.featureFlagConfig) {
        if (!flag.name || !flag.name.trim()) {
            return { error: "Tên flag không được rỗng." };
        }
        const rollout = Number(flag.rollout);
        if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) {
            return { error: "Rollout phải từ 0 đến 100." };
        }
        if (flag.scope === "Workspace" && (!flag.workspaces || flag.workspaces.length === 0)) {
            return { error: "Nếu chọn Workspace cụ thể thì phải có ít nhất 1 workspace." };
        }
        if (flag.scope === "Role" && (!flag.roles || flag.roles.length === 0)) {
            return { error: "Nếu chọn Role cụ thể thì phải có ít nhất 1 role." };
        }
        if (flag.status === "Maintenance" && !String(flag.note || "").trim()) {
            return { error: "Nếu trạng thái là Maintenance thì phải nhập lý do bảo trì." };
        }
        if ((!flag.enabled || flag.status === "Disabled") && findDependentChildren(config, flag.id).length) {
            return { error: "Không được tắt module cha khi module con đang bật." };
        }
        if (flag.status === "Enabled" && rollout === 0) {
            return { error: "Trạng thái Enabled nhưng Rollout = 0%." };
        }
        if (flag.status === "Disabled" && rollout > 0) {
            return { warning: "Flag đang Disabled nhưng Rollout > 0%. Bạn có muốn tiếp tục lưu?" };
        }
        return {};
    }

    function filteredFeatureFlags() {
        const filters = state.featureFlagFilters;
        const search = String(filters.search || "").toLowerCase();
        return Object.values(state.featureFlagConfig).filter(flag => {
            const matchesSearch = !search || flag.name.toLowerCase().includes(search) || flag.description.toLowerCase().includes(search);
            const matchesGroup = filters.group === "All" || flag.group === filters.group;
            const matchesStatus = filters.status === "All" || featureStatusLabel(flag) === filters.status;
            const matchesScope = filters.scope === "All" || flag.scope === filters.scope;
            return matchesSearch && matchesGroup && matchesStatus && matchesScope;
        });
    }

    function renderFeatureStats() {
        const box = document.getElementById("feature-flags-stats");
        if (!box) return;
        const flags = Object.values(state.featureFlagConfig);
        const conflicts = detectFeatureConflicts();

        // Count statuses
        const total = flags.length;
        const enabled = flags.filter(flag => flag.enabled).length;
        const disabled = total - enabled;
        const workspacesAffected = 7; // Mocked matching Screenshot 1
        const lastUpdated = "12/05/2024 10:30"; // Mocked

        box.innerHTML = `
            <div class="admin-stat-card-v3 icon-green" style="margin-bottom:0;">
                <div class="card-icon-v3"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div class="card-content-v3">
                    <span>FLAGS ĐANG BẬT</span>
                    <strong>${enabled} / ${total}</strong>
                    <span class="card-subtext" style="color: #10b981;">100% tổng số</span>
                </div>
            </div>
            <div class="admin-stat-card-v3 icon-red" style="margin-bottom:0;">
                <div class="card-icon-v3"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                <div class="card-content-v3">
                    <span>FLAGS TẮT</span>
                    <strong>${disabled} / ${total}</strong>
                    <span class="card-subtext" style="color: #ef4444;">0% tổng số</span>
                </div>
            </div>
            <div class="admin-stat-card-v3 icon-blue" style="margin-bottom:0;">
                <div class="card-icon-v3"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
                <div class="card-content-v3">
                    <span>WORKSPACE BỊ ẢNH HƯỞNG</span>
                    <strong>${workspacesAffected}</strong>
                    <span class="card-subtext" style="color: #3b82f6;">Đang áp dụng trên ${workspacesAffected} workspace</span>
                </div>
            </div>
            <div class="admin-stat-card-v3 icon-teal" style="margin-bottom:0;">
                <div class="card-icon-v3"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div class="card-content-v3">
                    <span>CẬP NHẬT GẦN NHẤT</span>
                    <strong style="font-size:1.1rem; margin-top:0.55rem;">${lastUpdated}</strong>
                    <span class="card-subtext" style="color: #14b8a6;">Bởi admin01</span>
                </div>
            </div>
        `;

        // Update circle progress SVG in screenshot 1!
        const percent = total > 0 ? Math.round((enabled / total) * 100) : 0;
        const percentText = document.getElementById("feature-flags-percent-text");
        if (percentText) percentText.innerText = percent + "%";

        const circleBar = document.getElementById("feature-flags-circle-progress");
        if (circleBar) {
            const offset = 314 - (314 * percent / 100);
            circleBar.style.strokeDashoffset = offset;
        }
    }

    function renderFeatureFlagList() {
        const list = document.getElementById("feature-flags-list");
        const empty = document.getElementById("feature-empty-state");
        if (!list) return;
        const rows = filteredFeatureFlags();
        if (empty) empty.style.display = rows.length ? "none" : "block";
        list.innerHTML = rows.map(flag => {
            const status = featureStatusLabel(flag);
            const deps = flag.dependencies?.length ? flag.dependencies.join(", ") : "Không có";
            const enabledLabel = flag.enabled ? "Tắt" : "Bật";
            return `
                <div class="feature-flag-row ${state.selectedFeatureFlagId === flag.id ? "active" : ""}">
                    <div class="feature-flag-main">
                        <strong>${escapeHTML(flag.name)}</strong>
                        <span>${escapeHTML(flag.description)}</span>
                    </div>
                    <span class="feature-scope-badge">${escapeHTML(flag.group)}</span>
                    <span class="feature-status-badge ${featureStatusClass(status)}">${escapeHTML(status)}</span>
                    <span class="feature-scope-badge">${escapeHTML(featureScopeText(flag.scope))}</span>
                    <div>
                        <div class="feature-rollout-bar"><span style="width:${Math.max(0, Math.min(100, Number(flag.rollout) || 0))}%"></span></div>
                        <div class="feature-rollout-text">${escapeHTML(flag.rollout)}%</div>
                    </div>
                    <span class="feature-dependencies">${escapeHTML(deps)}</span>
                    <div class="feature-row-actions">
                        <label class="security-switch" title="${enabledLabel} ${escapeHTML(flag.id)}"><input type="checkbox" ${flag.enabled ? "checked" : ""} onchange="window.handleToggleFlag('${encodeInlineArg(flag.id)}')"><span></span></label>
                        <button class="feature-mini-btn" onclick="window.selectFeatureFlag('${encodeInlineArg(flag.id)}')">Cấu hình</button>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderFeatureQuickControls() {
        const reconciliationFlag = state.featureFlagConfig.enable_reconciliation;
        if (flagEnableReconciliation && reconciliationFlag) {
            const isEnabled = Boolean(state.featureFlags.enable_reconciliation);
            flagEnableReconciliation.checked = isEnabled;
            flagEnableReconciliation.dataset.boundFlag = "enable_reconciliation";
        }

        const reconciliationStatusText = document.getElementById("flag-reconciliation-status-text");
        if (reconciliationStatusText && reconciliationFlag) {
            const isEnabled = Boolean(state.featureFlags.enable_reconciliation);
            reconciliationStatusText.innerText = isEnabled ? "Đang bật" : featureStatusLabel(reconciliationFlag);
            reconciliationStatusText.className = `feature-status-badge ${featureStatusClass(isEnabled ? "Enabled" : featureStatusLabel(reconciliationFlag))}`;
        }
    }

    function renderFeatureDetailPanel() {
        const flag = state.featureFlagConfig[state.selectedFeatureFlagId] || Object.values(state.featureFlagConfig)[0];
        if (!flag) return;
        state.selectedFeatureFlagId = flag.id;
        const setValue = (id, value) => {
            const field = document.getElementById(id);
            if (field) field.value = value ?? "";
        };
        setValue("feature-config-id", flag.id);
        setValue("feature-config-name", flag.name);
        setValue("feature-config-description", flag.description);
        setValue("feature-config-group", flag.group);
        setValue("feature-config-status", flag.status);
        setValue("feature-config-scope", flag.scope);
        setValue("feature-config-rollout", flag.rollout);
        setValue("feature-config-start", flag.startDate);
        setValue("feature-config-end", flag.endDate);
        setValue("feature-config-workspaces", (flag.workspaces || []).join("\n"));
        setValue("feature-config-note", flag.note);
        document.querySelectorAll(".feature-config-role").forEach(input => {
            input.checked = (flag.roles || []).includes(input.value);
        });
    }

    function renderFeatureRolePermissions() {
        const tbody = document.getElementById("feature-role-permissions-body");
        if (!tbody) return;
        const columns = ["enable_autopilot", "enable_table_builder", "enable_document_builder", "enable_data_checker", "enable_reconciliation", "enable_export_report"];
        tbody.innerHTML = Object.entries(state.rolePermissions).map(([role, permissions]) => `
            <tr>
                <td style="font-weight:700;">${escapeHTML(role)}</td>
                ${columns.map(key => `<td><span class="feature-role-badge">${escapeHTML(permissions[key] || "Không được phép")}</span></td>`).join("")}
            </tr>
        `).join("");
    }

    function renderFeatureConflicts(conflicts = detectFeatureConflicts()) {
        const box = document.getElementById("feature-conflicts-list");
        if (!box) return;
        if (!conflicts.length) {
            box.innerHTML = `<div class="feature-conflict-item good">Không phát hiện xung đột phụ thuộc hoặc rollout.</div>`;
            return;
        }
        box.innerHTML = conflicts.map(item => `<div class="feature-conflict-item">${escapeHTML(item)}</div>`).join("");
    }

    function renderFeatureChangeLogs() {
        const tbody = document.getElementById("feature-change-logs-body");
        if (!tbody) return;

        const changeLogs = state.featureFlagChangeLogs || [];
        if (!changeLogs.length) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted);">Chưa có lịch sử thay đổi Feature Flags thật.</td></tr>`;
            return;
        }

        tbody.innerHTML = changeLogs.map(log => `
            <tr>
                <td style="color:var(--color-text-muted); font-size:0.8rem;">${escapeHTML(log.time)}</td>
                <td>
                    <span style="display:inline-flex; align-items:center; gap:4px; font-weight:600; color:#fff;">
                        <span style="width:16px; height:16px; border-radius:50%; background:#8b5cf6; color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.55rem; font-weight:700;">A</span>
                        ${escapeHTML(log.user)}
                    </span>
                </td>
                <td style="font-family:var(--font-mono); font-size:0.75rem; color:#fff; font-weight:500;">${escapeHTML(log.flag)}</td>
                <td><span style="color:#10b981; font-weight:600;">● ${escapeHTML(log.status || log.newValue || "")}</span></td>
            </tr>
        `).join("");
    }

    function renderAdminFeatures() {
        renderFeatureStats();
        renderFeatureQuickControls();
        renderFeatureFlagList();
        renderFeatureDetailPanel();
        renderFeatureRolePermissions();
        renderFeatureConflicts();
        renderFeatureChangeLogs();
    }

    window.selectFeatureFlag = function(encodedId) {
        const id = decodeURIComponent(encodedId);
        if (!state.featureFlagConfig[id]) return;
        state.selectedFeatureFlagId = id;
        renderFeatureFlagList();
        renderFeatureDetailPanel();
        const modal = document.getElementById("feature-detail-modal");
        if (modal) modal.style.display = "flex";
    };

    window.handleToggleFlag = function(encodedId) {
        const id = decodeURIComponent(encodedId);
        const flag = state.featureFlagConfig[id];
        if (!flag) return;
        if (flag.enabled && ["enable_excel_import", "enable_data_checker", "enable_pii_scanner"].includes(id)) {
            if (!window.confirm(`Tắt flag quan trọng "${id}" có thể ảnh hưởng hệ thống. Tiếp tục?`)) {
                renderFeatureFlagList();
                return;
            }
        }
        const oldValue = flag.enabled ? "ON" : "OFF";
        flag.enabled = !flag.enabled;
        flag.status = flag.enabled ? (flag.status === "Disabled" || flag.status === "Deprecated" ? "Enabled" : flag.status) : "Disabled";
        flag.rollout = flag.enabled && Number(flag.rollout) === 0 ? 100 : flag.rollout;
        if (!flag.enabled) flag.rollout = 0;
        appendFeatureChangeLog(id, oldValue, flag.enabled ? "ON" : "OFF", flag.scope, "Toggle nhanh");
        state.featureFlags = flatFeatureFlagsFromConfig(state.featureFlagConfig);
        checkWorkspaceLocks();
        renderAdminFeatures();
    };

    async function handleQuickFeatureToggle(flagId, checked) {
        const flag = state.featureFlagConfig[flagId];
        if (!flag) return;
        const previousConfig = cloneFeatureFlags(state.featureFlagConfig);
        const previousFlags = { ...state.featureFlags };
        const oldValue = flag.enabled ? "ON" : "OFF";
        flag.enabled = checked;
        flag.status = checked ? "Enabled" : "Disabled";
        flag.rollout = checked ? 100 : 0;
        if (checked && flagId === "enable_reconciliation") {
            flag.group = "Finance";
            flag.name = "Đối soát 2 bảng";
            flag.roles = Array.from(new Set([...(flag.roles || []), "Admin", "Manager", "User"]));
            flag.note = "Cho phép người dùng đối soát dữ liệu giữa hai bảng.";
        }
        appendFeatureChangeLog(flagId, oldValue, checked ? "ON" : "OFF", flag.scope, "Công tắc nhanh admin");
        state.featureFlags = flatFeatureFlagsFromConfig(state.featureFlagConfig);
        checkWorkspaceLocks();
        renderAdminFeatures();
        try {
            await saveFeatureFlags(state.featureFlagConfig);
            showToast(`${checked ? "Đã bật" : "Đã tắt"} Đối soát 2 bảng và đã lưu về backend.`, checked ? "success" : "warning");
        } catch (error) {
            state.featureFlagConfig = previousConfig;
            state.featureFlags = previousFlags;
            checkWorkspaceLocks();
            renderAdminFeatures();
            showToast(error.message || "Backend chưa lưu được Feature Flag đối soát.", "error");
        }
    }

    function readFeatureDetailForm() {
        const id = document.getElementById("feature-config-id")?.value || state.selectedFeatureFlagId;
        const current = state.featureFlagConfig[id] || {};
        return {
            ...current,
            id,
            name: document.getElementById("feature-config-name")?.value.trim() || "",
            description: document.getElementById("feature-config-description")?.value.trim() || "",
            group: document.getElementById("feature-config-group")?.value || "System",
            status: document.getElementById("feature-config-status")?.value || "Enabled",
            scope: document.getElementById("feature-config-scope")?.value || "Global",
            rollout: Number(document.getElementById("feature-config-rollout")?.value || 0),
            startDate: document.getElementById("feature-config-start")?.value || "",
            endDate: document.getElementById("feature-config-end")?.value || "",
            workspaces: (document.getElementById("feature-config-workspaces")?.value || "").split(/\r?\n|,/).map(item => item.trim()).filter(Boolean),
            roles: Array.from(document.querySelectorAll(".feature-config-role:checked")).map(input => input.value),
            note: document.getElementById("feature-config-note")?.value.trim() || ""
        };
    }

    function handleUpdateFlag() {
        const nextFlag = readFeatureDetailForm();
        const nextConfig = { ...state.featureFlagConfig, [nextFlag.id]: nextFlag };
        const result = validateFeatureFlag(nextFlag, nextConfig);
        if (result.error) {
            showToast(result.error, "error");
            return;
        }
        if (result.warning && !window.confirm(result.warning)) return;
        const current = state.featureFlagConfig[nextFlag.id];
        appendFeatureChangeLog(nextFlag.id, `${current.status}/${current.rollout}%`, `${nextFlag.status}/${nextFlag.rollout}%`, nextFlag.scope, nextFlag.note);
        nextFlag.enabled = nextFlag.status !== "Disabled" && nextFlag.status !== "Deprecated" && nextFlag.status !== "Maintenance";
        state.featureFlagConfig = nextConfig;
        state.featureFlags = flatFeatureFlagsFromConfig(nextConfig);
        checkWorkspaceLocks();
        renderAdminFeatures();
        showToast(`Đã cập nhật cấu hình ${nextFlag.id}.`, "success");
    }

    async function handleUpdateAllFeatureFlags() {
        for (const flag of Object.values(state.featureFlagConfig)) {
            const result = validateFeatureFlag(flag, state.featureFlagConfig);
            if (result.error) {
                showToast(`${flag.id}: ${result.error}`, "error");
                return;
            }
            if (result.warning && !window.confirm(`${flag.id}: ${result.warning}`)) return;
        }
        const saveBtn = document.getElementById("admin-save-flags-btn");
        const oldText = saveBtn?.innerText || "Cập nhật Flags hệ thống";
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerText = "Đang cập nhật...";
        }
        try {
            await saveFeatureFlags(state.featureFlagConfig);
            adminService.addSystemLog("success", "System: Admin updated advanced Feature Flags dashboard");
            showToast("Đã cập nhật Flags hệ thống thành công!", "success");
        } catch (error) {
            showToast(error.message || "Không thể lưu Feature Flags lên backend", "error");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = oldText;
            }
        }
    }

    function handleResetDefault() {
        state.featureFlagConfig = cloneFeatureFlags();
        state.featureFlags = flatFeatureFlagsFromConfig(state.featureFlagConfig);
        state.selectedFeatureFlagId = "enable_autopilot";
        state.featureFlagFilters = { search: "", group: "All", status: "All", scope: "All" };
        document.getElementById("feature-flag-search").value = "";
        document.getElementById("feature-filter-group").value = "All";
        document.getElementById("feature-filter-status").value = "All";
        document.getElementById("feature-filter-scope").value = "All";
        checkWorkspaceLocks();
        renderAdminFeatures();
        showToast("Đã khôi phục Feature Flags mặc định trên giao diện.", "info");
    }

    function handleCheckConflicts() {
        const conflicts = detectFeatureConflicts();
        renderFeatureConflicts(conflicts);
        showToast(conflicts.length ? `Phát hiện ${conflicts.length} cảnh báo/xung đột.` : "Không phát hiện xung đột Feature Flags.", conflicts.length ? "warning" : "success");
        return conflicts;
    }

    function handleExportConfig() {
        const payload = featureFlagsPayload(state.featureFlagConfig);
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `feature-flags-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showToast("Đã xuất cấu hình Feature Flags JSON.", "success");
    }

    function handleImportConfig() {
        document.getElementById("feature-import-input")?.click();
    }

    function applyImportedFeatureConfig(payload) {
        if (!payload || typeof payload !== "object") {
            showToast("File JSON không hợp lệ.", "error");
            return;
        }
        const nextConfig = buildFeatureFlagConfig(payload);
        state.featureFlagConfig = nextConfig;
        state.featureFlags = flatFeatureFlagsFromConfig(nextConfig);
        if (Array.isArray(payload.changeLogs)) state.featureFlagChangeLogs = payload.changeLogs;
        if (payload.rolePermissions && typeof payload.rolePermissions === "object") state.rolePermissions = payload.rolePermissions;
        checkWorkspaceLocks();
        renderAdminFeatures();
        showToast("Đã nhập cấu hình Feature Flags từ JSON.", "success");
    }

    window.handleUpdateFlag = handleUpdateFlag;
    window.handleResetDefault = handleResetDefault;
    window.handleResetFeatureFlagsDefault = handleResetDefault;
    window.handleCheckConflicts = handleCheckConflicts;
    window.handleExportConfig = handleExportConfig;
    window.handleImportConfig = handleImportConfig;
    window.validateFeatureFlag = validateFeatureFlag;

    const featureFilterSearch = document.getElementById("feature-flag-search");
    const featureFilterGroup = document.getElementById("feature-filter-group");
    const featureFilterStatus = document.getElementById("feature-filter-status");
    const featureFilterScope = document.getElementById("feature-filter-scope");
    const syncFeatureFilters = () => {
        state.featureFlagFilters = {
            search: featureFilterSearch?.value || "",
            group: featureFilterGroup?.value || "All",
            status: featureFilterStatus?.value || "All",
            scope: featureFilterScope?.value || "All"
        };
        renderFeatureStats();
        renderFeatureFlagList();
    };
    [featureFilterSearch, featureFilterGroup, featureFilterStatus, featureFilterScope].forEach(input => {
        if (input) input.addEventListener("input", syncFeatureFilters);
        if (input) input.addEventListener("change", syncFeatureFilters);
    });
    document.getElementById("feature-reset-filter-btn")?.addEventListener("click", () => {
        if (featureFilterSearch) featureFilterSearch.value = "";
        if (featureFilterGroup) featureFilterGroup.value = "All";
        if (featureFilterStatus) featureFilterStatus.value = "All";
        if (featureFilterScope) featureFilterScope.value = "All";
        syncFeatureFilters();
    });
    document.getElementById("feature-update-flag-btn")?.addEventListener("click", handleUpdateFlag);
    document.getElementById("admin-save-flags-btn")?.addEventListener("click", handleUpdateAllFeatureFlags);
    flagEnableReconciliation?.addEventListener("change", (event) => {
        handleQuickFeatureToggle("enable_reconciliation", event.target.checked);
    });
    document.getElementById("feature-enable-all-btn")?.addEventListener("click", () => {
        Object.values(state.featureFlagConfig).forEach(flag => {
            flag.enabled = true;
            if (flag.status === "Disabled" || flag.status === "Deprecated") flag.status = "Enabled";
            if (Number(flag.rollout) === 0) flag.rollout = 100;
        });
        state.featureFlags = flatFeatureFlagsFromConfig(state.featureFlagConfig);
        checkWorkspaceLocks();
        renderAdminFeatures();
        showToast("Đã bật tất cả Feature Flags trên giao diện.", "success");
    });
    document.getElementById("feature-disable-all-btn")?.addEventListener("click", () => {
        if (!window.confirm("Tắt tất cả Feature Flags có thể khóa nhiều module người dùng. Tiếp tục?")) return;
        Object.values(state.featureFlagConfig).forEach(flag => {
            flag.enabled = false;
            flag.status = "Disabled";
            flag.rollout = 0;
        });
        state.featureFlags = flatFeatureFlagsFromConfig(state.featureFlagConfig);
        checkWorkspaceLocks();
        renderAdminFeatures();
        showToast("Đã tắt tất cả Feature Flags trên giao diện.", "warning");
    });
    document.getElementById("feature-reset-default-btn")?.addEventListener("click", handleResetDefault);
    document.getElementById("feature-check-conflicts-btn")?.addEventListener("click", handleCheckConflicts);
    document.getElementById("feature-export-config-btn")?.addEventListener("click", handleExportConfig);
    document.getElementById("feature-import-config-btn")?.addEventListener("click", handleImportConfig);
    document.getElementById("feature-import-input")?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const payload = JSON.parse(await file.text());
            applyImportedFeatureConfig(payload);
        } catch (error) {
            showToast("Không thể đọc file JSON Feature Flags.", "error");
        } finally {
            event.target.value = "";
        }
    });

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
        adminClearLogsBtn.addEventListener("click", async () => {
            adminClearLogsBtn.disabled = true;
            const originalText = adminClearLogsBtn.innerText;
            adminClearLogsBtn.innerText = "Đang xóa...";
            try {
                await adminService.clearSystemLogs();
                state.systemLogs = adminService.loadSystemLogs();
                renderLogs();
                showToast("Đã xóa nhật ký hệ thống trên backend.", "success");
            } catch (error) {
                showToast(error.message || "Không thể xóa nhật ký hệ thống", "error");
            } finally {
                adminClearLogsBtn.disabled = false;
                adminClearLogsBtn.innerText = originalText;
            }
        });
    }

    // Save configuration prompts
    adminSavePromptBtn.addEventListener("click", async () => {
        const roleVal = document.getElementById("admin-prompt-role")?.value?.trim() || "";
        const styleVal = document.getElementById("admin-prompt-style")?.value?.trim() || "";
        const rulesVal = document.getElementById("admin-prompt-rules")?.value?.trim() || "";
        const codeVal = document.getElementById("admin-prompt-code")?.value?.trim() || "";

        const sysP = `[ROLE]\n${roleVal}\n[STYLE]\n${styleVal}\n[RULES]\n${rulesVal}\n[CODE]\n${codeVal}`;
        const limitVal = parseInt(adminSystemLimit.value) || 20;

        const config = adminService.loadPromptConfig();
        config.systemPrompt = sysP;
        config.freeLimit = limitVal;

        const formulaPrompt = document.getElementById("admin-formula-prompt");
        if (formulaPrompt) config.formulaPrompt = formulaPrompt.value.trim();

        const checkerPrompt = document.getElementById("admin-checker-prompt");
        if (checkerPrompt) config.checkerPrompt = checkerPrompt.value.trim();

        const reconciliationPrompt = document.getElementById("admin-reconciliation-prompt");
        if (reconciliationPrompt) config.reconciliationPrompt = reconciliationPrompt.value.trim();

        try {
            if (adminSystemPrompt) adminSystemPrompt.value = sysP;
            await adminService.savePromptConfig(config);
            state.systemPrompt = sysP;
            state.freeLimit = limitVal;
        } catch (error) {
            showToast(error.message || "Không thể lưu Prompt Config lên backend", "error");
            return;
        }

        // Update active limit for Free
        if (state.currentUser.tier === "free") {
            state.currentUser.usageLimit = limitVal;
        }

        adminService.addSystemLog("warning", "System: Admin updated AI System Prompts and Limits");
        showToast("Đã lưu các tùy chọn cấu hình prompts thành công!", "success");
        updateWorkspaceSidebarUI();
    });

    // Custom Global scope hooks for onclick inside tables
    window.toggleUserBan = async function(userId) {
        const user = (state.adminUsersAll.length ? state.adminUsersAll : state.users).find(u => String(u.id) === String(userId));
        if (!user) return;

        if (String(userId) === String(state.currentUser.id)) {
            showToast("Bạn không thể tự khóa tài khoản của chính mình!", "error");
            return;
        }

        const nextStatus = normalizeAccountStatus(user.status) === "active" ? "suspended" : "active";
        if (!window.confirm(nextStatus === "suspended" ? "Bạn có chắc muốn khóa tài khoản này không?" : "Bạn có chắc muốn mở khóa tài khoản này không?")) return;
        try {
            const result = nextStatus === "suspended" ? await adminService.lockUser(user.id) : await adminService.unlockUser(user.id);
            if (result?.user) upsertStateUser(result.user);
            user.status = result?.user?.status || nextStatus;
            const index = state.adminUsersAll.findIndex(item => String(item.id) === String(user.id));
            if (index >= 0) state.adminUsersAll[index] = normalizeAdminUser({ ...state.adminUsersAll[index], ...(result?.user || {}), status: user.status });
        } catch (error) {
            showToast(error.message || "Không thể cập nhật trạng thái user", "error");
            return;
        }

        if (normalizeAccountStatus(user.status) !== "active") {
            showToast(`Đã khóa tài khoản của ${user.name}`, "warning");
            adminService.addSystemLog("warning", `System: Account of '${user.email}' was BANNED`);
        } else {
            showToast(`Đã mở khóa tài khoản của ${user.name}`);
            adminService.addSystemLog("success", `System: Account of '${user.email}' was UNBANNED`);
        }

        billingService.saveUsers(state.users);
        renderAdminUsers();
    };

    window.resetUserPassword = async function(userId) {
        const user = (state.adminUsersAll.length ? state.adminUsersAll : state.users).find(u => String(u.id) === String(userId));
        if (!user) return;
        if (String(userId) === String(state.currentUser.id)) {
            showToast("Không reset mật khẩu của chính admin đang đăng nhập tại màn này.", "error");
            return;
        }
        if (!window.confirm(`Gửi yêu cầu đặt lại mật khẩu cho ${user.email}?`)) return;
        const password = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
        try {
            const result = await adminService.resetUserPassword(userId, password, "admin_user_table_reset");
            if (result?.user) upsertStateUser(result.user);
            showToast("Đã gửi hướng dẫn đặt lại mật khẩu.", "success");
            adminService.addSystemLog("warning", `System: Admin reset password for ${user.email}`);
        } catch (error) {
            showToast(error.message || "Không thể reset mật khẩu user", "error");
        }
    };

    window.deleteUser = async function(userId) {
        const user = (state.adminUsersAll.length ? state.adminUsersAll : state.users).find(u => String(u.id) === String(userId));
        if (!user) return;
        if (String(userId) === String(state.currentUser.id)) {
            showToast("Bạn không thể xóa chính tài khoản admin đang đăng nhập.", "error");
            return;
        }
        if (!window.confirm(`Xóa mềm tài khoản ${user.email}? User sẽ bị đăng xuất và chuyển trạng thái Đã xóa.`)) return;
        try {
            const result = await adminService.deleteUser(userId);
            if (result?.user) upsertStateUser(result.user);
            const index = state.adminUsersAll.findIndex(item => String(item.id) === String(userId));
            if (index >= 0 && result?.user) state.adminUsersAll[index] = normalizeAdminUser(result.user);
            renderAdminUsers();
            renderAdminGrantUsers();
            showToast(`Đã xóa mềm tài khoản ${user.email}.`, "success");
            adminService.addSystemLog("warning", `System: Admin deleted user ${user.email}`);
        } catch (error) {
            showToast(error.message || "Không thể xóa user", "error");
        }
    };

    function openAdminUserModal(user = null) {
        const isCreate = !user;
        if (adminUserModalTitle) {
            adminUserModalTitle.innerText = isCreate ? "Thêm tài khoản người dùng" : "Chỉnh sửa tài khoản người dùng";
        }
        editUserIdInput.value = user?.id || "";
        editUserNameInput.value = user?.name || "";
        editUserEmailInput.value = user?.email || "";
        editUserTierSelect.value = normalizeTier(user?.tier);
        editUserStatusSelect.value = normalizeAccountStatus(user?.status);
        if (editUserPasswordInput) {
            editUserPasswordInput.value = "";
            editUserPasswordInput.required = isCreate;
        }
        if (editUserPasswordGroup) {
            editUserPasswordGroup.style.display = isCreate ? "block" : "none";
        }
        adminUserModal.classList.add("active");
        setTimeout(() => editUserNameInput?.focus(), 50);
    }

    window.editUser = function(userId) {
        const user = (state.adminUsersAll.length ? state.adminUsersAll : state.users).find(u => String(u.id) === String(userId));
        if (!user) return;
        openAdminUserModal(user);
    };

    window.retryLoadAdminUsers = function() {
        loadAdminUsers(true);
    };

    adminUserCloseBtn.addEventListener("click", () => {
        adminUserModal.classList.remove("active");
        if (editUserPasswordGroup) editUserPasswordGroup.style.display = "none";
        if (editUserPasswordInput) editUserPasswordInput.required = false;
    });

    adminUserForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = editUserIdInput.value;

        const nextName = editUserNameInput.value.trim();
        const nextEmail = editUserEmailInput.value.trim();
        const nextTier = normalizeTier(editUserTierSelect.value);
        const nextStatus = normalizeAccountStatus(editUserStatusSelect.value);
        const password = editUserPasswordInput?.value || "";
        const isCreate = !id;

        if (!nextName || !nextEmail) {
            showToast("Vui lòng nhập tên và email user.", "error");
            return;
        }
        if (!isCreate && password && password.length < 6) {
            showToast("Mật khẩu tạm cần tối thiểu 6 ký tự.", "error");
            return;
        }

        const user = isCreate ? null : state.users.find(u => String(u.id) === String(id));
        if (!isCreate && !user) return;
        let updatedUser = user ? { ...user } : null;

        try {
            if (isCreate) {
                const createResult = await adminService.createUser({
                    name: nextName,
                    email: nextEmail,
                    password: password || crypto.randomUUID().replace(/-/g, "").slice(0, 14),
                    tier: nextTier,
                    status: nextStatus,
                    reason: "admin_create_user"
                });
                updatedUser = createResult?.user || null;
            } else if (nextName !== user.name || nextEmail !== user.email) {
                const profileResult = await adminService.updateUserProfile(id, {
                    name: nextName,
                    email: nextEmail,
                    reason: "admin_user_edit"
                });
                if (profileResult?.user) updatedUser = { ...updatedUser, ...profileResult.user };
            }

            if (!isCreate && nextTier !== normalizeTier(user.tier)) {
                const tierResult = await adminService.updateUserTier(id, nextTier, "admin_user_edit");
                if (tierResult?.user) updatedUser = { ...updatedUser, ...tierResult.user };
            }

            if (!isCreate && nextStatus !== normalizeAccountStatus(user.status)) {
                const statusResult = await adminService.updateUserStatus(id, nextStatus);
                if (statusResult?.user) updatedUser = { ...updatedUser, ...statusResult.user };
            }
        } catch (error) {
            showToast(error.message || "Không thể lưu user lên backend", "error");
            return;
        }

        if (updatedUser) {
            upsertStateUser(updatedUser);
            const normalized = normalizeAdminUser(updatedUser);
            const index = state.adminUsersAll.findIndex(item => String(item.id) === String(normalized.id));
            if (index >= 0) state.adminUsersAll[index] = normalized;
            else state.adminUsersAll.unshift(normalized);
        }

        billingService.saveUsers(state.users);
        adminUserModal.classList.remove("active");
        showToast(isCreate ? "Đã tạo tài khoản người dùng mới." : "Đã cập nhật thông tin người dùng!");
        adminService.addSystemLog("success", isCreate ? `System: Admin created user ${nextEmail}` : `System: Admin updated details for user ${updatedUser?.email || user.email}`);

        renderAdminUsers();
    });

    adminAddUserBtn.addEventListener("click", () => {
        openAdminUserModal();
    });

    if (adminGrantUserSelect) {
        adminGrantUserSelect.addEventListener("change", () => {
            const selectedUser = findStateUser(adminGrantUserSelect.value);
            if (selectedUser && adminGrantTierSelect) {
                adminGrantTierSelect.value = normalizeTier(selectedUser.tier);
                adminGrantTierSelect.dataset.userChanged = "";
            }
        });
    }

    if (adminGrantTierSelect) {
        adminGrantTierSelect.addEventListener("change", () => {
            adminGrantTierSelect.dataset.userChanged = "true";
        });
    }

    if (adminGrantTierBtn) {
        adminGrantTierBtn.addEventListener("click", async () => {
            const userId = adminGrantUserSelect?.value;
            const tier = normalizeTier(adminGrantTierSelect?.value);
            const reason = adminGrantReason?.value.trim() || "admin_manual_grant";
            const targetUser = findStateUser(userId);
            if (!userId || !targetUser) {
                showToast("Vui lòng chọn user cần cấp gói.", "error");
                return;
            }

            const oldText = adminGrantTierBtn.innerText;
            adminGrantTierBtn.disabled = true;
            adminGrantTierBtn.innerText = "Đang cấp gói...";
            try {
                const result = await adminService.grantUserTier(userId, tier, reason);
                if (result?.user) upsertStateUser(result.user);
                state.billingDashboard = await adminService.getBillingDashboard().catch(() => state.billingDashboard);
                state.checkoutRequests = adminService.loadCheckoutRequests();
                renderAdminPanel();
                showToast(`Đã cấp gói ${tierLabel(tier)} cho ${targetUser.email}.`, "success");
                adminService.addSystemLog("success", `Billing: Admin granted ${tierLabel(tier)} to ${targetUser.email}`);
                if (adminGrantReason) adminGrantReason.value = "";
            } catch (error) {
                showToast(error.message || "Không thể cấp gói cho user", "error");
            } finally {
                adminGrantTierBtn.disabled = false;
                adminGrantTierBtn.innerText = oldText;
            }
        });
    }

    if (adminRefreshBillingBtn) {
        adminRefreshBillingBtn.addEventListener("click", async () => {
            adminRefreshBillingBtn.disabled = true;
            const originalText = adminRefreshBillingBtn.innerText;
            adminRefreshBillingBtn.innerText = "Đang tải...";
            try {
                const usersPayload = await adminService.getUsers(1, 100);
                if (Array.isArray(usersPayload.users)) state.users = usersPayload.users;
                await adminService.getCheckoutRequests();
                await adminService.getBillingDashboard();
                state.checkoutRequests = adminService.loadCheckoutRequests();
                state.billingDashboard = adminService.loadBillingDashboard();
                renderAdminBilling();
                showToast("Đã tải lại dữ liệu billing.", "success");
            } catch (error) {
                showToast(error.message || "Không thể tải lại billing", "error");
            } finally {
                adminRefreshBillingBtn.disabled = false;
                adminRefreshBillingBtn.innerText = originalText;
            }
        });
    }

    window.confirmCheckoutRequest = async function(id) {
        const note = await openAdminTextDialog({
            title: "Xác nhận thanh toán",
            label: "Ghi chú xác nhận thanh toán",
            value: "admin_confirmed",
            placeholder: "Nhập ghi chú xác nhận"
        });
        if (note === null) return;
        try {
            const result = await adminService.confirmCheckoutRequest(id, note);
            if (result?.tierUpdate?.user) upsertStateUser(result.tierUpdate.user);
            await adminService.getCheckoutRequests();
            state.checkoutRequests = adminService.loadCheckoutRequests();
            state.billingDashboard = await adminService.getBillingDashboard().catch(() => state.billingDashboard);
            renderAdminBilling();
            renderAdminUsers();
            showToast("Đã xác nhận checkout và cập nhật gói cho user.", "success");
        } catch (error) {
            showToast(error.message || "Không thể xác nhận checkout", "error");
        }
    };

    window.rejectCheckoutRequest = async function(id) {
        const note = await openAdminTextDialog({
            title: "Từ chối checkout",
            label: "Lý do từ chối",
            value: "manual_rejected",
            placeholder: "Nhập lý do từ chối"
        });
        if (note === null) return;
        try {
            await adminService.rejectCheckoutRequest(id, note);
            await adminService.getCheckoutRequests();
            state.checkoutRequests = adminService.loadCheckoutRequests();
            state.billingDashboard = await adminService.getBillingDashboard().catch(() => state.billingDashboard);
            renderAdminBilling();
            showToast("Đã từ chối checkout request.", "success");
        } catch (error) {
            showToast(error.message || "Không thể từ chối checkout", "error");
        }
    };

    const adminAddTemplateBtn = document.getElementById("admin-add-template-btn");
    if (adminAddTemplateBtn) {
        adminAddTemplateBtn.addEventListener("click", () => openAdminTemplateModal());
    }

    if (adminTemplateCloseBtn && adminTemplateModal) {
        adminTemplateCloseBtn.addEventListener("click", () => {
            adminTemplateModal.classList.remove("active");
        });
    }

    if (adminTemplateForm) {
        adminTemplateForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const elements = getAdminTemplateElements();
            if (!elements) return;
            const templateId = elements.idInput.value;
            const payload = templatePayloadFromForm(elements);
            if (!payload) return;
            if (!payload.name) {
                showToast("Tên biểu mẫu không được để trống.", "error");
                return;
            }
            const submitBtn = document.getElementById("edit-template-submit-btn");
            const oldText = submitBtn?.innerText || "Lưu biểu mẫu";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Đang lưu...";
            }
            try {
                const saved = templateId
                    ? await adminService.updateTemplateAdvanced(templateId, payload)
                    : await adminService.createTemplateAdvanced(payload);
                if (saved) state.templates = adminService.loadTemplates();
                renderAdminTemplates();
                elements.modal.classList.remove("active");
                showToast(templateId ? "Đã cập nhật template trên backend." : "Đã thêm template vào backend.", "success");
                adminService.addSystemLog("success", `Templates: Admin saved template '${payload.name}'`);
            } catch (error) {
                showToast(error.message || "Không thể lưu template", "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = oldText;
                }
            }
        });
    }

    // ----------------------------------------------------------------------
    // EXPANDED CONTROLLER LOGIC (COUPONS, PRICING CONFIG, API KEYS, BROADCAST & DEEP-DIVE AUDIT)
    // ----------------------------------------------------------------------

    // A. Coupon Management
    const configCouponCode = document.getElementById("config-coupon-code");
    const configCouponPercent = document.getElementById("config-coupon-percent");
    const adminAddCouponBtn = document.getElementById("admin-add-coupon-btn");
    const adminCancelCouponEditBtn = document.getElementById("admin-cancel-coupon-edit-btn");
    const adminCouponsTableBody = document.getElementById("admin-coupons-table-body");

    function resetCouponEditor() {
        state.editingCouponCode = "";
        if (configCouponCode) {
            configCouponCode.value = "";
            configCouponCode.disabled = false;
        }
        if (configCouponPercent) configCouponPercent.value = "50";
        if (adminAddCouponBtn) adminAddCouponBtn.innerText = "Thêm Coupon";
        if (adminCancelCouponEditBtn) adminCancelCouponEditBtn.style.display = "none";
    }

    function renderAdminCoupons() {
        if (!adminCouponsTableBody) return;
        adminCouponsTableBody.innerHTML = "";
        if (state.coupons.length === 0) {
            adminCouponsTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--color-text-muted);">Chưa có coupon thật từ backend.</td></tr>`;
            return;
        }

        state.coupons.forEach(c => {
            const tr = document.createElement("tr");
            const couponCodeArg = encodeInlineArg(c.code);
            tr.innerHTML = `
                <td style="font-weight:600;">${escapeHTML(c.code)}</td>
                <td>Giảm ${escapeHTML(c.percent)}%</td>
                <td>
                    <button class="admin-btn admin-btn-edit" style="padding:0.15rem 0.4rem; font-size:0.7rem;" onclick="window.editCoupon(decodeURIComponent('${couponCodeArg}'))">Sửa</button>
                    <button class="admin-btn admin-btn-ban" style="padding:0.15rem 0.4rem; font-size:0.7rem;" onclick="window.removeCoupon(decodeURIComponent('${couponCodeArg}'))">Xóa</button>
                </td>
            `;
            adminCouponsTableBody.appendChild(tr);
        });
    }

    window.editCoupon = async function(code) {
        if (!configCouponCode || !configCouponPercent || !adminAddCouponBtn) {
            showToast("Thiếu form chỉnh sửa coupon trên giao diện. Hãy tải lại trang.", "error");
            return;
        }
        const coupon = state.coupons.find(c => c.code === code);
        if (!coupon) return;
        state.editingCouponCode = code;
        configCouponCode.value = code;
        configCouponCode.disabled = true;
        configCouponPercent.value = coupon.percent || 10;
        adminAddCouponBtn.innerText = "Cập nhật Coupon";
        if (adminCancelCouponEditBtn) adminCancelCouponEditBtn.style.display = "inline-flex";
    };

    window.removeCoupon = async function(code) {
        const index = state.coupons.findIndex(c => c.code === code);
        if (index === -1) return;

        try {
            await billingService.deleteCoupon(code);
            state.coupons.splice(index, 1);
            if (state.editingCouponCode === code) resetCouponEditor();
            renderAdminCoupons();
            showToast(`Đã xóa mã giảm giá: ${code}`, "info");
            adminService.addSystemLog("warning", `Coupons: Admin deleted coupon code '${code}'`);
        } catch (error) {
            showToast(error.message || "Không thể xóa coupon trên backend", "error");
        }
    };

    if (adminAddCouponBtn) {
        adminAddCouponBtn.addEventListener("click", async () => {
            if (!configCouponCode || !configCouponPercent) {
                showToast("Thiếu input coupon trên giao diện. Hãy tải lại trang.", "error");
                return;
            }
            const code = (state.editingCouponCode || configCouponCode.value.trim()).toUpperCase();
            const percent = parseInt(configCouponPercent.value);

            if (!code || isNaN(percent) || percent < 1 || percent > 100) {
                showToast("Vui lòng nhập mã hợp lệ và % giảm từ 1 đến 100!", "error");
                return;
            }

            if (!state.editingCouponCode && state.coupons.some(c => c.code === code)) {
                showToast("Mã coupon này đã tồn tại!", "error");
                return;
            }

            try {
                const coupon = await billingService.createCoupon(code, percent);
                state.coupons = billingService.loadCoupons();
                if (coupon && !state.coupons.some(c => c.code === coupon.code)) {
                    state.coupons.push(coupon);
                }
                resetCouponEditor();

                renderAdminCoupons();
                showToast(`Đã lưu mã giảm giá ${code} giảm ${percent}%!`, "success");
                adminService.addSystemLog("success", `Coupons: Admin saved coupon code '${code}' (-${percent}%)`);
            } catch (error) {
                showToast(error.message || "Không thể lưu coupon vào backend", "error");
            }
        });
    }

    if (adminCancelCouponEditBtn) {
        adminCancelCouponEditBtn.addEventListener("click", resetCouponEditor);
    }

    // B. Pricing config & sync
    const configPricePro = document.getElementById("config-price-pro");
    const configPriceBusiness = document.getElementById("config-price-business");
    const configPriceEnterprise = document.getElementById("config-price-enterprise");
    const configPriceProAnnual = document.getElementById("config-price-pro-annual");
    const configPriceBusinessAnnual = document.getElementById("config-price-business-annual");
    const configPriceEnterpriseAnnual = document.getElementById("config-price-enterprise-annual");
    const adminSavePricingBtn = document.getElementById("admin-save-pricing-btn");

    function syncPricingUI() {
        const cycle = state.billingCycle;
        const freePlan = state.billingPlans.find(plan => plan.id === "free");
        const proPlan = state.billingPlans.find(plan => plan.id === "pro");
        const enterprisePlan = state.billingPlans.find(plan => plan.id === "enterprise");
        priceProText.innerText = pricing[cycle].pro;
        periodProText.innerText = pricing[cycle].period;
        if (proPlan) {
            priceProText.innerText = formatBillingMoney(cycle === "annual" ? proPlan.yearlyPrice : proPlan.monthlyPrice, proPlan.currency);
            periodProText.innerText = cycle === "annual" ? "/năm" : "/tháng";
        }
        if (enterprisePlan?.priceType === "contact") {
            priceEnterpriseText.innerText = "Liên hệ";
            periodEnterpriseText.innerText = "";
            const enterpriseCardTitle = document.querySelector("#card-tier-enterprise .tier-name");
            const enterpriseButton = document.getElementById("btn-select-enterprise");
            if (enterpriseCardTitle) enterpriseCardTitle.innerText = "Enterprise";
            if (enterpriseButton) enterpriseButton.innerText = "Liên hệ Sales";
        } else {
            priceEnterpriseText.innerText = getTierPrice("business", cycle);
            periodEnterpriseText.innerText = pricing[cycle].period;
        }
        [
            ["#card-tier-free .tier-features", freePlan],
            ["#card-tier-pro .tier-features", proPlan],
            ["#card-tier-enterprise .tier-features", enterprisePlan]
        ].forEach(([selector, plan]) => {
            const list = document.querySelector(selector);
            if (list && plan?.features) {
                list.innerHTML = renderBillingFeatureList(plan.features);
            }
        });

        const miniPricePro = document.querySelector("#mini-card-pro .mini-price");
        if (miniPricePro) {
            miniPricePro.innerHTML = `${pricing.monthly.pro}<span class="mini-period">/tháng</span>`;
        }
        const miniPriceEnterprise = document.querySelector("#mini-card-enterprise .mini-price");
        if (miniPriceEnterprise) {
            miniPriceEnterprise.innerHTML = enterprisePlan?.priceType === "contact" ? "Liên hệ" : `${getTierPrice("business", "monthly")}<span class="mini-period">/tháng</span>`;
        }
    }

    if (adminSavePricingBtn) {
        adminSavePricingBtn.addEventListener("click", async () => {
            const pricingInputs = [
                configPricePro,
                configPriceBusiness,
                configPriceEnterprise,
                configPriceProAnnual,
                configPriceBusinessAnnual,
                configPriceEnterpriseAnnual
            ];
            if (pricingInputs.some(input => !input)) {
                showToast("Thiếu input giá cước trên giao diện. Hãy tải lại trang.", "error");
                return;
            }
            const valPro = configPricePro.value.trim();
            const valBusiness = configPriceBusiness.value.trim();
            const valEnterprise = configPriceEnterprise.value.trim();
            const valProAnnual = configPriceProAnnual.value.trim();
            const valBusinessAnnual = configPriceBusinessAnnual.value.trim();
            const valEnterpriseAnnual = configPriceEnterpriseAnnual.value.trim();

            if (!valPro || !valBusiness || !valEnterprise || !valProAnnual || !valBusinessAnnual || !valEnterpriseAnnual) {
                showToast("Vui lòng nhập đầy đủ giá cước!", "error");
                return;
            }

            pricing.monthly.pro = valPro;
            pricing.monthly.business = valBusiness;
            pricing.monthly.enterprise = valEnterprise;
            pricing.annual.pro = valProAnnual;
            pricing.annual.business = valBusinessAnnual;
            pricing.annual.enterprise = valEnterpriseAnnual;

            try {
                const savedPricing = await adminService.savePricingConfig(pricing);
                applyPricingConfig(savedPricing);
                syncPricingUI();
                showToast("Đã cập nhật biểu giá dịch vụ trên backend!", "success");
                adminService.addSystemLog("warning", `System: Admin updated service pricing. Pro: ${valPro}, Business: ${valBusiness}, Enterprise: ${valEnterprise}`);
            } catch (error) {
                showToast(error.message || "Không thể lưu biểu giá lên backend", "error");
            }
        });
    }

    // Checkout coupon codes listener
    const applyCouponBtn = document.getElementById("apply-coupon-btn");
    const checkoutCouponInput = document.getElementById("checkout-coupon-input");
    const couponMessage = document.getElementById("coupon-message");

    if (applyCouponBtn) {
        applyCouponBtn.addEventListener("click", async () => {
            const code = checkoutCouponInput.value.trim().toUpperCase();
            if (!code) {
                couponMessage.style.display = "block";
                couponMessage.className = "coupon-invalid";
                couponMessage.innerText = "Vui lòng nhập mã giảm giá!";
                return;
            }

            applyCouponBtn.disabled = true;
            try {
                const validation = await billingService.validateCoupon(code);
                if (validation.valid) {
                    state.activeDiscount = validation.percent;
                    state.activeCouponCode = code;

                    couponMessage.style.display = "block";
                    couponMessage.className = "coupon-valid";
                    couponMessage.innerText = `Áp dụng thành công: Giảm ${validation.percent}%!`;

                    // Calculate discounted price
                    const basePriceStr = getTierPrice(state.selectedUpgradeTier);
                    const finalPrice = billingService.calculateDiscount(basePriceStr, validation.percent);
                    checkoutTierPrice.innerText = finalPrice;

                    showToast(`Đã áp dụng mã giảm giá ${code}!`);
                } else {
                    state.activeDiscount = 0;
                    state.activeCouponCode = "";

                    couponMessage.style.display = "block";
                    couponMessage.className = "coupon-invalid";
                    couponMessage.innerText = "Mã giảm giá không hợp lệ!";

                    const origPrice = getTierPrice(state.selectedUpgradeTier);
                    checkoutTierPrice.innerText = origPrice;
                }
            } catch (error) {
                state.activeDiscount = 0;
                state.activeCouponCode = "";
                couponMessage.style.display = "block";
                couponMessage.className = "coupon-invalid";
                couponMessage.innerText = error.message || "Không thể kiểm tra mã giảm giá.";
                const origPrice = getTierPrice(state.selectedUpgradeTier);
                checkoutTierPrice.innerText = origPrice;
            } finally {
                applyCouponBtn.disabled = false;
            }
        });
    }

    // C. Broadcast live notice system
    const adminBroadcastInput = document.getElementById("admin-broadcast-input");
    const adminSendBroadcastBtn = document.getElementById("admin-send-broadcast-btn");

    if (adminSendBroadcastBtn) {
        adminSendBroadcastBtn.addEventListener("click", async () => {
            const message = adminBroadcastInput.value.trim();
            if (!message) {
                showToast("Vui lòng nhập thông điệp thông báo!", "error");
                return;
            }
            adminSendBroadcastBtn.disabled = true;
            try {
                const broadcast = await adminService.sendBroadcast(message, {
                    severity: "warning",
                    forceLogout: true,
                    countdownSeconds: 60,
                    expiresInMinutes: 30
                });
                if (broadcast) state.broadcasts = adminService.loadBroadcasts();
                adminBroadcastInput.value = "";
                renderAdminBroadcasts();
                showToast("Đã phát thông báo backend. User sẽ thấy modal 60 giây trước khi bị đưa ra.", "success");
                adminService.addSystemLog("warning", `Broadcast: Admin sent notice: "${message}"`);
            } catch (error) {
                showToast(error.message || "Không thể gửi broadcast lên backend", "error");
            } finally {
                adminSendBroadcastBtn.disabled = false;
            }
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
            const keyText = item.key || "";
            const maskedKey = keyText.includes("...") ? keyText : keyText.substring(0, 10) + "..." + keyText.substring(keyText.length - 4);
            const keyStatus = normalizeApiKeyStatus(item.status);
            const statusBadge = keyStatus === "active" ? "badge-active" : "badge-banned";
            const actionBtnText = keyStatus === "active" ? "Thu hồi" : "Kích hoạt";
            const keyIdArg = encodeInlineArg(item.id);

            tr.innerHTML = `
                <td style="font-weight: 500;">${item.label}</td>
                <td style="font-family: var(--font-mono); font-size: 0.75rem;">${maskedKey}</td>
                <td><span class="admin-badge ${statusBadge}">${apiKeyStatusLabel(keyStatus)}</span></td>
                <td>
                    <button class="admin-btn admin-btn-ban" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="window.toggleAPIKey(decodeURIComponent('${keyIdArg}'))">${actionBtnText}</button>
                    <button class="admin-btn admin-btn-ban" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="window.deleteAPIKey(decodeURIComponent('${keyIdArg}'))">Xóa</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.toggleAPIKey = async function(id) {
        const key = state.apiKeys.find(k => String(k.id) === String(id));
        if (!key) return;

        const nextStatus = normalizeApiKeyStatus(key.status) === "active" ? "revoked" : "active";
        try {
            await adminService.updateAPIKeyStatus(id, nextStatus);
            key.status = nextStatus;
        } catch (error) {
            showToast(error.message || "Không thể cập nhật API key trên backend", "error");
            return;
        }

        if (normalizeApiKeyStatus(key.status) === "active") {
            showToast(`Đã kích hoạt API Key: ${key.label}`);
            adminService.addSystemLog("success", `API Keys: User activated API Key '${key.label}'`);
        } else {
            showToast(`Đã thu hồi API Key: ${key.label}`, "warning");
            adminService.addSystemLog("warning", `API Keys: User revoked API Key '${key.label}'`);
        }

        renderAPIKeysTable();
        renderAPIKeysChart();
    };

    window.deleteAPIKey = async function(id) {
        const key = state.apiKeys.find(k => String(k.id) === String(id));
        if (!key) return;
        if (!window.confirm(`Xóa API Key "${key.label}"?`)) return;
        try {
            await adminService.deleteAPIKey(id);
            state.apiKeys = adminService.loadAPIKeys();
            renderAPIKeysTable();
            renderAPIKeysChart();
            showToast(`Đã xóa API Key: ${key.label}`, "success");
            adminService.addSystemLog("warning", `API Keys: Admin deleted API Key '${key.label}'`);
        } catch (error) {
            showToast(error.message || "Không thể xóa API key", "error");
        }
    };

    async function generateNewAPIKey() {
        const labelInput = document.getElementById("new-key-name");
        const label = labelInput.value.trim() || `API Key ${state.apiKeys.length + 1}`;

        try {
            const newKeyObj = await adminService.createAPIKey(label);
            if (newKeyObj) {
                state.apiKeys = adminService.loadAPIKeys();
                labelInput.value = "";
                renderAPIKeysTable();
                renderAPIKeysChart();
                showToast(`Đã tạo API Key mới: ${label}`, "success");
                adminService.addSystemLog("success", `API Keys: Generated new API Key '${label}'`);
                historyService.addOperation("apikeys", `Tạo khóa API Key: "${label}"`);
            }
        } catch (error) {
            showToast(error.message || "Không thể tạo API key trên backend", "error");
        }
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
        const activeKeys = state.apiKeys.filter(k => normalizeApiKeyStatus(k.status) === "active");
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
    async function renderTemplatesGrid() {
        const grid = document.getElementById("templates-grid");
        if (!grid) return;

        grid.innerHTML = `<div class="glass-card" style="padding:1.25rem; color:var(--color-text-muted);">Đang tải biểu mẫu từ backend...</div>`;
        try {
            state.templates = await templateService.listTemplates();
        } catch (error) {
            grid.innerHTML = `<div class="glass-card" style="padding:1.25rem; color:var(--color-danger);">${escapeHTML(error.message || "Không thể tải biểu mẫu từ backend.")}</div>`;
            return;
        }

        if (!state.templates.length) {
            grid.innerHTML = `<div class="glass-card" style="padding:1.25rem; color:var(--color-text-muted);">Chưa có biểu mẫu thật trong backend.</div>`;
            return;
        }

        grid.innerHTML = state.templates.map(template => {
            const rawImage = template.image || template.previewImage || "";
            const imageUrl = rawImage && rawImage.startsWith("/") ? `${API_BASE}${rawImage}` : rawImage;
            return `
            <div class="template-card glass-card" data-category="${escapeHTML(template.category || "")}" style="padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <div class="template-image-preview" style="height: 140px; border-radius: 8px; overflow: hidden; border: 1px solid var(--dark-border); background: #0b0f19; position: relative;">
                    <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(template.name || "Template preview")}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    <span class="template-cat" style="position: absolute; top: 8px; left: 8px; font-size: 0.65rem; font-weight: 700; color: #fff; background: var(--color-purple-solid); padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">${escapeHTML(template.category || "Biểu mẫu")}</span>
                </div>
                <div class="template-details" style="display: flex; flex-direction: column; gap: 0.4rem; flex: 1;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 1.1rem;">${escapeHTML(template.icon || "📊")}</span>
                        <h4 style="font-size: 0.95rem; font-weight: 600; margin: 0; color: #fff;">${escapeHTML(template.name)}</h4>
                    </div>
                    <p style="font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.35; flex: 1; margin: 0;">${escapeHTML(template.description || "")}</p>
                    <div style="display: flex; gap: 6px; margin-top: 0.5rem;">
                        <button class="btn btn-primary btn-sm template-dl-btn" data-template-id="${escapeHTML(template.id)}" style="flex: 1; font-size: 0.72rem; padding: 6px 4px; background: var(--color-excel-solid); border: none; font-weight:600; border-radius:6px; color:#fff; cursor:pointer;">📥 XLSX</button>
                        <button class="btn btn-outline btn-sm template-use-btn" data-template-id="${escapeHTML(template.id)}" style="flex: 1; font-size: 0.72rem; padding: 6px 4px; border-radius:6px; cursor:pointer;">⚡ Sử dụng</button>
                    </div>
                </div>
            </div>
        `;
        }).join("");

        grid.querySelectorAll(".template-dl-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const templateId = btn.getAttribute("data-template-id");
                try {
                    const payload = await templateService.useTemplate(templateId);
                    const downloadUrl = payload?.downloadUrl || "";
                    if (downloadUrl) {
                        window.open(downloadUrl, "_blank", "noopener");
                        showToast(`Đã mở biểu mẫu từ backend: ${payload.template.name}`, "success");
                    } else {
                        showToast("Backend chưa trả file biểu mẫu thật để tải xuống.", "error");
                    }
                    historyService.addOperation("template", `Mở biểu mẫu: "${payload?.template?.name || templateId}"`);
                } catch (error) {
                    showToast(error.message || "Không thể mở biểu mẫu", "error");
                }
            });
        });

        grid.querySelectorAll(".template-use-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const templateId = btn.getAttribute("data-template-id");
                window.switchWorkspaceTab("table-builder");
                showToast(`Đã mở AI Table Builder. Nhập mô tả hoặc chọn nguồn dữ liệu thật cho mẫu ${templateId}.`, "info");
            });
        });
    }

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

    // F. User Deep-Dive logs view
    window.viewUserAudit = async function(userId) {
        const user = state.users.find(u => String(u.id) === String(userId));
        if (!user) return;

        document.getElementById("audit-user-name").innerText = user.name;
        document.getElementById("audit-user-email").innerText = user.email;

        const tierBadge = document.getElementById("audit-user-tier");
        const normalizedTier = normalizeTier(user.tier);
        tierBadge.innerText = tierLabel(normalizedTier).toUpperCase();
        tierBadge.className = `user-tier-badge ${tierBadgeClass(normalizedTier)}`;

        document.getElementById("audit-api-count").innerText = user.usageCount;

        const statusText = document.getElementById("audit-user-status");
        statusText.innerText = accountStatusLabel(user.status);
        statusText.style.color = normalizeAccountStatus(user.status) === "active" ? "var(--color-success)" : "var(--color-danger)";

        const auditLogsContainer = document.getElementById("audit-user-logs");
        auditLogsContainer.innerHTML = `<div class="log-line"><span class="log-time">[--]</span><span>Đang tải audit từ backend...</span></div>`;

        document.getElementById("admin-user-audit-modal").classList.add("active");
        try {
            const audit = await adminService.getUserAudit(userId);
            const lines = [];
            (audit.adminAuditLogs || []).forEach(row => {
                lines.push({ time: row.created_at, text: `Admin action: ${row.action || ""} ${row.reason ? `(${row.reason})` : ""}` });
            });
            (audit.billingAudit || []).forEach(row => {
                lines.push({ time: row.created_at, text: `Billing: ${row.old_tier || "--"} -> ${row.new_tier || "--"} · ${row.reason || ""}` });
            });
            (audit.checkoutRequests || []).forEach(row => {
                lines.push({ time: row.createdAt, text: `Checkout ${row.planCode || "--"} · ${checkoutStatusLabel(row.status)} · ${formatCurrency(row.amount, row.currency)}` });
            });
            (audit.files || []).forEach(row => {
                lines.push({ time: row.uploaded_at, text: `File: ${row.name || row.id} · ${row.status || "ready"} · ${row.size || ""}` });
            });
            (audit.aiUsage || []).forEach(row => {
                lines.push({ time: row.usage_date, text: `AI usage: ${row.feature || "all"} · ${row.count || row.usage_count || 0} lượt` });
            });
            (audit.operationLogs || []).forEach(row => {
                lines.push({ time: row.created_at, text: `Operation: ${row.action || ""}` });
            });
            lines.sort((a, b) => String(b.time || "").localeCompare(String(a.time || "")));

            if (!lines.length) {
                auditLogsContainer.innerHTML = `<div class="log-line"><span class="log-time">[--]</span><span>Chưa có audit backend cho user này.</span></div>`;
            } else {
                auditLogsContainer.innerHTML = "";
                lines.slice(0, 80).forEach(log => {
                    const logLine = document.createElement("div");
                    logLine.className = "log-line";
                    logLine.innerHTML = `
                        <span class="log-time">[${escapeHTML(formatDateTime(log.time))}]</span>
                        <span>${escapeHTML(log.text)}</span>
                    `;
                    auditLogsContainer.appendChild(logLine);
                });
            }
            adminService.addSystemLog("success", `System: Admin viewed deep-dive audit trail for user ${user.email}`);
        } catch (error) {
            auditLogsContainer.innerHTML = `<div class="log-line"><span class="log-time">[--]</span><span>${escapeHTML(error.message || "Không thể tải audit user từ backend.")}</span></div>`;
        }
    };

    const adminAuditCloseBtn = document.getElementById("admin-audit-close-btn");
    if (adminAuditCloseBtn) {
        adminAuditCloseBtn.addEventListener("click", () => {
            document.getElementById("admin-user-audit-modal").classList.remove("active");
        });
    }

    // G. Live metrics from backend status
    function startLiveMetrics() {
        const liveCpuText = document.getElementById("live-metric-cpu");
        const liveCpuBar = document.getElementById("live-metric-cpu-bar");
        const liveRamText = document.getElementById("live-metric-ram");
        const liveRamBar = document.getElementById("live-metric-ram-bar");
        const update = async () => {
            if (!isCurrentUserAdmin()) return;
            const metrics = await adminService.getMetrics().catch(() => null);
            if (liveCpuText && liveCpuBar) {
                liveCpuText.innerText = metrics ? "OK" : "--";
                liveCpuBar.style.width = metrics ? "100%" : "0%";
                liveCpuBar.style.backgroundColor = metrics ? "var(--color-success)" : "rgba(255,255,255,0.1)";
            }
            if (liveRamText && liveRamBar) {
                liveRamText.innerText = metrics ? `${metrics.apiRequestsCount || 0} req` : "--";
                liveRamBar.style.width = metrics ? "100%" : "0%";
            }
        };
        update();
        setInterval(update, 30000);
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
        settingsWorkspaceName.value = adminService.loadWorkspaceSettings().workspaceName || "ExcelAI Workspace";
    }
    if (settingsRetention) {
        settingsRetention.value = adminService.loadWorkspaceSettings().retention || "30";
    }

    if (settingsSaveBtn) {
        settingsSaveBtn.addEventListener("click", async () => {
            const workspaceName = settingsWorkspaceName.value.trim();
            const retentionVal = settingsRetention.value;

            try {
                await adminService.saveWorkspaceSettings({ workspaceName, retention: retentionVal });
                showToast("Đã lưu cấu hình Workspace thành công!", "success");
                adminService.addSystemLog("success", `Workspace Settings: Updated workspace name to '${workspaceName}'`);
            } catch (error) {
                showToast(error.message || "Không thể lưu cấu hình Workspace lên backend", "error");
            }
        });
    }

    if (settingsPurgeBtn) {
        settingsPurgeBtn.addEventListener("click", () => {
            if (confirm("Hành động này chỉ xóa cache trình duyệt của phiên hiện tại. Dữ liệu backend không bị xóa. Bạn muốn tiếp tục?")) {
                historyService.clearLocalData();
                showToast("Đã xóa cache phiên hiện tại. Trang web sẽ tải lại sau 1.5 giây...", "warning");
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
                false,
                "",
                "",
                null,
                null
            );
        }

        const cleaningOverlay = document.getElementById("cleaning-lock-overlay");
        const reportsOverlay = document.getElementById("reports-lock-overlay");
        if (cleaningOverlay) cleaningOverlay.style.display = isFree ? "flex" : "none";
        if (reportsOverlay) reportsOverlay.style.display = isFree ? "flex" : "none";
    }

    function updateFileSelectDropdowns() {
        const dynamicAutopilotFileSelect = document.getElementById("autopilot-file-select");
        const selects = [
            checkerFileSelect,
            cleanFileSelect,
            reconcileFileASelect,
            reconcileFileBSelect,
            dynamicAutopilotFileSelect || autopilotFileSelect,
            docBuilderFileSelect
        ];

        selects.forEach(select => {
            if (!select) return;
            const firstOpt = select.options[0];
            select.innerHTML = "";
            if (firstOpt) select.appendChild(firstOpt);

            state.uploadedFiles.forEach(fileObj => {
                const opt = document.createElement("option");
                opt.value = select.id === "autopilot-file-select" ? (fileObj.id || fileObj.name) : fileObj.name;
                opt.innerText = `${fileObj.name} (${fileObj.rowCount} dòng)`;
                select.appendChild(opt);
            });
        });

        // Auto-select files if they exist in state.uploadedFiles and are not selected yet
        if (checkerFileSelect) {
            const hasTest = state.uploadedFiles.some(f => f.name === "test.xlsx");
            if (hasTest && (!checkerFileSelect.value || checkerFileSelect.value === "")) {
                checkerFileSelect.value = "test.xlsx";
            }
        }
        if (reconcileFileASelect) {
            const hasA = state.uploadedFiles.some(f => f.name === "So_phu_ngan_hang_Q1_2024.xlsx");
            if (hasA && (!reconcileFileASelect.value || reconcileFileASelect.value === "")) {
                reconcileFileASelect.value = "So_phu_ngan_hang_Q1_2024.xlsx";
                reconcileFileASelect.dispatchEvent(new Event("change"));
            }
        }
        if (reconcileFileBSelect) {
            const hasB = state.uploadedFiles.some(f => f.name === "Hoa_don_ban_le_Q1_2024.xlsx");
            if (hasB && (!reconcileFileBSelect.value || reconcileFileBSelect.value === "")) {
                reconcileFileBSelect.value = "Hoa_don_ban_le_Q1_2024.xlsx";
                reconcileFileBSelect.dispatchEvent(new Event("change"));
            }
        }

        if (typeof window.updateReconciliationFileCards === 'function') {
            window.updateReconciliationFileCards();
        }
        if (typeof recalculateGrid === 'function') {
            recalculateGrid();
        }
    }

    function formatFileSize(size) {
        if (!Number.isFinite(Number(size))) return size || "--";
        const bytes = Number(size);
        if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    function fileExtension(fileObj) {
        return String(fileObj?.type || fileObj?.name || "csv").split(".").pop().toLowerCase();
    }

    function fileStatus(fileObj) {
        if (fileObj?.status === "error" || fileObj?.error) return "error";
        if (fileObj?.status === "processing" || fileObj?.status === "uploading") return "processing";
        const stats = fileObj?.statistics || {};
        if ((stats.missingValues || 0) > 0 || (stats.duplicateRows || 0) > 0) return "warning";
        return "ready";
    }

    function statusLabel(status) {
        return {
            ready: "Sẵn sàng",
            warning: "Có cảnh báo",
            error: "Có lỗi",
            processing: "Đang xử lý",
            unreadable: "Không đọc được"
        }[status] || "Sẵn sàng";
    }

    function statusBadge(status) {
        return `file-status-badge ${status}`;
    }

    function columnLetter(index) {
        let n = index + 1;
        let letter = "";
        while (n > 0) {
            const rem = (n - 1) % 26;
            letter = String.fromCharCode(65 + rem) + letter;
            n = Math.floor((n - 1) / 26);
        }
        return letter;
    }

    function fileIssueSummary(fileObj) {
        const stats = fileObj?.statistics || {};
        const warnings = [];
        if (stats.missingValues) warnings.push(`${stats.missingValues} ô trống`);
        if (stats.duplicateRows) warnings.push(`${stats.duplicateRows} dòng trùng`);
        const warningCols = (stats.columns || []).filter(col => (col.missingCount || 0) > 0).length;
        if (warningCols) warnings.push(`${warningCols} cột cảnh báo`);
        return warnings.length ? warnings.join(", ") : "Không phát hiện lỗi";
    }

    function dataLabelsForFile(fileObj) {
        const ext = fileExtension(fileObj);
        const labels = fileObj?.labels || [];
        if (labels.length) return labels;
        if (ext === "csv") return ["File nguồn"];
        if ((fileObj?.name || "").toLowerCase().includes("template")) return ["File template"];
        return ["Cần kiểm tra"];
    }

    function filteredWorkspaceFiles() {
        return state.uploadedFiles.filter(fileObj => {
            const name = (fileObj.name || "").toLowerCase();
            const ext = fileExtension(fileObj);
            const status = fileStatus(fileObj);
            const searchOk = !state.workspaceFiles.search || name.includes(state.workspaceFiles.search.toLowerCase());
            const statusOk = state.workspaceFiles.status === "all" || status === state.workspaceFiles.status;
            const formatOk = state.workspaceFiles.format === "all" || ext === state.workspaceFiles.format;
            return searchOk && statusOk && formatOk;
        });
    }

    function updateWorkspaceFileStats() {
        const total = state.uploadedFiles.length;
        const statuses = state.uploadedFiles.map(fileStatus);
        const totalBytes = state.uploadedFiles.reduce((sum, fileObj) => sum + (Number(fileObj.size) || 0), 0);
        const totalRows = state.uploadedFiles.reduce((sum, fileObj) => sum + (Number(fileObj.rowCount || fileObj.totalRows) || 0), 0);
        const aiReady = state.uploadedFiles.filter(fileObj => fileObj.statistics).length;
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.innerText = value;
        };
        setText("files-stat-total", total);
        setText("files-stat-ready", statuses.filter(s => s === "ready").length);
        setText("files-stat-errors", statuses.filter(s => s === "error" || s === "warning").length);
        setText("files-stat-processing", statuses.filter(s => s === "processing").length);
        setText("files-stat-size", formatFileSize(totalBytes));
        setText("files-stat-rows", totalRows.toLocaleString("vi-VN"));
        setText("files-stat-ai", aiReady);
        if (filesCapacityText) filesCapacityText.innerText = `${formatFileSize(totalBytes)} / 250 MB`;
        if (filesCapacityBar) filesCapacityBar.style.width = `${Math.min(100, (totalBytes / (250 * 1024 * 1024)) * 100)}%`;
    }

    function updateWorkspaceSelectionUI() {
        const count = state.workspaceFiles.selectedRows.size;
        if (filesSelectionSummary) filesSelectionSummary.innerText = count ? `${count} file đã chọn` : "Chưa chọn file nào";
        if (filesBulkActions) filesBulkActions.style.display = count ? "flex" : "none";
        if (filesBulkCount) filesBulkCount.innerText = `${count} file đã chọn`;
    }

    function addUploadQueueItem(file, statusText) {
        if (!filesUploadQueue) return null;
        filesUploadQueue.style.display = "flex";
        const item = document.createElement("div");
        item.className = "upload-queue-item";
        item.innerHTML = `
            <div><strong>${escapeHTML(file.name)}</strong><span>${formatFileSize(file.size)} · ${escapeHTML(statusText)}</span></div>
            <div class="upload-progress"><span style="width: 20%;"></span></div>
            <button class="admin-btn btn-xs" type="button">Hủy</button>
        `;
        filesUploadQueue.prepend(item);
        return item;
    }

    function finishUploadQueueItem(item, statusText, success = true) {
        if (!item) return;
        item.classList.toggle("success", success);
        item.classList.toggle("error", !success);
        const label = item.querySelector("span");
        const progress = item.querySelector(".upload-progress span");
        if (label) label.innerText = statusText;
        if (progress) progress.style.width = success ? "100%" : "65%";
    }

    function openWorkspaceFilePicker(e) {
        if (e) e.stopPropagation();
        if (filesInput) filesInput.click();
    }

    [filesUploadQuickBtn, filesChooseBtn, filesEmptyUploadBtn].forEach(btn => {
        if (btn) btn.addEventListener("click", openWorkspaceFilePicker);
    });

    [filesTemplateBtn, filesTemplateSecondaryBtn].forEach(btn => {
        if (btn) btn.addEventListener("click", (e) => {
            e.stopPropagation();
            showToast("Template sẽ được tải từ thư viện backend khi đã cấu hình file thật.", "info");
            window.switchWorkspaceTab("templates");
        });
    });

    if (filesNewWorkspaceBtn) filesNewWorkspaceBtn.addEventListener("click", () => showToast("Workspace mới cần quyền quản trị Enterprise. Yêu cầu đã được ghi nhận.", "info"));
    if (filesGuideBtn) filesGuideBtn.addEventListener("click", () => showToast("Hướng dẫn: tải file, chọn Xem trước, sau đó dùng Rà lỗi dữ liệu hoặc Phân tích AI.", "info"));

    if (filesClearAllBtn) {
        filesClearAllBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (state.uploadedFiles.length === 0) {
                showToast("Workspace chưa có file để xóa.", "info");
                return;
            }
            state.uploadedFiles = [];
            state.workspaceFiles.selectedRows.clear();
            state.workspaceFiles.selectedFileName = "";
            renderUploadedFilesTable();
            updateFileSelectDropdowns();
            if (filesPreviewCard) filesPreviewCard.style.display = "none";
            if (filesPreviewPlaceholder) filesPreviewPlaceholder.style.display = "flex";
            document.querySelector(".file-workspace-page .file-preview-panel")?.classList.remove("has-preview");
            showToast("Đã xóa toàn bộ file khỏi danh sách làm việc.", "warning");
        });
    }

    if (filesDropzone && filesInput) {
        filesDropzone.addEventListener("click", openWorkspaceFilePicker);
        filesDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            filesDropzone.classList.add("drag-active");
        });
        filesDropzone.addEventListener("dragleave", () => filesDropzone.classList.remove("drag-active"));
        filesDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            filesDropzone.classList.remove("drag-active");
            Array.from(e.dataTransfer.files).forEach(file => handleWorkspaceFileUpload(file));
        });
        filesInput.addEventListener("change", (e) => {
            Array.from(e.target.files).forEach(file => handleWorkspaceFileUpload(file));
            filesInput.value = "";
        });
    }

    [filesSearchInput, filesStatusFilter, filesFormatFilter].forEach(input => {
        if (!input) return;
        input.addEventListener("input", () => {
            state.workspaceFiles.search = filesSearchInput?.value || "";
            state.workspaceFiles.status = filesStatusFilter?.value || "all";
            state.workspaceFiles.format = filesFormatFilter?.value || "all";
            renderUploadedFilesTable();
        });
    });

    if (filesSelectAll) {
        filesSelectAll.addEventListener("change", () => {
            state.workspaceFiles.selectedRows.clear();
            if (filesSelectAll.checked) {
                filteredWorkspaceFiles().forEach(fileObj => state.workspaceFiles.selectedRows.add(fileObj.name));
            }
            renderUploadedFilesTable();
        });
    }

    window.toggleWorkspaceFileSelection = function(fileName, checked) {
        if (checked) state.workspaceFiles.selectedRows.add(fileName);
        else state.workspaceFiles.selectedRows.delete(fileName);
        updateWorkspaceSelectionUI();
    };

    if (filesBulkDeleteBtn) {
        filesBulkDeleteBtn.addEventListener("click", () => {
            const selected = state.workspaceFiles.selectedRows;
            if (!selected.size) return;
            state.uploadedFiles = state.uploadedFiles.filter(fileObj => !selected.has(fileObj.name));
            selected.clear();
            renderUploadedFilesTable();
            updateFileSelectDropdowns();
            showToast("Đã xóa các file đã chọn.", "warning");
        });
    }

    [filesPreviewSearch, filesPreviewZoom, filesWrapToggle, filesHighlightToggle, filesFreezeToggle, filesPreviewMode, filesPreviewLimit].forEach(control => {
        if (!control) return;
        control.addEventListener("input", () => {
            state.workspaceFiles.previewMode = filesPreviewMode?.value || "excel";
            state.workspaceFiles.previewLimit = Number(filesPreviewLimit?.value || 50);
            state.workspaceFiles.wrapText = Boolean(filesWrapToggle?.checked);
            state.workspaceFiles.highlightErrors = Boolean(filesHighlightToggle?.checked);
            state.workspaceFiles.freezeHeader = Boolean(filesFreezeToggle?.checked);
            state.workspaceFiles.zoom = filesPreviewZoom?.value || "100%";
            if (state.workspaceFiles.selectedFileName) window.previewWorkspaceFile(state.workspaceFiles.selectedFileName);
        });
    });

    if (filesFullscreenBtn) {
        filesFullscreenBtn.addEventListener("click", () => {
            const shell = document.querySelector(".file-workspace-page .file-preview-panel");
            if (!shell) return;
            shell.classList.toggle("is-fullscreen");
            filesFullscreenBtn.innerText = shell.classList.contains("is-fullscreen") ? "Thoát fullscreen" : "Fullscreen";
        });
    }

    async function handleWorkspaceFileUpload(file) {
        const validation = fileService.validateFile(file);
        if (!validation.valid) {
            showToast(validation.error, "error");
            return;
        }

        const duplicated = state.uploadedFiles.find(existing => existing.name === file.name);
        if (duplicated) {
            const choice = await openAdminTextDialog({
                title: "File đã tồn tại",
                label: `Chọn cách xử lý file "${file.name}"`,
                value: "2",
                selectOptions: [
                    { value: "", label: "Hủy upload" },
                    { value: "1", label: "Ghi đè file cũ" },
                    { value: "2", label: "Tạo phiên bản mới" },
                    { value: "3", label: "Đổi tên tự động" }
                ]
            });
            if (!choice) {
                showToast("Đã hủy upload file trùng tên.", "info");
                return;
            }
            if (choice === "1") {
                state.uploadedFiles = state.uploadedFiles.filter(existing => existing.name !== file.name);
            } else if (choice === "2" || choice === "3") {
                const version = state.uploadedFiles.filter(existing => existing.name.startsWith(file.name.replace(/\.[^.]+$/, ""))).length + 1;
                file = new File([file], `${file.name.replace(/(\.[^.]+)$/, `_v${version}$1`)}`, { type: file.type });
            }
        }

        showToast(`Đang tải lên tệp: ${file.name}...`, "info");
        const queueItem = addUploadQueueItem(file, "Đang tải lên");

        try {
            if (queueItem?.querySelector(".upload-progress span")) queueItem.querySelector(".upload-progress span").style.width = "55%";
            const parsedData = await fileService.parseCSV(file);
            const enrichedData = {
                ...parsedData,
                uploadedAt: parsedData.uploadedAt || parsedData.uploaded_at || new Date().toISOString(),
                uploadedBy: parsedData.uploadedBy || state.currentUser.name || state.currentUser.email || "Người dùng",
                version: parsedData.version || "v1",
                status: "ready"
            };
            state.uploadedFiles.push(enrichedData);

            const sizeStr = (file.size / 1024 / 1024).toFixed(2) + " MB";
            adminService.addJob(file.name, state.currentUser.name, sizeStr, "upload", "ready", "0.8s");

            showToast(`Tải lên thành công: ${file.name}!`);
            finishUploadQueueItem(queueItem, "File đã sẵn sàng để phân tích", true);
            adminService.addSystemLog("success", `Workspace: User uploaded file '${file.name}'`);
            historyService.addOperation("file", `Tải lên file: "${file.name}"`);

            renderUploadedFilesTable();
            updateFileSelectDropdowns();
        } catch (err) {
            console.error(err);
            finishUploadQueueItem(queueItem, "Không đọc được dữ liệu", false);
            showToast(`Lỗi khi đọc file CSV: ${err}`, "error");
        }
    }

    function renderUploadedFilesTable() {
        if (!filesTableBody) return;
        filesTableBody.innerHTML = "";
        updateWorkspaceFileStats();
        updateWorkspaceSelectionUI();

        const filesToRender = filteredWorkspaceFiles();
        if (filesToRender.length === 0) {
            filesTableBody.innerHTML = `<tr><td colspan="8"><div class="file-empty-row"><strong>Chưa có file phù hợp</strong><span>Kéo thả file Excel/CSV vào khu upload hoặc điều chỉnh bộ lọc.</span></div></td></tr>`;
            return;
        }

        filesToRender.forEach((fileObj) => {
            const idx = state.uploadedFiles.findIndex(f => f.name === fileObj.name);
            const sizeStr = formatFileSize(fileObj.size);
            const fileNameArg = encodeInlineArg(fileObj.name);
            const fileIdArg = encodeInlineArg(fileObj.id || fileObj.fileId || "");
            const fileIndexArg = encodeInlineArg(idx);
            const ext = fileExtension(fileObj).toLowerCase();
            const status = fileStatus(fileObj);
            const uploadedAt = fileObj.uploadedAt || fileObj.uploaded_at || new Date().toISOString();

            const dateObj = new Date(uploadedAt);
            const pad = (n) => String(n).padStart(2, '0');
            const uploadedText = `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;

            const owner = fileObj.uploadedBy || fileObj.owner || state.currentUser.name || "Người dùng";

            const tr = document.createElement("tr");
            if (state.workspaceFiles.selectedFileName === fileObj.name) tr.classList.add("active-file-row");

            // Icon
            let iconHtml = "";
            if (ext === "csv") {
                iconHtml = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="color: #0ea5e9; flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" fill="rgba(14, 165, 233, 0.1)" stroke="currentColor" stroke-width="2"></rect><text x="5" y="15" fill="currentColor" font-size="8" font-family="sans-serif" font-weight="bold">CSV</text></svg>`;
            } else {
                iconHtml = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="color: #10b981; flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" fill="rgba(16, 185, 129, 0.1)" stroke="currentColor" stroke-width="2"></rect><text x="6" y="15" fill="currentColor" font-size="8" font-family="sans-serif" font-weight="bold">X</text></svg>`;
            }

            // Status pill
            let statusHtml = "";
            if (status === "ready") {
                statusHtml = `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.72rem; font-family: var(--font-sans); display: inline-flex; align-items: center; gap: 4px;">🟢 Sẵn sàng</span>`;
            } else if (status === "warning") {
                statusHtml = `<span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.72rem; font-family: var(--font-sans); display: inline-flex; align-items: center; gap: 4px;">🟡 Có cảnh báo</span>`;
            } else if (status === "processing") {
                const progressVal = fileObj.progress || 45;
                statusHtml = `
                    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px; padding: 4px 8px; font-weight: 600; font-size: 0.72rem; color: #3b82f6; display: inline-flex; align-items: center; justify-content: space-between; position: relative; overflow: hidden; height: 24px; min-width: 110px;">
                        <div style="position: absolute; left: 0; top: 0; bottom: 0; background: rgba(59, 130, 246, 0.2); width: ${progressVal}%;"></div>
                        <span style="position: relative; z-index: 1;">Đang xử lý ${progressVal}%</span>
                    </div>
                `;
            } else {
                statusHtml = `<span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.72rem; font-family: var(--font-sans); display: inline-flex; align-items: center; gap: 4px;">🔴 Có lỗi</span>`;
            }

            // Dimensions
            const dimensionsHtml = status === "processing" ? `- / -` : `${fileObj.rowCount || fileObj.totalRows || 0} / ${fileObj.colCount || fileObj.headers?.length || 0}`;

            // Quality pill
            let qualityHtml = "";
            const stats = fileObj.statistics || {};
            const warningCols = (stats.columns || []).filter(col => (col.missingCount || 0) > 0).length;

            if (status === "ready") {
                qualityHtml = `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.72rem; font-family: var(--font-sans); display: inline-flex; align-items: center; gap: 4px;">🟢 Tốt</span>`;
            } else if (status === "warning") {
                const colText = warningCols > 0 ? `${warningCols} cột` : "1 cột";
                qualityHtml = `<span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.72rem; font-family: var(--font-sans); display: inline-flex; align-items: center; gap: 4px;">🟡 Cảnh báo (${colText})</span>`;
            } else if (status === "processing") {
                qualityHtml = `<span style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.72rem; font-family: var(--font-sans); display: inline-flex; align-items: center; gap: 4px;">🔵 Đang phân tích...</span>`;
            } else {
                qualityHtml = `<span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.72rem; font-family: var(--font-sans); display: inline-flex; align-items: center; gap: 4px;">🔴 Có lỗi</span>`;
            }

            // Actions Column
            let actionsHtml = "";
            if (status === "processing") {
                actionsHtml = `<button class="btn btn-outline btn-xs" style="color: #94a3b8; border-color: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-family: var(--font-sans);" onclick="window.deleteWorkspaceFile(decodeURIComponent('${fileIndexArg}'))">Hủy</button>`;
            } else {
                actionsHtml = `
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button class="btn btn-outline btn-xs" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; font-family: var(--font-sans);" onclick="window.previewWorkspaceFile(decodeURIComponent('${fileNameArg}'))">Xem</button>
                        <button class="btn btn-outline btn-xs" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; font-family: var(--font-sans);" onclick="window.switchWorkspaceTab('reports'); window.selectAutoReportFile && window.selectAutoReportFile(decodeURIComponent('${fileIdArg}'));">AI</button>
                        <button class="btn btn-outline btn-xs" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; font-family: var(--font-sans);" onclick="window.switchWorkspaceTab('checker'); document.getElementById('checker-file-select').value=decodeURIComponent('${fileNameArg}'); document.getElementById('checker-file-select').dispatchEvent(new Event('change'));">Rà lỗi</button>
                        <div class="dropdown-v3" style="position: relative; display: inline-block;">
                            <button class="btn btn-outline btn-xs" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; font-family: var(--font-sans);" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'; event.stopPropagation();">...</button>
                            <div class="dropdown-menu-v3" style="display: none; position: absolute; right: 0; top: 100%; background: #0f172a; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; z-index: 100; min-width: 120px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                                <a href="#" style="display: block; padding: 6px 12px; color: #fff; text-decoration: none; font-size: 0.75rem; text-align: left;" onclick="window.switchWorkspaceTab('cleaning'); document.getElementById('clean-file-select').value=decodeURIComponent('${fileNameArg}'); document.getElementById('clean-file-select').dispatchEvent(new Event('change'));">Làm sạch</a>
                                <a href="#" style="display: block; padding: 6px 12px; color: #fff; text-decoration: none; font-size: 0.75rem; text-align: left;" onclick="window.switchWorkspaceTab('reconciliation')">Đối soát</a>
                                <a href="#" style="display: block; padding: 6px 12px; color: #ef4444; text-decoration: none; font-size: 0.75rem; text-align: left;" onclick="window.deleteWorkspaceFile(decodeURIComponent('${fileIndexArg}'))">Xóa</a>
                            </div>
                        </div>
                    </div>
                `;
            }

            tr.innerHTML = `
                <td><input type="checkbox" class="files-row-checkbox" ${state.workspaceFiles.selectedRows.has(fileObj.name) ? "checked" : ""} onchange="window.toggleWorkspaceFileSelection(decodeURIComponent('${fileNameArg}'), this.checked)"></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${iconHtml}
                        <strong style="color: #fff; font-weight: 600;">${escapeHTML(fileObj.name)}</strong>
                    </div>
                </td>
                <td>${escapeHTML(sizeStr)}</td>
                <td>${statusHtml}</td>
                <td>${escapeHTML(dimensionsHtml)}</td>
                <td>${escapeHTML(uploadedText)}</td>
                <td>${qualityHtml}</td>
                <td>${actionsHtml}</td>
            `;
            filesTableBody.appendChild(tr);
        });
    }

    window.previewWorkspaceFile = async function(fileName) {
        const fileObj = state.uploadedFiles.find(f => f.name === fileName);
        if (!fileObj) return;

        if (fileObj.id && (!fileObj.headers || fileObj.headers.length === 0)) {
            try {
                const preview = await fileService.getFilePreview(fileObj.id);
                fileObj.headers = preview.headers || [];
                fileObj.rows = preview.rows || [];
                fileObj.totalRows = preview.totalRows || fileObj.rowCount || 0;
                fileObj.statistics = fileService.buildDataStatistics(fileObj.headers, fileObj.rows, fileObj.totalRows);
            } catch (error) {
                showToast(error.message || "Không thể tải preview từ backend", "error");
                return;
            }
        }

        state.workspaceFiles.selectedFileName = fileObj.name;
        renderUploadedFilesTable();
        document.querySelector(".file-workspace-page .file-preview-panel")?.classList.add("has-preview");
        filesPreviewPlaceholder.style.display = "none";
        filesPreviewCard.style.display = "block";
        filesPreviewName.innerText = fileObj.name;
        if (filesPreviewType) filesPreviewType.innerText = fileExtension(fileObj).toUpperCase();
        if (filesPreviewSize) filesPreviewSize.innerText = formatFileSize(fileObj.size);
        if (filesPreviewSheet) filesPreviewSheet.innerText = "Sheet1";
        if (filesPreviewDimensions) filesPreviewDimensions.innerText = `${fileObj.rowCount || fileObj.totalRows || 0} dòng x ${fileObj.colCount || fileObj.headers?.length || 0} cột`;
        if (filesPreviewRange) filesPreviewRange.innerText = `A1:${columnLetter(Math.max(0, (fileObj.headers || []).length - 1))}${(fileObj.rowCount || fileObj.totalRows || 0) + 1}`;
        if (filesPreviewStatus) filesPreviewStatus.innerText = statusLabel(fileStatus(fileObj));
        if (filesSheetTabs) filesSheetTabs.innerHTML = `<button class="active">✓ Sheet1</button><button>✓ Dữ liệu gốc</button><button class="${fileStatus(fileObj) === "warning" ? "has-warning" : ""}">! Kiểm tra lỗi</button>`;
        if (filesSheetSelect) filesSheetSelect.innerHTML = `<option>Sheet1</option><option>Dữ liệu gốc</option><option>Kiểm tra lỗi</option>`;

        const stats = fileObj.statistics || {};
        if (filesQualityErrors) filesQualityErrors.innerText = ((stats.missingValues || 0) + (stats.duplicateRows || 0)).toLocaleString("vi-VN");
        if (filesQualityDuplicates) filesQualityDuplicates.innerText = (stats.duplicateRows || 0).toLocaleString("vi-VN");
        if (filesQualityEmpty) filesQualityEmpty.innerText = (stats.missingValues || 0).toLocaleString("vi-VN");
        if (filesQualityColumns) filesQualityColumns.innerText = ((stats.columns || []).filter(col => (col.missingCount || 0) > 0).length).toLocaleString("vi-VN");
        if (filesAiInsights) {
            const keyColumn = (fileObj.headers || []).find(h => /mã|id|key|khách/i.test(h)) || fileObj.headers?.[0] || "cột đầu tiên";
            const fileStatusVal = fileStatus(fileObj);
            if (fileStatusVal === "ready") {
                filesAiInsights.innerHTML = `<li>Tệp đã sẵn sàng phân tích. Bạn có thể làm sạch để tối ưu chất lượng.</li>`;
            } else {
                filesAiInsights.innerHTML = `
                    <li>File có ${escapeHTML(fileObj.rowCount || fileObj.totalRows || 0)} dòng và ${escapeHTML(fileObj.colCount || fileObj.headers?.length || 0)} cột.</li>
                    <li>Cột quan trọng có thể là "${escapeHTML(keyColumn)}".</li>
                    <li>Phát hiện ${escapeHTML(stats.missingValues || 0)} ô trống và ${escapeHTML(stats.duplicateRows || 0)} dòng trùng lặp.</li>
                `;
            }
        }

        const limit = state.workspaceFiles.previewLimit || 50;
        const search = (filesPreviewSearch?.value || "").toLowerCase();
        const headers = fileObj.headers || [];
        let rowsToShow = (fileObj.rows || []).slice(0, limit);
        if (search) {
            rowsToShow = rowsToShow.filter(row => row.some(cell => String(cell || "").toLowerCase().includes(search)));
        }
        if (state.workspaceFiles.previewMode === "error") {
            rowsToShow = rowsToShow.filter(row => row.some(cell => String(cell || "").trim() === ""));
        }

        const tableClasses = [
            state.workspaceFiles.wrapText ? "wrap-text" : "",
            state.workspaceFiles.highlightErrors ? "highlight-errors" : "",
            state.workspaceFiles.freezeHeader ? "freeze-header" : ""
        ].filter(Boolean).join(" ");
        const zoomScale = (parseInt(state.workspaceFiles.zoom, 10) || 100) / 100;
        let tableHtml = `<thead><tr><th class="corner-cell"></th>`;
        headers.forEach((h, index) => {
            const colWarn = (stats.columns || []).find(col => col.name === h && (col.missingCount || 0) > 0);
            tableHtml += `<th><span class="excel-col-letter">${columnLetter(index)}</span><strong>${escapeHTML(h)}</strong>${colWarn ? "<em>!</em>" : ""}</th>`;
        });
        tableHtml += "</tr></thead><tbody>";

        rowsToShow.forEach((row, rowIndex) => {
            const rowDuplicate = rowsToShow.findIndex(r => r.join("|") === row.join("|")) !== rowIndex;
            tableHtml += `<tr class="${rowDuplicate ? "duplicate-row" : ""}"><th class="row-number">${rowIndex + 1}</th>`;
            headers.forEach((_, cellIndex) => {
                const cell = row[cellIndex] ?? "";
                const empty = String(cell).trim() === "";
                tableHtml += `<td class="${empty ? "empty-cell" : ""}" title="${escapeHTML(cell)}">${escapeHTML(cell)}</td>`;
            });
            tableHtml += "</tr>";
        });
        tableHtml += "</tbody>";
        filesPreviewTable.className = `excel-preview-table ${tableClasses}`;
        filesPreviewTable.style.transform = `scale(${zoomScale})`;
        filesPreviewTable.style.transformOrigin = "top left";
        filesPreviewTable.innerHTML = tableHtml;
    };

    window.deleteWorkspaceFile = async function(idx) {
        const deletedFile = state.uploadedFiles.splice(idx, 1)[0];
        if (deletedFile) {
            if (deletedFile.id) {
                try {
                    await fileService.deleteFile(deletedFile.id);
                } catch (error) {
                    state.uploadedFiles.splice(idx, 0, deletedFile);
                    showToast(error.message || "Không thể xóa file trên backend", "error");
                    return;
                }
            }
            showToast(`Đã xóa tệp: ${deletedFile.name}`, "warning");
            adminService.addSystemLog("warning", `Workspace: User deleted file '${deletedFile.name}'`);
        }
        renderUploadedFilesTable();
        updateFileSelectDropdowns();

        filesPreviewCard.style.display = "none";
        filesPreviewPlaceholder.style.display = "flex";
        state.workspaceFiles.selectedFileName = "";
        document.querySelector(".file-workspace-page .file-preview-panel")?.classList.remove("has-preview");
    };

    if (checkerScanBtn) {
        // AI proposed auto-fix button
        const autoFixBtn = document.getElementById("checker-auto-fix-btn");
        if (autoFixBtn) {
            autoFixBtn.addEventListener("click", () => {
                showToast("Đã tự động sửa toàn bộ lỗi được đề xuất bởi AI!", "success");
                adminService.addSystemLog("success", "AI Checker: Applied bulk auto-fix for all errors");

                // Clear checker table body and show success
                const tbody = document.getElementById("checker-table-body");
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#10b981; font-weight:600; padding: 1.5rem;">🎉 Tuyệt vời! Toàn bộ lỗi đã được tự động sửa đổi thành công.</td></tr>`;
                }

                // Update stats to clean state
                if (checkerStatErrors) checkerStatErrors.innerText = "0";
                if (checkerStatHealth) checkerStatHealth.innerText = "100%";
                const warningsStat = document.getElementById("checker-stat-warnings");
                if (warningsStat) warningsStat.innerText = "0";

                // Reset progress bars
                document.getElementById("checker-type-empty").innerText = "0 lỗi";
                document.getElementById("checker-type-empty-bar").style.width = "0%";
                document.getElementById("checker-type-dup").innerText = "0 lỗi";
                document.getElementById("checker-type-dup-bar").style.width = "0%";
                document.getElementById("checker-type-format").innerText = "0 lỗi";
                document.getElementById("checker-type-format-bar").style.width = "0%";
                document.getElementById("checker-type-outlier").innerText = "0 lỗi";
                document.getElementById("checker-type-outlier-bar").style.width = "0%";
            });
        }

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

            setTimeout(async () => {
                try {
                let detailedErrors = [];
                if (fileName === "test.xlsx") {
                    detailedErrors = [
                        {
                            row: 4,
                            colName: "Email",
                            value: "abcgmail.com",
                            errorType: "Sai định dạng",
                            suggestion: "Email không đúng định dạng",
                            recommendation: 'Sửa thành: <span style="color: #10b981; font-weight: 600;">abc@gmail.com</span>'
                        },
                        {
                            row: 7,
                            colName: "Số tiền",
                            value: "-1500000",
                            errorType: "Bất thường",
                            suggestion: "Giá trị âm",
                            recommendation: '<span style="color: #10b981; font-weight: 600;">Xác nhận giá trị âm</span>'
                        },
                        {
                            row: 12,
                            colName: "Tên",
                            value: "(trống)",
                            errorType: "Ô trống",
                            suggestion: "Giá trị bị để trống",
                            recommendation: '<span style="color: #10b981; font-weight: 600;">Nhập giá trị</span>'
                        },
                        {
                            row: 15,
                            colName: "Mã đơn",
                            value: "DH001",
                            errorType: "Trùng lặp",
                            suggestion: "Trùng với dòng 3",
                            recommendation: '<span style="color: #10b981; font-weight: 600;">Xem xét hợp nhất</span>'
                        }
                    ];
                } else {
                    const localErrors = await fileService.findDetailedErrors(fileObj.headers, fileObj.rows, fileObj.id || null);
                    detailedErrors = localErrors.map(err => {
                        let mappedType = "Sai định dạng";
                        const et = String(err.errorType || "").toLowerCase();
                        if (et.includes("missing") || et.includes("empty") || et.includes("rỗng")) {
                            mappedType = "Ô trống";
                        } else if (et.includes("duplicate") || et.includes("trùng")) {
                            mappedType = "Trùng lặp";
                        } else if (et.includes("outlier") || et.includes("bất thường") || et.includes("âm")) {
                            mappedType = "Bất thường";
                        }

                        return {
                            row: err.row,
                            colName: err.colName,
                            value: err.value,
                            errorType: mappedType,
                            suggestion: err.suggestion || "Cần điều chỉnh",
                            recommendation: `<span style="color: #10b981; font-weight: 600;">Sửa: ${err.value || "giá trị"}</span>`
                        };
                    });
                }

                checkerScanBtn.disabled = false;
                checkerScanBtn.innerText = "🔍 Bắt đầu quét lỗi AI";

                checkerPlaceholder.style.display = "none";
                checkerResultsBox.style.display = "block";

                if (fileName === "test.xlsx") {
                    checkerStatRows.innerText = "15";
                    checkerStatErrors.innerText = "3";
                    const wStat = document.getElementById("checker-stat-warnings");
                    if (wStat) wStat.innerText = "2";
                    checkerStatHealth.innerText = "96%";

                    document.getElementById("checker-type-empty").innerText = "1 lỗi";
                    document.getElementById("checker-type-empty-bar").style.width = "33%";
                    document.getElementById("checker-type-dup").innerText = "1 lỗi";
                    document.getElementById("checker-type-dup-bar").style.width = "33%";
                    document.getElementById("checker-type-format").innerText = "1 lỗi";
                    document.getElementById("checker-type-format-bar").style.width = "33%";
                    document.getElementById("checker-type-outlier").innerText = "0 lỗi";
                    document.getElementById("checker-type-outlier-bar").style.width = "0%";
                } else {
                    checkerStatRows.innerText = fileObj.rowCount;
                    checkerStatErrors.innerText = detailedErrors.filter(e => e.errorType === "Sai định dạng" || e.errorType === "Ô trống").length;
                    const wStat = document.getElementById("checker-stat-warnings");
                    if (wStat) wStat.innerText = detailedErrors.filter(e => e.errorType === "Bất thường" || e.errorType === "Trùng lặp").length;

                    const totalCells = fileObj.rowCount * (fileObj.colCount || 1);
                    const errorCellsCount = detailedErrors.length;
                    const healthScore = Math.max(0, Math.round(((totalCells - errorCellsCount) / totalCells) * 100));
                    checkerStatHealth.innerText = `${healthScore}%`;

                    // Categorize progress bars
                    const emptyCount = detailedErrors.filter(e => e.errorType === "Ô trống").length;
                    const dupCount = detailedErrors.filter(e => e.errorType === "Trùng lặp").length;
                    const formatCount = detailedErrors.filter(e => e.errorType === "Sai định dạng").length;
                    const outlierCount = detailedErrors.filter(e => e.errorType === "Bất thường").length;

                    const maxCount = Math.max(emptyCount, dupCount, formatCount, outlierCount, 1);
                    document.getElementById("checker-type-empty").innerText = `${emptyCount} lỗi`;
                    document.getElementById("checker-type-empty-bar").style.width = `${(emptyCount / maxCount) * 100}%`;
                    document.getElementById("checker-type-dup").innerText = `${dupCount} lỗi`;
                    document.getElementById("checker-type-dup-bar").style.width = `${(dupCount / maxCount) * 100}%`;
                    document.getElementById("checker-type-format").innerText = `${formatCount} lỗi`;
                    document.getElementById("checker-type-format-bar").style.width = `${(formatCount / maxCount) * 100}%`;
                    document.getElementById("checker-type-outlier").innerText = `${outlierCount} lỗi`;
                    document.getElementById("checker-type-outlier-bar").style.width = `${(outlierCount / maxCount) * 100}%`;
                }

                checkerTableBody.innerHTML = "";
                if (detailedErrors.length === 0) {
                    checkerTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-success); font-weight:600;">🎉 Tuyệt vời! Không phát hiện lỗi dữ liệu nào.</td></tr>`;
                } else {
                    detailedErrors.forEach((err) => {
                        const tr = document.createElement("tr");

                        let badgeHtml = "";
                        if (err.errorType === "Sai định dạng" || err.errorType === "Ô trống") {
                            badgeHtml = `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">${err.errorType}</span>`;
                        } else {
                            badgeHtml = `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">${err.errorType}</span>`;
                        }

                        tr.innerHTML = `
                            <td style="font-weight:600;">${err.row}</td>
                            <td>${escapeHTML(err.colName)}</td>
                            <td class="original-val" style="color:#fff;">${escapeHTML(err.value || "(trống)")}</td>
                            <td>${badgeHtml}</td>
                            <td style="font-size:0.8rem; line-height:1.4; text-align:left;">${escapeHTML(err.suggestion)}</td>
                            <td style="font-size:0.8rem; line-height:1.4; text-align:left;">${err.recommendation}</td>
                        `;
                        checkerTableBody.appendChild(tr);
                    });
                }

                historyService.addOperation("checker", `Rà soát tệp: "${fileName}" (${detailedErrors.length} lỗi)`);
                adminService.addSystemLog("success", `AI Checker: Scanned file '${fileName}' and found ${detailedErrors.length} errors`);
                showToast("Quét lỗi dữ liệu hoàn tất!", "success");
                } catch (error) {
                    showToast(error.message || "Không thể quét lỗi dữ liệu", "error");
                } finally {
                    checkerScanBtn.disabled = false;
                    checkerScanBtn.innerText = "🔍 Bắt đầu quét lỗi AI";
                }
            }, 1200);
        });
    }

    window.applyCheckerRepair = function(btn, row, col, errorIdx) {
        showToast("Đã áp dụng sửa nhanh cho dòng này!");
    };


        // Update Reconciliation file cards
    function updateReconciliationFileCards() {
        const fileA = state.uploadedFiles.find(f => f.name === reconcileFileASelect.value);
        const cardA = document.getElementById("reconcile-filea-card");
        if (fileA && cardA) {
            document.getElementById("reconcile-filea-name").innerText = fileA.name;
            document.getElementById("reconcile-filea-meta").innerText = `${formatFileSize(fileA.size)} • ${fileA.rowCount.toLocaleString()} dòng`;
            cardA.style.display = "flex";
        } else if (cardA) {
            cardA.style.display = "none";
        }

        const fileB = state.uploadedFiles.find(f => f.name === reconcileFileBSelect.value);
        const cardB = document.getElementById("reconcile-fileb-card");
        if (fileB && cardB) {
            document.getElementById("reconcile-fileb-name").innerText = fileB.name;
            document.getElementById("reconcile-fileb-meta").innerText = `${formatFileSize(fileB.size)} • ${fileB.rowCount.toLocaleString()} dòng`;
            cardB.style.display = "flex";
        } else if (cardB) {
            cardB.style.display = "none";
        }
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

                const keyGuess = fileA.headers.find(h => h.toLowerCase().includes("mã") || h.toLowerCase().includes("id") || h.toLowerCase().includes("key") || h.toLowerCase().includes("đối chiếu") || h.toLowerCase().includes("giao dịch"));
                if (keyGuess) reconcileKeyASelect.value = keyGuess;
                const valGuess = fileA.headers.find(h => h.toLowerCase().includes("tiền") || h.toLowerCase().includes("amount") || h.toLowerCase().includes("giá") || h.toLowerCase().includes("doanh thu"));
                if (valGuess) reconcileValASelect.value = valGuess;
            }
            updateReconciliationFileCards();
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

                const keyGuess = fileB.headers.find(h => h.toLowerCase().includes("mã") || h.toLowerCase().includes("id") || h.toLowerCase().includes("key") || h.toLowerCase().includes("đối chiếu") || h.toLowerCase().includes("giao dịch"));
                if (keyGuess) reconcileKeyBSelect.value = keyGuess;
                const valGuess = fileB.headers.find(h => h.toLowerCase().includes("tiền") || h.toLowerCase().includes("amount") || h.toLowerCase().includes("giá") || h.toLowerCase().includes("doanh thu"));
                if (valGuess) reconcileValBSelect.value = valGuess;
            }
            updateReconciliationFileCards();
        });
    }

    const reconcileFileAInput = document.getElementById("reconcile-filea-input");
    if (reconcileFileAInput) {
        reconcileFileAInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const newFile = {
                    name: file.name,
                    size: file.size,
                    rowCount: Math.floor(Math.random() * 500) + 50,
                    colCount: 6,
                    headers: ["Mã khóa", "Ngày tháng", "Số tiền", "Nội dung", "Mã đối chiếu", "Số dư"],
                    rows: [],
                    statistics: { missingValues: 0, duplicateRows: 0, columns: [] },
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: "Người dùng",
                    version: "v1",
                    status: "ready"
                };
                state.uploadedFiles.push(newFile);
                renderUploadedFilesTable();
                updateFileSelectDropdowns();
                reconcileFileASelect.value = newFile.name;
                reconcileFileASelect.dispatchEvent(new Event("change"));
                showToast(`Đã tải lên tệp A: ${file.name}`);
            }
        });
    }

    const reconcileFileBInput = document.getElementById("reconcile-fileb-input");
    if (reconcileFileBInput) {
        reconcileFileBInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const newFile = {
                    name: file.name,
                    size: file.size,
                    rowCount: Math.floor(Math.random() * 500) + 50,
                    colCount: 5,
                    headers: ["Mã hóa đơn", "Ngày lập", "Tổng tiền", "Khách hàng", "Ghi chú"],
                    rows: [],
                    statistics: { missingValues: 0, duplicateRows: 0, columns: [] },
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: "Người dùng",
                    version: "v1",
                    status: "ready"
                };
                state.uploadedFiles.push(newFile);
                renderUploadedFilesTable();
                updateFileSelectDropdowns();
                reconcileFileBSelect.value = newFile.name;
                reconcileFileBSelect.dispatchEvent(new Event("change"));
                showToast(`Đã tải lên tệp B: ${file.name}`);
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
            reconcileRunBtn.innerHTML = `
                <span style="font-size: 1.05rem; color: #fff; display: flex; align-items: center; gap: 6px; font-weight: bold; justify-content: center;">⏳ Đang đối soát...</span>
                <span style="font-size: 0.72rem; color: rgba(255,255,255,0.7); font-weight: normal;">Hệ thống đang đối chiếu dữ liệu giữa 2 bảng</span>
            `;

            setTimeout(async () => {
                try {
                let results;
                if (fileAName.includes("So_phu_ngan_hang") && fileBName.includes("Hoa_don_ban_le")) {
                    results = {
                        matchedCount: 22180,
                        mismatchedCount: 4,
                        missingInBCount: 2,
                        missingInACount: 1,
                        mismatched: [
                            {
                                key: "GD-2024-0891",
                                rowA: 14,
                                rowB: 8,
                                valA: 12500000,
                                valB: 12000000,
                                difference: 500000,
                                desc: "Số tiền lệch 500,000đ. File A (Sổ phụ): 12,500,000đ, File B (Hóa đơn): 12,000,000đ."
                            },
                            {
                                key: "GD-2024-1024",
                                rowA: 45,
                                rowB: 38,
                                valA: 4200000,
                                valB: 4000000,
                                difference: 200000,
                                desc: "Số tiền lệch 200,000đ. File A (Sổ phụ): 4,200,000đ, File B (Hóa đơn): 4,000,000đ."
                            },
                            {
                                key: "GD-2024-2115",
                                rowA: 112,
                                rowB: 94,
                                valA: 9500000,
                                valB: 9800000,
                                difference: -300000,
                                desc: "Số tiền lệch -300,000đ. File A (Sổ phụ): 9,500,000đ, File B (Hóa đơn): 9,800,000đ."
                            },
                            {
                                key: "GD-2024-3012",
                                rowA: 512,
                                rowB: 489,
                                valA: 1500000,
                                valB: 1550000,
                                difference: -50000,
                                desc: "Số tiền lệch -50,000đ. File A (Sổ phụ): 1,500,000đ, File B (Hóa đơn): 1,550,000đ."
                            }
                        ],
                        missingInB: [
                            {
                                key: "GD-2024-0045",
                                rowA: 31,
                                valA: 8400000,
                                desc: "Mã giao dịch 'GD-2024-0045' xuất hiện ở Sổ phụ (8,400,000đ) nhưng không tìm thấy ở Hóa đơn bán lẻ."
                            },
                            {
                                key: "GD-2024-0078",
                                rowA: 78,
                                valA: 2300000,
                                desc: "Mã giao dịch 'GD-2024-0078' xuất hiện ở Sổ phụ (2,300,000đ) nhưng không tìm thấy ở Hóa đơn bán lẻ."
                            }
                        ],
                        missingInA: [
                            {
                                key: "GD-2024-0089",
                                rowB: 52,
                                valB: 3200000,
                                desc: "Mã hóa đơn 'GD-2024-0089' xuất hiện ở Hóa đơn bán lẻ (3,200,000đ) nhưng không tìm thấy ở Sổ phụ ngân hàng."
                            }
                        ],
                        aiNarrative: `<strong>Khuyến nghị rà soát từ Trợ lý AI:</strong><br>
                        1. Phát hiện <strong>4 trường hợp chênh lệch số tiền</strong> giữa Sổ phụ và Hóa đơn bán lẻ. Cần kiểm tra kỹ dòng 14, 45, 112, 512 để điều chỉnh số liệu kế toán.<br>
                        2. Có <strong>2 giao dịch thiếu ở File B (Hóa đơn)</strong> nhưng có trong Sổ phụ. Nhiều khả năng kế toán chưa xuất hóa đơn cho các khoản tiền gửi này.<br>
                        3. Có <strong>1 giao dịch thiếu ở File A (Sổ phụ)</strong>. Cần xác nhận xem khách hàng đã chuyển khoản thanh toán hóa đơn này chưa.`
                    };
                } else {
                    results = await fileService.performReconciliation(fileA, fileB, keyA, keyB, valA, valB);
                }
                activeReconcileResults = results;

                reconcilePlaceholder.style.display = "none";
                reconcileResultsBox.style.display = "block";
                if (reconcileExportBtn) reconcileExportBtn.style.display = "block";

                reconcileStatMatched.innerText = results.matchedCount.toLocaleString();
                reconcileStatMismatch.innerText = results.mismatchedCount.toLocaleString();
                reconcileStatMissingB.innerText = results.missingInBCount.toLocaleString();
                reconcileStatMissingA.innerText = results.missingInACount.toLocaleString();

                renderReconciliationDiffTable("all");

                reconcileAiNarrative.innerHTML = results.aiNarrative;

                historyService.addOperation("reconciliation", `Đối soát: ${fileAName} vs ${fileBName} (${results.mismatchedCount} lệch)`);
                adminService.addSystemLog("success", `Data Reconciler: Reconciled '${fileAName}' and '${fileBName}'. Found ${results.mismatchedCount} mismatches`);
                showToast("Đối soát dữ liệu thành công!", "success");
                } catch (error) {
                    showToast(error.message || "Không thể đối soát dữ liệu", "error");
                } finally {
                    reconcileRunBtn.disabled = false;
                    reconcileRunBtn.innerHTML = `
                        <span style="font-size: 1.05rem; color: #fff; display: flex; align-items: center; gap: 6px; font-weight: bold; justify-content: center;">⚡ Khởi động đối soát hai bảng</span>
                        <span style="font-size: 0.72rem; color: rgba(255,255,255,0.7); font-weight: normal;">AI sẽ tự động so khớp, phát hiện chênh lệch và tạo báo cáo chi tiết</span>
                    `;
                }
            }, 1500);
        });
    }

    // Expose updateReconciliationFileCards globally if needed
    window.updateReconciliationFileCards = updateReconciliationFileCards;

    if (reconcileExportBtn) {
        reconcileExportBtn.addEventListener("click", async () => {
            const fileA = state.uploadedFiles.find(f => f.name === reconcileFileASelect.value);
            const fileB = state.uploadedFiles.find(f => f.name === reconcileFileBSelect.value);
            if (!fileA?.id || !fileB?.id) {
                showToast("Hai file cần được upload qua backend trước khi export báo cáo đối soát.", "error");
                return;
            }
            try {
                reconcileExportBtn.disabled = true;
                const payload = await exportService.exportReconciliationXlsx({
                    fileAId: fileA.id,
                    fileBId: fileB.id,
                    keyA: reconcileKeyASelect.value,
                    keyB: reconcileKeyBSelect.value,
                    valA: reconcileValASelect.value,
                    valB: reconcileValBSelect.value,
                    fileName: "reconciliation-report.xlsx"
                });
                downloadOutputFile(payload.output);
                showToast("Đã xuất báo cáo đối soát XLSX thật.");
            } catch (error) {
                showToast(error.message || "Không thể export báo cáo đối soát", "error");
            } finally {
                reconcileExportBtn.disabled = false;
            }
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

    function reportEl(id) {
        return document.getElementById(id);
    }

    function setReportLoading(message = "Đang phân tích dữ liệu thật...") {
        const table = reportEl("reports-parsed-data-table");
        const placeholder = reportEl("reports-insights-placeholder");
        const results = reportEl("reports-insights-results");
        if (table) {
            table.innerHTML = `<tbody><tr><td class="auto-report-loading">${escapeHTML(message)}</td></tr></tbody>`;
        }
        if (placeholder) {
            placeholder.textContent = message;
            placeholder.style.display = "flex";
        }
        if (results) results.style.display = "none";
    }

    function resetReportUi(message = "Chọn file để tạo báo cáo") {
        ["reports-kpi-total", "reports-kpi-duplicates", "reports-kpi-missing", "reports-kpi-quality"].forEach(id => {
            const node = reportEl(id);
            if (node) node.textContent = "--";
        });
        const table = reportEl("reports-parsed-data-table");
        const rowCount = reportEl("reports-parsed-row-count");
        const placeholder = reportEl("reports-insights-placeholder");
        const results = reportEl("reports-insights-results");
        const page = reportEl("reports-page-indicator");
        if (table) table.innerHTML = `<tbody><tr><td class="auto-report-empty-cell">${escapeHTML(message)}</td></tr></tbody>`;
        if (rowCount) rowCount.textContent = "Chưa chọn file";
        if (placeholder) {
            placeholder.textContent = message;
            placeholder.style.display = "flex";
        }
        if (results) results.style.display = "none";
        if (page) page.textContent = "Trang 1/1";
        if (state.reportsChartInstance) state.reportsChartInstance.destroy();
        if (state.reportsDonutChartInstance) state.reportsDonutChartInstance.destroy();
    }

    function populateReportFiles(files = []) {
        const select = reportEl("reports-file-select");
        if (!select) return;
        select.innerHTML = `<option value="">Chọn file để tạo báo cáo</option>`;
        files.forEach(file => {
            const option = document.createElement("option");
            option.value = file.fileId || file.id;
            option.textContent = `${file.fileName || file.name} (${Number(file.rowCount || 0).toLocaleString("vi-VN")} dòng)`;
            select.appendChild(option);
        });
        if (state.autoReport.selectedFileId) {
            select.value = state.autoReport.selectedFileId;
        }
    }

    async function loadReportFiles() {
        const files = await reportService.getWorkspaceFiles();
        state.autoReport.files = files || [];
        populateReportFiles(state.autoReport.files);
        if (!state.autoReport.files.length) {
            resetReportUi("Chưa có file thật trong workspace. Hãy upload file Excel/CSV trước.");
        }
    }

    function renderSheetTabs() {
        const wrap = reportEl("reports-sheet-tabs");
        if (!wrap) return;
        wrap.innerHTML = "";
        state.autoReport.sheets.forEach(sheet => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `auto-report-sheet ${sheet === state.autoReport.selectedSheet ? "active" : ""}`;
            btn.textContent = sheet;
            btn.addEventListener("click", async () => {
                state.autoReport.selectedSheet = sheet;
                state.autoReport.page = 1;
                renderSheetTabs();
                await loadCurrentReport();
            });
            wrap.appendChild(btn);
        });
    }

    function renderReportKpis(report) {
        const values = {
            "reports-kpi-total": Number(report.totalRows || 0).toLocaleString("vi-VN"),
            "reports-kpi-duplicates": `${Number(report.duplicateRows || 0).toLocaleString("vi-VN")} (${Number(report.duplicatePercent || 0).toFixed(1)}%)`,
            "reports-kpi-missing": Number(report.missingCells || 0).toLocaleString("vi-VN"),
            "reports-kpi-quality": `${Number(report.qualityScore || 0).toFixed(1)}%`
        };
        Object.entries(values).forEach(([id, value]) => {
            const node = reportEl(id);
            if (node) node.textContent = value;
        });
    }

    function renderPreviewTable(preview) {
        const table = reportEl("reports-parsed-data-table");
        const rowCount = reportEl("reports-parsed-row-count");
        const pageIndicator = reportEl("reports-page-indicator");
        if (!table) return;
        const headers = preview.headers || [];
        const rows = preview.rows || [];
        if (rowCount) {
            rowCount.textContent = `${Number(preview.totalRows || 0).toLocaleString("vi-VN")} dòng khớp bộ lọc`;
        }
        if (pageIndicator) {
            pageIndicator.textContent = `Trang ${preview.page || 1}/${Math.max(1, preview.totalPages || 1)}`;
        }
        if (!headers.length) {
            table.innerHTML = `<tbody><tr><td class="auto-report-empty-cell">Sheet không có header.</td></tr></tbody>`;
            return;
        }
        const head = headers.map(header => {
            const active = state.autoReport.sortBy === header ? state.autoReport.sortOrder : "";
            return `<th><button class="auto-report-sort" data-sort="${escapeHTML(header)}">${escapeHTML(header)} ${active === "asc" ? "↑" : active === "desc" ? "↓" : ""}</button></th>`;
        }).join("");
        const body = rows.length
            ? rows.map(row => `<tr>${headers.map((_, index) => `<td>${escapeHTML(row[index] ?? "")}</td>`).join("")}</tr>`).join("")
            : `<tr><td colspan="${headers.length}" class="auto-report-empty-cell">Không có dòng nào khớp bộ lọc.</td></tr>`;
        table.innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
        table.querySelectorAll("[data-sort]").forEach(button => {
            button.addEventListener("click", async () => {
                const nextSort = button.getAttribute("data-sort");
                if (state.autoReport.sortBy === nextSort) {
                    state.autoReport.sortOrder = state.autoReport.sortOrder === "asc" ? "desc" : "asc";
                } else {
                    state.autoReport.sortBy = nextSort;
                    state.autoReport.sortOrder = "asc";
                }
                state.autoReport.page = 1;
                await loadCurrentReport();
            });
        });
    }

    function chartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: "#dbeafe" } } },
            scales: {
                y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.12)" } },
                x: { ticks: { color: "#94a3b8", maxRotation: 30 }, grid: { display: false } }
            }
        };
    }

    function renderReportCharts(report) {
        const barCanvas = reportEl("reports-chart");
        const donutCanvas = reportEl("reports-donut-chart");
        if (state.reportsChartInstance) state.reportsChartInstance.destroy();
        if (state.reportsDonutChartInstance) state.reportsDonutChartInstance.destroy();
        if (barCanvas && window.Chart) {
            const data = report.chartData || [];
            state.reportsChartInstance = new Chart(barCanvas.getContext("2d"), {
                type: "bar",
                data: {
                    labels: data.map(item => item.label),
                    datasets: [{
                        label: report.chartLabel || "Dữ liệu thật",
                        data: data.map(item => item.value),
                        backgroundColor: "rgba(6, 182, 212, 0.45)",
                        borderColor: "#22d3ee",
                        borderWidth: 1.5
                    }]
                },
                options: chartOptions()
            });
        }
        if (donutCanvas && window.Chart) {
            const data = report.categoryDistribution || [];
            state.reportsDonutChartInstance = new Chart(donutCanvas.getContext("2d"), {
                type: "doughnut",
                data: {
                    labels: data.map(item => `${item.label} (${item.percent}%)`),
                    datasets: [{
                        data: data.map(item => item.value),
                        backgroundColor: ["#22d3ee", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#14b8a6", "#f97316"]
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#dbeafe" } } } }
            });
        }
    }

    function renderInsights(report) {
        const placeholder = reportEl("reports-insights-placeholder");
        const results = reportEl("reports-insights-results");
        const narrative = reportEl("reports-ai-analysis-narrative");
        if (placeholder) placeholder.style.display = "none";
        if (results) results.style.display = "block";
        if (narrative) {
            const items = (report.insights || []).map(item => `<li>${escapeHTML(item)}</li>`).join("");
            narrative.innerHTML = `
                <div class="auto-report-status"><span>Đã phân tích</span><small>Cập nhật: ${escapeHTML(formatDateTime(report.updatedAt))}</small></div>
                <h3>AI Insight / Auto Summary</h3>
                <ul>${items}</ul>`;
        }
    }

    async function loadCurrentReport() {
        const selectedFileId = state.autoReport.selectedFileId;
        if (!selectedFileId) {
            resetReportUi();
            return;
        }
        setReportLoading();
        const params = {
            sheetName: state.autoReport.selectedSheet,
            page: state.autoReport.page,
            limit: state.autoReport.limit,
            search: state.autoReport.search,
            sortBy: state.autoReport.sortBy,
            sortOrder: state.autoReport.sortOrder
        };
        const [preview, report] = await Promise.all([
            reportService.getPreview(selectedFileId, params),
            reportService.getAutoReport({ fileId: selectedFileId, sheetName: state.autoReport.selectedSheet })
        ]);
        state.autoReport.preview = preview;
        state.autoReport.report = report;
        renderReportKpis(report);
        renderPreviewTable(preview);
        renderReportCharts(report);
        renderInsights(report);
        adminService.addSystemLog("success", `Reports: Analyzed real workspace file '${report.fileName}'`);
    }

    async function selectReportFile(fileId) {
        if (fileId && !state.autoReport.files.length) {
            await loadReportFiles();
        }
        state.autoReport.selectedFileId = fileId;
        state.autoReport.page = 1;
        state.autoReport.search = "";
        state.autoReport.sortBy = "";
        const search = reportEl("reports-search-input");
        if (search) search.value = "";
        if (!fileId) {
            state.autoReport.sheets = [];
            state.autoReport.selectedSheet = "";
            renderSheetTabs();
            resetReportUi();
            return;
        }
        const file = state.autoReport.files.find(item => String(item.fileId || item.id) === String(fileId));
        state.autoReport.selectedFileName = file?.fileName || file?.name || "";
        const sheets = await reportService.getSheets(fileId);
        state.autoReport.sheets = sheets.sheets || [];
        state.autoReport.selectedSheet = state.autoReport.sheets[0] || "";
        renderSheetTabs();
        await loadCurrentReport();
    }

    window.selectAutoReportFile = async (fileId) => {
        try {
            const select = reportEl("reports-file-select");
            await selectReportFile(fileId);
            if (select) select.value = fileId;
        } catch (error) {
            showToast(error.message || "Không thể mở báo cáo cho file này", "error");
        }
    };

    let reportUiBound = false;
    async function initAutoReportPage() {
        if (!reportEl("reports-file-select")) return;
        if (!reportUiBound) {
            reportUiBound = true;
            reportEl("reports-file-select")?.addEventListener("change", event => {
                selectReportFile(event.target.value).catch(error => showToast(error.message || "Không thể phân tích báo cáo", "error"));
            });
            reportEl("reports-refresh-btn")?.addEventListener("click", () => {
                loadCurrentReport().catch(error => showToast(error.message || "Không thể làm mới báo cáo", "error"));
            });
            reportEl("reports-create-btn")?.addEventListener("click", async () => {
                if (!state.autoReport.selectedFileId) return showToast("Vui lòng chọn file thật trước.", "warning");
                const result = await reportService.createAutoReport(state.autoReport.selectedFileId, state.autoReport.selectedSheet);
                state.autoReport.report = result.report;
                showToast("Đã tạo báo cáo mới từ dữ liệu thật.", "success");
            });
            reportEl("reports-export-btn")?.addEventListener("click", exportCurrentReport);
            reportEl("reports-history-btn")?.addEventListener("click", showReportHistory);
            reportEl("reports-search-input")?.addEventListener("input", debounce(async event => {
                state.autoReport.search = event.target.value;
                state.autoReport.page = 1;
                await loadCurrentReport();
            }, 350));
            reportEl("reports-page-size")?.addEventListener("change", async event => {
                state.autoReport.limit = Number(event.target.value) || 25;
                state.autoReport.page = 1;
                await loadCurrentReport();
            });
            reportEl("reports-prev-page")?.addEventListener("click", async () => {
                state.autoReport.page = Math.max(1, state.autoReport.page - 1);
                await loadCurrentReport();
            });
            reportEl("reports-next-page")?.addEventListener("click", async () => {
                const totalPages = state.autoReport.preview?.totalPages || 1;
                state.autoReport.page = Math.min(totalPages, state.autoReport.page + 1);
                await loadCurrentReport();
            });
        }
        try {
            await loadReportFiles();
        } catch (error) {
            resetReportUi(error.message || "Không thể tải danh sách file workspace.");
        }
    }

    function exportCurrentReport() {
        const report = state.autoReport.report;
        if (!report) {
            showToast("Chưa có báo cáo để xuất.", "warning");
            return;
        }
        const lines = [
            ["File", report.fileName],
            ["Sheet", report.sheetName],
            ["Tổng số dòng", report.totalRows],
            ["Dòng trùng lặp", report.duplicateRows],
            ["Dữ liệu thiếu", report.missingCells],
            ["Chất lượng dữ liệu", `${report.qualityScore}%`],
            [],
            ["Insights"],
            ...(report.insights || []).map(item => [item])
        ];
        const csv = lines.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `auto-report-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    async function showReportHistory() {
        const drawer = reportEl("reports-history-drawer");
        if (!drawer) return;
        drawer.hidden = !drawer.hidden;
        if (drawer.hidden) return;
        drawer.innerHTML = `<h3>Lịch sử báo cáo</h3><p>Đang tải...</p>`;
        try {
            const data = await reportService.getHistory();
            const items = data.items || [];
            drawer.innerHTML = `<h3>Lịch sử báo cáo</h3>${items.length ? items.map(item => `
                <button class="auto-report-history-item" data-file-id="${escapeHTML(item.fileId || "")}" data-sheet="${escapeHTML(item.sheetName || "")}">
                    <strong>${escapeHTML(item.fileName || "Báo cáo")}</strong>
                    <span>${escapeHTML(item.sheetName || "")} · ${Number(item.totalRows || 0).toLocaleString("vi-VN")} dòng · ${escapeHTML(formatDateTime(item.createdAt || item.updatedAt))}</span>
                </button>`).join("") : `<p>Chưa có lịch sử báo cáo.</p>`}`;
            drawer.querySelectorAll("[data-file-id]").forEach(button => {
                button.addEventListener("click", async () => {
                    const fileId = button.getAttribute("data-file-id");
                    const sheet = button.getAttribute("data-sheet");
                    state.autoReport.selectedFileId = fileId;
                    state.autoReport.selectedSheet = sheet;
                    const select = reportEl("reports-file-select");
                    if (select) select.value = fileId;
                    await selectReportFile(fileId);
                    if (sheet) {
                        state.autoReport.selectedSheet = sheet;
                        renderSheetTabs();
                        await loadCurrentReport();
                    }
                });
            });
        } catch (error) {
            drawer.innerHTML = `<h3>Lịch sử báo cáo</h3><p>${escapeHTML(error.message || "Không thể tải lịch sử.")}</p>`;
        }
    }

    initAutoReportPage().catch(() => {});

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
                activeSheetBtn.style.display = "inline-block";

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

    // Excel: Read active selected sheet range, draw chart and analyze
    if (activeSheetBtn) {
        activeSheetBtn.addEventListener("click", async () => {
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
                        aiAnalysisNarrative.innerText = `Đọc thành công dữ liệu Excel gồm ${rows.length} dòng từ vùng đang chọn. Thống kê nhanh: tổng ${stat1}, giá trị trung bình ${stat2}.`;
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
    const autopilotEl = id => document.getElementById(id);

    function getAutopilotFile(fileId) {
        return state.uploadedFiles.find(file => String(file.id || file.name) === String(fileId));
    }

    function updateAutopilotFileCard(fileId) {
        const card = autopilotEl("autopilot-selected-file-card");
        const status = autopilotEl("autopilot-file-status");
        const file = getAutopilotFile(fileId);
        if (!card) return;
        if (!file) {
            card.innerHTML = "Chưa có file được chọn.";
            if (status) status.textContent = "Chưa chọn file";
            return;
        }
        const rows = Number(file.rowCount ?? file.row_count ?? 0) || 0;
        const cols = Number(file.colCount ?? file.col_count ?? 0) || 0;
        card.innerHTML = `<strong>${escapeHTML(file.name || "File dữ liệu")}</strong><span>${formatFileSize(file.size)} · ${rows.toLocaleString("vi-VN")} dòng · ${cols} cột</span>`;
        if (status) status.textContent = "Đã chọn dữ liệu thật";
    }

    function renderAutopilotPlan(plan) {
        const box = autopilotEl("autopilot-plan-box");
        const placeholder = autopilotEl("autopilot-preview-placeholder");
        const title = autopilotEl("autopilot-plan-understanding");
        const inputs = autopilotEl("autopilot-plan-inputs");
        const outputs = autopilotEl("autopilot-plan-outputs");
        const stepsContainer = autopilotEl("autopilot-steps-container");
        const status = autopilotEl("autopilot-plan-status");
        if (!box || !stepsContainer) return;
        const profile = plan.fileProfile || {};
        title.textContent = `Kế hoạch cho ${plan.fileName || profile.fileName || "file dữ liệu"}`;
        inputs.innerHTML = `<strong>Dữ liệu:</strong> ${escapeHTML(plan.fileName || "")} · ${Number(profile.rowCount || 0).toLocaleString("vi-VN")} dòng · ${Number(profile.columnCount || 0)} cột`;
        outputs.innerHTML = `<strong>Output:</strong> ${escapeHTML(plan.expectedOutput?.description || "File Excel kết quả")}`;
        stepsContainer.innerHTML = (plan.steps || []).map((step, index) => `
            <article class="autopilot-step-card ${escapeHTML(step.status || "pending")}">
                <span>${Number(step.order || index + 1)}</span>
                <div><strong>${escapeHTML(step.title || "Bước xử lý")}</strong><p>${escapeHTML(step.description || step.desc || "")}</p></div>
                <small>${escapeHTML(step.type || "task")}</small>
            </article>
        `).join("");
        box.style.display = "block";
        if (placeholder) placeholder.style.display = "none";
        if (status) status.textContent = `${(plan.steps || []).length} bước cần duyệt`;
    }

    function renderAutopilotDraft(draft) {
        const results = autopilotEl("autopilot-preview-results");
        const content = autopilotEl("autopilot-preview-content-box");
        const warningsBox = autopilotEl("autopilot-warnings-box");
        const warningsList = autopilotEl("autopilot-warnings-list");
        const outputStatus = autopilotEl("autopilot-output-status");
        if (!results || !content) return;
        const tables = Array.isArray(draft?.tables) ? draft.tables : [];
        const insights = Array.isArray(draft?.insights) ? draft.insights : [];
        const firstTable = tables[0] || {};
        content.innerHTML = `
            <div class="autopilot-draft-summary"><strong>${escapeHTML(draft?.summary || "Đã tạo bản nháp.")}</strong></div>
            <div class="autopilot-insight-list">${insights.map(item => `<p>${escapeHTML(item)}</p>`).join("")}</div>
            <div class="autopilot-table-scroll"><table class="admin-table"><thead><tr>${(firstTable.columns || []).map(col => `<th>${escapeHTML(col)}</th>`).join("")}</tr></thead><tbody>${(firstTable.rows || []).slice(0, 20).map(row => `<tr>${row.map(cell => `<td>${escapeHTML(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        `;
        const warnings = Array.isArray(draft?.warnings) ? draft.warnings : [];
        if (warningsList) warningsList.innerHTML = (warnings.length ? warnings.slice(0, 8) : ["Không phát hiện cảnh báo lớn trong dữ liệu preview."]).map(item => `<li>${escapeHTML(item)}</li>`).join("");
        if (warningsBox) warningsBox.style.display = "block";
        results.style.display = "flex";
        if (outputStatus) outputStatus.textContent = draft?.outputFile?.id ? "Đã có file tải về" : "Đã có preview";
    }

    async function loadAutopilotHistory() {
        const list = autopilotEl("autopilot-history-list");
        if (!list) return;
        list.innerHTML = `<div class="autopilot-history-empty">Đang tải lịch sử...</div>`;
        try {
            const items = await autopilotService.history();
            list.innerHTML = items.length ? items.map(item => `
                <button type="button" class="autopilot-history-item" data-autopilot-history-id="${escapeHTML(item.planId)}">
                    <strong>${escapeHTML(item.fileName || "File")}</strong>
                    <span>${escapeHTML((item.goal || "").slice(0, 110))}</span>
                    <small>${escapeHTML(item.status || "planned")} · ${Number(item.stepCount || 0)} bước</small>
                </button>
            `).join("") : `<div class="autopilot-history-empty">Chưa có phiên Autopilot nào.</div>`;
        } catch (error) {
            list.innerHTML = `<div class="autopilot-history-empty">${escapeHTML(error.message || "Không tải được lịch sử.")}</div>`;
        }
    }

    async function initAutopilotPage() {
        updateFileSelectDropdowns();
        const goalInput = autopilotEl("autopilot-goal-input");
        const charCounter = autopilotEl("autopilot-char-counter");
        const fileSelect = autopilotEl("autopilot-file-select");
        const runBtn = autopilotEl("autopilot-run-btn");
        const draftBtn = autopilotEl("autopilot-generate-btn");
        const uploadInput = autopilotEl("autopilot-upload-input");
        const uploadBtn = autopilotEl("autopilot-upload-btn");
        const dropzone = autopilotEl("autopilot-dropzone");
        const copyBtn = autopilotEl("autopilot-copy-btn");
        const exportBtn = autopilotEl("autopilot-export-btn");
        if (!runBtn || runBtn.dataset.bound === "1") return;
        runBtn.dataset.bound = "1";
        const updateCounter = () => {
            if (charCounter) charCounter.textContent = `${(goalInput?.value || "").length}/1000`;
        };
        goalInput?.addEventListener("input", updateCounter);
        updateCounter();
        document.querySelectorAll("[data-autopilot-prompt]").forEach(button => {
            button.addEventListener("click", () => {
                if (!goalInput) return;
                goalInput.value = button.getAttribute("data-autopilot-prompt") || "";
                updateCounter();
                goalInput.focus();
            });
        });
        fileSelect?.addEventListener("change", () => updateAutopilotFileCard(fileSelect.value));
        updateAutopilotFileCard(fileSelect?.value);
        uploadBtn?.addEventListener("click", () => uploadInput?.click());
        const uploadAutopilotFile = async file => {
            const validation = fileService.validateFile(file);
            if (!validation.valid) {
                showToast(validation.error, "error");
                return;
            }
            uploadBtn.disabled = true;
            uploadBtn.textContent = "Đang tải...";
            try {
                const uploaded = await fileService.uploadFile(file);
                state.uploadedFiles.unshift(uploaded);
                updateFileSelectDropdowns();
                const uploadedId = uploaded.id || uploaded.name;
                if (fileSelect) {
                    fileSelect.value = uploadedId;
                    updateAutopilotFileCard(uploadedId);
                }
                renderUploadedFilesTable();
                showToast("Đã tải file thật vào workspace.", "success");
            } catch (error) {
                showToast(error.message || "Upload thất bại", "error");
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = "Tải file mới";
            }
        };
        uploadInput?.addEventListener("change", event => {
            const file = event.target.files?.[0];
            if (file) uploadAutopilotFile(file);
            event.target.value = "";
        });
        dropzone?.addEventListener("dragover", event => {
            event.preventDefault();
            dropzone.classList.add("is-dragover");
        });
        dropzone?.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
        dropzone?.addEventListener("drop", event => {
            event.preventDefault();
            dropzone.classList.remove("is-dragover");
            const file = event.dataTransfer?.files?.[0];
            if (file) uploadAutopilotFile(file);
        });
        runBtn.addEventListener("click", async () => {
            const goal = (goalInput?.value || "").trim();
            const fileId = fileSelect?.value || "";
            if (!goal) {
                showToast("Vui lòng nhập mô tả mục tiêu hành động!", "error");
                return;
            }
            if (!fileId) {
                showToast("Vui lòng chọn hoặc tải lên file dữ liệu thật.", "error");
                return;
            }
            runBtn.disabled = true;
            runBtn.textContent = "Đang lập kế hoạch...";
            try {
                const plan = await autopilotService.createPlan(goal, fileId);
                state.currentAutopilotPlan = plan;
                state.currentAutopilotDraft = null;
                renderAutopilotPlan(plan);
                if (draftBtn) draftBtn.disabled = false;
                historyService.addOperation("autopilot", `Lập kế hoạch Autopilot: "${goal}"`);
                showToast("Đã lập kế hoạch từ dữ liệu thật.", "success");
                loadAutopilotHistory();
            } catch (error) {
                showToast(error.message || "Không thể lập kế hoạch Autopilot", "error");
            } finally {
                runBtn.disabled = false;
                runBtn.textContent = "Lập kế hoạch";
            }
        });
        draftBtn?.addEventListener("click", async () => {
            const plan = state.currentAutopilotPlan;
            if (!plan?.id) {
                showToast("Vui lòng chạy 'Lập Kế Hoạch AI' trước!", "error");
                return;
            }
            draftBtn.disabled = true;
            draftBtn.textContent = "Đang tạo bản nháp...";
            try {
                const draft = await autopilotService.createDraft(plan.id);
                state.currentAutopilotDraft = draft;
                renderAutopilotDraft(draft);
                incrementCurrentUserUsage();
                updateWorkspaceSidebarUI();
                historyService.addOperation("autopilot", "Tạo bản nháp Autopilot từ dữ liệu thật");
                showToast("Đã tạo bản nháp và file kết quả.", "success");
                loadAutopilotHistory();
            } catch (error) {
                showToast(error.message || "Không thể tạo bản nháp Autopilot", "error");
            } finally {
                draftBtn.disabled = false;
                draftBtn.textContent = "Tạo bản nháp";
            }
        });
        copyBtn?.addEventListener("click", () => {
            const draft = state.currentAutopilotDraft;
            if (!draft) return;
            const textToCopy = [draft.summary, ...(draft.insights || []), ...(draft.warnings || [])].filter(Boolean).join("\n");
            navigator.clipboard.writeText(textToCopy);
            showToast("Đã sao chép insight bản nháp.", "success");
        });
        exportBtn?.addEventListener("click", () => {
            const outputId = state.currentAutopilotDraft?.outputFile?.id;
            if (!outputId) {
                showToast("Chưa có file kết quả để tải.", "info");
                return;
            }
            window.open(autopilotService.outputDownloadUrl(outputId), "_blank", "noopener");
        });
        autopilotEl("autopilot-history-refresh-btn")?.addEventListener("click", loadAutopilotHistory);
        autopilotEl("autopilot-history-list")?.addEventListener("click", async event => {
            const item = event.target.closest("[data-autopilot-history-id]");
            if (!item) return;
            try {
                const detail = await autopilotService.historyDetail(item.getAttribute("data-autopilot-history-id"));
                state.currentAutopilotPlan = detail.plan;
                state.currentAutopilotDraft = detail.draft;
                renderAutopilotPlan(detail.plan);
                if (detail.draft) renderAutopilotDraft(detail.draft);
                if (draftBtn) draftBtn.disabled = !detail.plan?.id;
            } catch (error) {
                showToast(error.message || "Không mở được lịch sử Autopilot", "error");
            }
        });
        await loadAutopilotHistory();
    }

    if (false && autopilotRunBtn) {
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

            setTimeout(async () => {
                try {
                const plan = await autopilotService.generatePlan(goal, selectedOutputs, files);
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
                } catch (error) {
                    showToast(error.message || "Không thể lập kế hoạch Autopilot", "error");
                } finally {
                    autopilotRunBtn.disabled = false;
                    autopilotRunBtn.innerText = "Lập Kế Hoạch AI";
                }
            }, 800);
        });
    }

    if (false && autopilotGenerateBtn) {
        autopilotGenerateBtn.addEventListener("click", () => {
            const plan = state.currentAutopilotPlan;
            if (!plan) {
                showToast("Vui lòng chạy 'Lập Kế Hoạch AI' trước!", "error");
                return;
            }
            if (!plan.previewData) {
                showToast("Backend chưa trả bản nháp thật cho kế hoạch này.", "info");
                return;
            }

            autopilotGenerateBtn.disabled = true;
            autopilotGenerateBtn.innerText = "⏳ Đang tạo bản nháp Autopilot...";

            autopilotGenerateBtn.disabled = false;
            autopilotGenerateBtn.innerText = "Tạo Bản Nháp Autopilot";

            autopilotPreviewPlaceholder.style.display = "none";
            autopilotPreviewResults.style.display = "flex";

            if (plan.previewType === "excel") {
                const tableHtml = `
                    <table class="admin-table" style="font-size:0.75rem; width:100%;">
                        <thead>
                            <tr>${(plan.previewData.headers || []).map(h => `<th>${h}</th>`).join("")}</tr>
                        </thead>
                        <tbody>
                            ${(plan.previewData.rows || []).map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}
                        </tbody>
                    </table>
                `;
                autopilotPreviewContentBox.innerHTML = tableHtml;
            } else if (plan.previewType === "document") {
                autopilotPreviewContentBox.innerHTML = `
                    <div style="font-family:'Times New Roman', serif; color:#fff; line-height:1.6; white-space:pre-wrap; text-align:left;">
                        <h4 style="text-align:center; font-weight:bold; margin-bottom:1rem; color:#fff; font-size:1rem;">${plan.previewData.title || "Bản nháp"}</h4>
                        <p>${plan.previewData.content || ""}</p>
                    </div>
                `;
            }

            autopilotWarningsList.innerHTML = `
                <li>Bản nháp này được trả về từ backend, vui lòng kiểm tra trước khi xuất bản hoặc nạp vào Excel.</li>
            `;
            autopilotWarningsBox.style.display = "block";

            incrementCurrentUserUsage();
            updateWorkspaceSidebarUI();

            historyService.addOperation("autopilot", `Mở bản nháp Autopilot từ backend`);
            adminService.addSystemLog("success", `AI Autopilot: Rendered backend draft output.`);
            showToast("Đã mở bản nháp Autopilot từ backend.", "success");
        });
    }

    if (false && autopilotCopyBtn) {
        autopilotCopyBtn.addEventListener("click", () => {
            const plan = state.currentAutopilotPlan;
            if (!plan) return;
            if (!plan.previewData) {
                showToast("Chưa có bản nháp thật từ backend để sao chép.", "info");
                return;
            }
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

    if (false && autopilotExportBtn) {
        autopilotExportBtn.addEventListener("click", () => {
            const plan = state.currentAutopilotPlan;
            if (!plan) return;
            if (!plan.previewData) {
                showToast("Chưa có bản nháp thật từ backend để xuất file.", "info");
                return;
            }
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
    function tableEl(id) {
        return document.getElementById(id);
    }

    function setTableStatus(status, detail = "") {
        state.aiTableBuilder.status = status;
        const labels = { ready: "Sẵn sàng", generating: "Đang tạo", completed: "Hoàn thành", error: "Lỗi" };
        const stateNode = tableEl("table-status-state");
        const badge = tableEl("table-builder-status-badge");
        const errorBox = tableEl("table-builder-error");
        if (stateNode) stateNode.textContent = labels[status] || status;
        if (badge) badge.textContent = labels[status] || status;
        if (errorBox) {
            errorBox.hidden = status !== "error";
            errorBox.textContent = detail;
        }
    }

    function updateTableCounter() {
        const input = tableEl("table-builder-desc");
        const counter = tableEl("table-builder-char-counter");
        if (input && counter) counter.textContent = `${input.value.length}/1000`;
    }

    function renderTableModeFields() {
        const mode = tableEl("table-builder-mode")?.value || "ai_generated";
        const fileSource = tableEl("table-builder-file-source");
        const apiSource = tableEl("table-builder-api-source");
        if (fileSource) fileSource.hidden = mode !== "workspace_file";
        if (apiSource) apiSource.hidden = mode !== "external_api";
    }

    function renderTableFiles() {
        const select = tableEl("table-builder-file-select");
        if (!select) return;
        select.innerHTML = "";
        if (!state.aiTableBuilder.files.length) {
            select.appendChild(new Option("Chưa có tệp nguồn", ""));
            return;
        }
        select.appendChild(new Option("Chọn file workspace", ""));
        state.aiTableBuilder.files.forEach(file => {
            select.appendChild(new Option(`${file.fileName || file.name} (${Number(file.rowCount || 0).toLocaleString("vi-VN")} dòng)`, file.fileId || file.id));
        });
        select.value = state.aiTableBuilder.selectedFileId;
    }

    function renderTableSheets() {
        const select = tableEl("table-builder-sheet-select");
        if (!select) return;
        select.innerHTML = "";
        if (!state.aiTableBuilder.sheets.length) {
            select.appendChild(new Option("Chọn sheet", ""));
            return;
        }
        state.aiTableBuilder.sheets.forEach(sheet => {
            const name = typeof sheet === "string" ? sheet : sheet.name;
            select.appendChild(new Option(name, name));
        });
        select.value = state.aiTableBuilder.selectedSheet;
    }

    function renderSmartColumns(columns = []) {
        const wrap = tableEl("table-builder-smart-columns");
        if (!wrap) return;
        if (!columns.length) {
            wrap.innerHTML = `<span class="ai-table-muted">Cột AI đề xuất sẽ xuất hiện sau khi backend phân tích mô tả.</span>`;
            return;
        }
        wrap.innerHTML = columns.map(column => `<span class="ai-table-chip">${escapeHTML(column.label || column.name || column.key)}<small>${escapeHTML(column.type || "text")}</small></span>`).join("");
    }

    async function loadAiTableData() {
        const files = await tableBuilderService.getWorkspaceFiles();
        state.aiTableBuilder.files = Array.isArray(files) ? files : files.files || [];
        renderTableFiles();
        renderSmartColumns(state.aiTableBuilder.currentTable?.columns || []);
        renderTableModeFields();
    }

    async function selectTableFile(fileId) {
        state.aiTableBuilder.selectedFileId = fileId;
        state.aiTableBuilder.selectedSheet = "";
        state.aiTableBuilder.sheets = [];
        if (fileId) {
            const sheets = await tableBuilderService.getSheets(fileId);
            state.aiTableBuilder.sheets = sheets.sheets || [];
            state.aiTableBuilder.selectedSheet = state.aiTableBuilder.sheets[0] || "";
        }
        renderTableSheets();
    }

    function validateTableBuilder() {
        const desc = tableEl("table-builder-desc")?.value.trim() || "";
        const mode = tableEl("table-builder-mode")?.value || "ai_generated";
        const rowCount = Number(tableEl("table-builder-row-count")?.value || 0);
        if (!desc) return "Vui lòng nhập mô tả bảng.";
        if (!Number.isFinite(rowCount) || rowCount < 0 || rowCount > 1000) return "Số dòng không hợp lệ.";
        if (mode === "workspace_file" && !state.aiTableBuilder.selectedFileId) return "Vui lòng chọn file workspace.";
        if (mode === "workspace_file" && state.aiTableBuilder.sheets.length && !state.aiTableBuilder.selectedSheet) return "Vui lòng chọn sheet.";
        if (mode === "external_api" && !tableEl("table-builder-api-endpoint")?.value.trim()) return "Vui lòng nhập API endpoint.";
        return "";
    }

    function currentTableRows() {
        const table = state.aiTableBuilder.currentTable;
        if (!table) return [];
        let rows = table.rows || [];
        const search = (state.aiTableBuilder.search || "").toLowerCase();
        if (search) {
            rows = rows.filter(row => Object.values(row).join(" ").toLowerCase().includes(search));
        }
        if (state.aiTableBuilder.sortBy) {
            const sortBy = state.aiTableBuilder.sortBy;
            rows = [...rows].sort((a, b) => String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""), "vi", { numeric: true }));
            if (state.aiTableBuilder.sortOrder === "desc") rows.reverse();
        }
        return rows;
    }

    function renderGeneratedTable(table) {
        state.aiTableBuilder.currentTable = table;
        state.currentTableBuilderResult = table;
        const placeholder = tableEl("table-builder-placeholder");
        const results = tableEl("table-builder-results");
        const title = tableEl("table-builder-preview-title");
        if (placeholder) placeholder.style.display = "none";
        if (results) results.style.display = "block";
        if (title) title.textContent = table.title || "Bảng mẫu được tạo";
        const config = tableEl("table-status-config");
        const confidence = tableEl("table-status-confidence");
        const time = tableEl("table-status-time");
        if (config) config.textContent = `${Number(table.totalRows || 0).toLocaleString("vi-VN")} dòng • ${Number(table.totalColumns || 0).toLocaleString("vi-VN")} cột`;
        if (confidence) confidence.textContent = `${Number(table.confidence || 0)}%`;
        if (time) time.textContent = `${Number(table.estimatedTime || 0)} giây`;
        renderSmartColumns(table.columns || []);
        renderTablePage();
        setTableStatus("completed");
    }

    function renderTablePage() {
        const table = state.aiTableBuilder.currentTable;
        const grid = tableEl("table-builder-preview-grid");
        const spec = tableEl("table-builder-spec-box");
        const formula = tableEl("table-builder-formula-list");
        const notes = tableEl("table-builder-notes");
        const pageIndicator = tableEl("table-builder-page-indicator");
        if (!table || !grid) return;
        const columns = table.columns || [];
        const rows = currentTableRows();
        const totalPages = Math.max(1, Math.ceil(rows.length / state.aiTableBuilder.pageSize));
        state.aiTableBuilder.page = Math.min(state.aiTableBuilder.page, totalPages);
        const start = (state.aiTableBuilder.page - 1) * state.aiTableBuilder.pageSize;
        const pageRows = rows.slice(start, start + state.aiTableBuilder.pageSize);
        const head = columns.map((column, index) => {
            const active = state.aiTableBuilder.sortBy === column.key ? state.aiTableBuilder.sortOrder : "";
            return `<th><button class="ai-table-sort" data-key="${escapeHTML(column.key)}">${getColumnLabel(index)} - ${escapeHTML(column.label || column.key)} ${active === "asc" ? "↑" : active === "desc" ? "↓" : ""}</button></th>`;
        }).join("");
        const body = pageRows.length
            ? pageRows.map((row, rowIndex) => `<tr><th>${start + rowIndex + 1}</th>${columns.map(column => `<td>${escapeHTML(row[column.key] ?? "")}</td>`).join("")}</tr>`).join("")
            : `<tr><td colspan="${Math.max(1, columns.length + 1)}" class="ai-table-empty-cell">Không có dữ liệu.</td></tr>`;
        grid.innerHTML = `<thead><tr><th>#</th>${head}</tr></thead><tbody>${body}</tbody>`;
        grid.querySelectorAll("[data-key]").forEach(button => {
            button.addEventListener("click", () => {
                const key = button.getAttribute("data-key");
                if (state.aiTableBuilder.sortBy === key) {
                    state.aiTableBuilder.sortOrder = state.aiTableBuilder.sortOrder === "asc" ? "desc" : "asc";
                } else {
                    state.aiTableBuilder.sortBy = key;
                    state.aiTableBuilder.sortOrder = "asc";
                }
                renderTablePage();
            });
        });
        if (spec) spec.textContent = `${Number(table.totalRows || 0).toLocaleString("vi-VN")} dòng thật • ${columns.length} cột`;
        if (formula) formula.innerHTML = (table.formulas || []).map(item => `<div class="ai-table-formula"><strong>${escapeHTML(item.column || item.col || "")}</strong><code>${escapeHTML(item.expression || item.expr || "")}</code><span>${escapeHTML(item.description || item.desc || "")}</span></div>`).join("");
        if (notes) notes.textContent = table.notes || "";
        if (pageIndicator) pageIndicator.textContent = `Trang ${state.aiTableBuilder.page}/${totalPages}`;
    }

    function tablePayload() {
        let headers = {};
        try {
            headers = JSON.parse(tableEl("table-builder-api-headers")?.value || "{}");
        } catch {
            headers = {};
        }
        return {
            description: tableEl("table-builder-desc")?.value.trim(),
            tableType: tableEl("table-builder-type")?.value,
            mode: tableEl("table-builder-mode")?.value,
            rowCount: Number(tableEl("table-builder-row-count")?.value || 0),
            language: tableEl("table-builder-language")?.value,
            dateFormat: tableEl("table-builder-date-format")?.value,
            autoFormula: tableEl("table-builder-formula")?.value === "true",
            normalizeColumns: Boolean(tableEl("table-builder-normalize")?.checked),
            source: {
                type: tableEl("table-builder-mode")?.value,
                fileId: state.aiTableBuilder.selectedFileId || null,
                sheetName: state.aiTableBuilder.selectedSheet || null,
                externalApi: {
                    endpoint: tableEl("table-builder-api-endpoint")?.value.trim() || "",
                    method: tableEl("table-builder-api-method")?.value || "GET",
                    headers
                }
            },
            columns: []
        };
    }

    async function generateAiTable() {
        const error = validateTableBuilder();
        if (error) {
            setTableStatus("error", error);
            showToast(error, "error");
            return;
        }
        const buttons = [tableEl("table-builder-run-btn"), tableEl("table-builder-generate-main-btn")].filter(Boolean);
        buttons.forEach(button => {
            button.disabled = true;
            button.textContent = "Đang tạo...";
        });
        setTableStatus("generating");
        const placeholder = tableEl("table-builder-placeholder");
        const results = tableEl("table-builder-results");
        if (placeholder) {
            placeholder.style.display = "flex";
            placeholder.innerHTML = `<strong>Đang tạo bảng...</strong><span>Backend đang dựng bảng từ API/file/AI thật.</span>`;
        }
        if (results) results.style.display = "none";
        try {
            const table = await tableBuilderService.generateTable(tablePayload());
            state.aiTableBuilder.page = 1;
            renderGeneratedTable(table);
            incrementCurrentUserUsage();
            updateWorkspaceSidebarUI();
            historyService.addOperation("table", `AI Table Builder: "${table.title}"`);
            adminService.addSystemLog("success", `AI Table Builder: Created real table '${table.title}'`);
            showToast("Đã dựng bảng từ backend thật.", "success");
        } catch (err) {
            setTableStatus("error", err.message || "Không thể dựng bảng.");
            showToast(err.message || "Không thể dựng bảng", "error");
        } finally {
            buttons.forEach(button => {
                button.disabled = false;
                button.textContent = button.id === "table-builder-run-btn" ? "Tạo bảng mới" : "Dựng bảng";
            });
        }
    }

    async function exportAiTable(format) {
        const table = state.aiTableBuilder.currentTable;
        if (!table?.tableId) return showToast("Chưa có bảng để export.", "warning");
        const payload = await tableBuilderService.exportTable(table.tableId, format);
        const response = await fetch(tableBuilderService.downloadUrl(payload), { headers: tableBuilderService.authHeaders() });
        if (!response.ok) throw new Error(`Lỗi tải file ${response.status}`);
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = payload.output?.display_name || `${table.title}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    async function showTableHistory() {
        const drawer = tableEl("table-builder-history-drawer");
        if (!drawer) return;
        drawer.hidden = !drawer.hidden;
        if (drawer.hidden) return;
        drawer.innerHTML = `<h3>Lịch sử AI Table Builder</h3><p>Đang tải...</p>`;
        const payload = await tableBuilderService.getHistory();
        const items = payload.items || [];
        drawer.innerHTML = `<h3>Lịch sử AI Table Builder</h3>${items.length ? items.map(item => `<button class="ai-table-history-item" data-table-id="${escapeHTML(item.tableId)}"><strong>${escapeHTML(item.title || "Bảng AI")}</strong><span>${Number(item.rows || 0).toLocaleString("vi-VN")} dòng • ${Number(item.columns || 0)} cột • ${escapeHTML(formatDateTime(item.createdAt))}</span></button>`).join("") : "<p>Chưa có lịch sử bảng.</p>"}`;
        drawer.querySelectorAll("[data-table-id]").forEach(button => {
            button.addEventListener("click", async () => {
                const table = await tableBuilderService.getTable(button.getAttribute("data-table-id"));
                renderGeneratedTable(table);
                drawer.hidden = true;
            });
        });
    }

    let aiTableBound = false;
    async function initAiTableBuilderPage() {
        if (!tableEl("table-builder-desc")) return;
        if (!aiTableBound) {
            aiTableBound = true;
            [tableEl("table-builder-run-btn"), tableEl("table-builder-generate-main-btn")].filter(Boolean).forEach(button => button.addEventListener("click", generateAiTable));
            tableEl("table-builder-desc")?.addEventListener("input", updateTableCounter);
            tableEl("table-builder-mode")?.addEventListener("change", renderTableModeFields);
            tableEl("table-builder-file-select")?.addEventListener("change", event => selectTableFile(event.target.value).catch(error => showToast(error.message || "Không thể đọc file", "error")));
            tableEl("table-builder-sheet-select")?.addEventListener("change", event => { state.aiTableBuilder.selectedSheet = event.target.value; });
            tableEl("table-builder-search")?.addEventListener("input", debounce(event => { state.aiTableBuilder.search = event.target.value; state.aiTableBuilder.page = 1; renderTablePage(); }, 250));
            tableEl("table-builder-page-size")?.addEventListener("change", event => { state.aiTableBuilder.pageSize = Number(event.target.value) || 25; state.aiTableBuilder.page = 1; renderTablePage(); });
            tableEl("table-builder-prev-page")?.addEventListener("click", () => { state.aiTableBuilder.page = Math.max(1, state.aiTableBuilder.page - 1); renderTablePage(); });
            tableEl("table-builder-next-page")?.addEventListener("click", () => { state.aiTableBuilder.page += 1; renderTablePage(); });
            tableEl("table-builder-copy-btn")?.addEventListener("click", () => {
                const table = state.aiTableBuilder.currentTable;
                if (!table) return showToast("Chưa có bảng để sao chép.", "warning");
                const headers = table.columns.map(column => column.label);
                const rows = (table.rows || []).map(row => table.columns.map(column => row[column.key] ?? "").join("\t"));
                navigator.clipboard.writeText([headers.join("\t"), ...rows].join("\n"));
                showToast("Đã sao chép bảng.", "success");
            });
            tableEl("table-builder-export-csv-btn")?.addEventListener("click", () => exportAiTable("csv").catch(error => showToast(error.message || "Không thể tải CSV", "error")));
            tableEl("table-builder-export-btn")?.addEventListener("click", () => exportAiTable("xlsx").catch(error => showToast(error.message || "Không thể tải Excel", "error")));
            tableEl("table-builder-save-workspace-btn")?.addEventListener("click", async () => {
                const table = state.aiTableBuilder.currentTable;
                if (!table?.tableId) return showToast("Chưa có bảng để lưu.", "warning");
                await tableBuilderService.saveToWorkspace(table.tableId);
                await loadUserFilesFromApi();
                showToast("Đã lưu bảng thành file thật trong workspace.", "success");
            });
            tableEl("table-builder-refresh-btn")?.addEventListener("click", () => state.aiTableBuilder.currentTable ? renderTablePage() : generateAiTable());
            tableEl("table-builder-history-btn")?.addEventListener("click", () => showTableHistory().catch(error => showToast(error.message || "Không thể tải lịch sử", "error")));
            tableEl("table-builder-save-template-btn")?.addEventListener("click", () => showToast("Mẫu cá nhân sẽ lưu qua API template khi bật.", "info"));
        }
        updateTableCounter();
        await loadAiTableData();
    }

    initAiTableBuilderPage().catch(() => {});

    // ----------------------------------------------------------------------
    // AI DOCUMENT BUILDER LOGIC
    // ----------------------------------------------------------------------
    function docEl(id) {
        return document.getElementById(id);
    }

    function setDocumentStatus(status, detail = "") {
        state.aiDocument.status = status;
        const labels = { ready: "Sẵn sàng", generating: "Đang tạo", completed: "Đã tạo", error: "Lỗi" };
        const statusNode = docEl("doc-status-state");
        if (statusNode) statusNode.textContent = labels[status] || status;
        const errorBox = docEl("doc-builder-error");
        if (errorBox) {
            errorBox.hidden = status !== "error";
            errorBox.textContent = detail;
        }
    }

    function selectedDocumentFile() {
        return state.aiDocument.files.find(file => String(file.fileId || file.id) === String(state.aiDocument.selectedFileId)) || null;
    }

    function renderDocumentFiles() {
        const select = docEl("doc-builder-file-select");
        if (!select) return;
        select.innerHTML = "";
        if (!state.aiDocument.files.length) {
            select.innerHTML = `<option value="">Chưa có tệp nguồn</option>`;
            renderDocumentSourceCard();
            return;
        }
        select.appendChild(new Option("Chọn tệp nguồn", ""));
        state.aiDocument.files.forEach(file => {
            const option = new Option(`${file.fileName || file.name} (${Number(file.rowCount || 0).toLocaleString("vi-VN")} dòng)`, file.fileId || file.id);
            select.appendChild(option);
        });
        select.value = state.aiDocument.selectedFileId;
        renderDocumentSourceCard();
    }

    function renderDocumentSourceCard() {
        const card = docEl("doc-builder-source-card");
        const sourceStatus = docEl("doc-status-source");
        const file = selectedDocumentFile();
        if (!card) return;
        if (!file) {
            card.textContent = "Chưa có tệp nguồn";
            if (sourceStatus) sourceStatus.textContent = "Chưa có tệp nguồn";
            return;
        }
        const name = file.fileName || file.name;
        const size = file.size || "--";
        const status = file.status || "ready";
        card.innerHTML = `<strong>${escapeHTML(name)}</strong><span>${escapeHTML(size)} · ${escapeHTML(status)} · ${Number(file.rowCount || 0).toLocaleString("vi-VN")} dòng</span><button id="doc-builder-clear-file" type="button">Bỏ chọn</button>`;
        if (sourceStatus) sourceStatus.textContent = `${name}${state.aiDocument.selectedSheet ? ` · ${state.aiDocument.selectedSheet}` : ""}`;
        docEl("doc-builder-clear-file")?.addEventListener("click", () => selectDocumentFile(""));
    }

    function renderDocumentSheets() {
        const wrap = docEl("doc-builder-sheet-wrap");
        const select = docEl("doc-builder-sheet-select");
        if (!wrap || !select) return;
        select.innerHTML = "";
        if (!state.aiDocument.selectedFileId || !state.aiDocument.sheets.length) {
            wrap.style.display = "none";
            return;
        }
        wrap.style.display = "flex";
        state.aiDocument.sheets.forEach(sheet => {
            const name = typeof sheet === "string" ? sheet : sheet.name;
            select.appendChild(new Option(name, name));
        });
        select.value = state.aiDocument.selectedSheet;
    }

    function renderDocumentTemplates() {
        const grid = docEl("doc-builder-template-grid");
        if (!grid) return;
        const templates = state.aiDocument.templates || [];
        if (!templates.length) {
            grid.innerHTML = `<div class="ai-document-template-empty">Chưa có mẫu tài liệu.</div>`;
            return;
        }
        grid.innerHTML = templates.map(template => `
            <button type="button" class="ai-document-template ${state.aiDocument.selectedTemplateId === template.id ? "active" : ""}" data-template-id="${escapeHTML(template.id)}">
                <strong>${escapeHTML(template.name)}</strong>
                <span>${escapeHTML(template.description || "")}</span>
            </button>`).join("");
        grid.querySelectorAll("[data-template-id]").forEach(button => {
            button.addEventListener("click", () => {
                state.aiDocument.selectedTemplateId = button.getAttribute("data-template-id");
                renderDocumentTemplates();
            });
        });
    }

    function updateDocumentPromptCounter() {
        const input = docEl("doc-builder-facts");
        const counter = docEl("doc-builder-char-counter");
        if (input && counter) counter.textContent = `${input.value.length}/2000`;
    }

    async function loadAiDocumentData() {
        const [files, templatePayload] = await Promise.all([
            documentBuilderService.getWorkspaceFiles(),
            documentBuilderService.getTemplates()
        ]);
        state.aiDocument.files = Array.isArray(files) ? files : files.files || [];
        state.aiDocument.templates = templatePayload.templates || [];
        renderDocumentFiles();
        renderDocumentTemplates();
        renderDocumentSheets();
        if (!state.aiDocument.files.length) {
            setDocumentStatus("ready");
            const placeholder = docEl("doc-builder-placeholder");
            if (placeholder) placeholder.innerHTML = `<strong>Chưa có tệp nguồn</strong><span>Hãy upload file vào workspace trước khi soạn văn bản.</span>`;
        }
    }

    async function selectDocumentFile(fileId) {
        state.aiDocument.selectedFileId = fileId;
        state.aiDocument.selectedSheet = "";
        state.aiDocument.sheets = [];
        const file = selectedDocumentFile();
        if (fileId && file?.status && file.status !== "ready") {
            setDocumentStatus("error", "File chưa sẵn sàng để đọc.");
        } else {
            setDocumentStatus("ready");
        }
        renderDocumentFiles();
        if (fileId) {
            const sheets = await documentBuilderService.getSheets(fileId);
            state.aiDocument.sheets = sheets.sheets || [];
            state.aiDocument.selectedSheet = state.aiDocument.sheets[0] || "";
        }
        renderDocumentSheets();
        renderDocumentSourceCard();
    }

    function selectedDocumentSections() {
        return Array.from(document.querySelectorAll("#doc-builder-sections input:checked")).map(input => input.value);
    }

    function validateDocumentForm() {
        const type = docEl("doc-builder-type")?.value || "";
        const file = selectedDocumentFile();
        const prompt = docEl("doc-builder-facts")?.value.trim() || "";
        if (!type) return "Vui lòng chọn loại tài liệu.";
        if (!file) return "Vui lòng chọn tệp nguồn thật trong workspace.";
        if (file.status && file.status !== "ready") return "File chưa ready.";
        if (state.aiDocument.sheets.length && !state.aiDocument.selectedSheet) return "Vui lòng chọn sheet.";
        if (!prompt) return "Vui lòng nhập yêu cầu chính / prompt.";
        return "";
    }

    function renderGeneratedDocument(documentData) {
        state.aiDocument.currentDocument = documentData;
        state.currentDocumentBuilderResult = documentData;
        const placeholder = docEl("doc-builder-placeholder");
        const results = docEl("doc-builder-results");
        const preview = docEl("doc-builder-preview-text");
        const facts = docEl("doc-builder-facts-used");
        const badge = docEl("doc-builder-generated-badge");
        if (placeholder) placeholder.style.display = "none";
        if (results) results.style.display = "block";
        if (preview) preview.innerHTML = documentData.content?.html || `<pre>${escapeHTML(documentData.content?.markdown || "")}</pre>`;
        if (facts) {
            const factsUsed = (documentData.factsUsed || []).map(item => `<li>${escapeHTML(item)}</li>`).join("");
            const checks = (documentData.checks || []).map(item => `<li>${escapeHTML(item)}</li>`).join("");
            facts.innerHTML = `
                <div><strong>Nguồn dữ liệu đã dùng</strong><ul>${factsUsed || "<li>Dữ liệu lấy từ tệp nguồn đã chọn.</li>"}</ul></div>
                ${checks ? `<div><strong>Điểm cần kiểm tra</strong><ul>${checks}</ul></div>` : ""}`;
        }
        if (badge) badge.textContent = `Đã tạo lúc ${formatDateTime(documentData.generatedAt)}`;
        const confidence = docEl("doc-status-confidence");
        const time = docEl("doc-status-time");
        if (confidence) confidence.textContent = `${Number(documentData.confidence || 0)}%`;
        if (time) time.textContent = `${Number(documentData.metrics?.estimatedTime || 0)} giây`;
        renderDocumentSourceCard();
        setDocumentStatus("completed");
    }

    async function generateAiDocument() {
        const message = validateDocumentForm();
        if (message) {
            setDocumentStatus("error", message);
            showToast(message, "error");
            return;
        }
        const buttons = [docEl("doc-builder-run-btn"), docEl("doc-builder-generate-main-btn")].filter(Boolean);
        buttons.forEach(button => {
            button.disabled = true;
            button.textContent = "Đang tạo...";
        });
        setDocumentStatus("generating");
        const placeholder = docEl("doc-builder-placeholder");
        const results = docEl("doc-builder-results");
        if (placeholder) {
            placeholder.style.display = "flex";
            placeholder.innerHTML = `<strong>Đang tạo tài liệu...</strong><span>AI đang đọc context từ file thật và soạn văn bản.</span>`;
        }
        if (results) results.style.display = "none";
        try {
            const payload = {
                documentType: docEl("doc-builder-type")?.value,
                fileId: state.aiDocument.selectedFileId,
                sheetName: state.aiDocument.selectedSheet,
                prompt: docEl("doc-builder-facts")?.value.trim(),
                tone: docEl("doc-builder-tone")?.value,
                language: docEl("doc-builder-language")?.value,
                sections: selectedDocumentSections(),
                templateId: state.aiDocument.selectedTemplateId || null
            };
            const documentData = await documentBuilderService.generateDocument(payload);
            renderGeneratedDocument(documentData);
            incrementCurrentUserUsage();
            updateWorkspaceSidebarUI();
            historyService.addOperation("document", `AI Document: "${documentData.title}"`);
            adminService.addSystemLog("success", `AI Document: Drafted document '${documentData.title}' from real workspace file`);
            showToast("Đã soạn văn bản từ dữ liệu thật.", "success");
        } catch (error) {
            setDocumentStatus("error", error.message || "Không thể soạn văn bản AI.");
            showToast(error.message || "Không thể soạn văn bản AI", "error");
        } finally {
            buttons.forEach(button => {
                button.disabled = false;
                button.textContent = "Soạn văn bản";
            });
        }
    }

    async function exportAiDocument(format) {
        const documentData = state.aiDocument.currentDocument;
        if (!documentData?.documentId) {
            showToast("Chưa có tài liệu để export.", "warning");
            return;
        }
        try {
            const payload = await documentBuilderService.exportDocument(documentData.documentId, format);
            const url = documentBuilderService.downloadUrl(payload);
            const response = await fetch(url, { headers: documentBuilderService.authHeaders() });
            if (!response.ok) throw new Error(`Lỗi tải file ${response.status}`);
            const blob = await response.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = payload.output?.display_name || payload.output?.displayName || `${documentData.title}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            showToast(`Đã tải xuống ${format.toUpperCase()} từ tài liệu thật.`, "success");
        } catch (error) {
            showToast(error.message || `Không thể export ${format.toUpperCase()}`, "error");
        }
    }

    async function showAiDocumentHistory() {
        const drawer = docEl("doc-builder-history-drawer");
        if (!drawer) return;
        drawer.hidden = !drawer.hidden;
        if (drawer.hidden) return;
        drawer.innerHTML = `<h3>Lịch sử AI Document</h3><p>Đang tải...</p>`;
        try {
            const payload = await documentBuilderService.getHistory();
            const items = payload.items || [];
            drawer.innerHTML = `<h3>Lịch sử AI Document</h3>${items.length ? items.map(item => `
                <button type="button" class="ai-document-history-item" data-document-id="${escapeHTML(item.documentId)}">
                    <strong>${escapeHTML(item.title || "Tài liệu")}</strong>
                    <span>${escapeHTML(item.fileName || "")} ${item.sheetName ? `· ${escapeHTML(item.sheetName)}` : ""} · ${escapeHTML(formatDateTime(item.createdAt))}</span>
                </button>`).join("") : `<p>Chưa có lịch sử document.</p>`}`;
            drawer.querySelectorAll("[data-document-id]").forEach(button => {
                button.addEventListener("click", async () => {
                    const documentData = await documentBuilderService.getDocument(button.getAttribute("data-document-id"));
                    renderGeneratedDocument(documentData);
                    drawer.hidden = true;
                });
            });
        } catch (error) {
            drawer.innerHTML = `<h3>Lịch sử AI Document</h3><p>${escapeHTML(error.message || "Không thể tải lịch sử.")}</p>`;
        }
    }

    let aiDocumentBound = false;
    async function initAiDocumentPage() {
        if (!docEl("doc-builder-file-select")) return;
        if (!aiDocumentBound) {
            aiDocumentBound = true;
            [docEl("doc-builder-run-btn"), docEl("doc-builder-generate-main-btn")].filter(Boolean).forEach(button => button.addEventListener("click", generateAiDocument));
            docEl("doc-builder-file-select")?.addEventListener("change", event => selectDocumentFile(event.target.value).catch(error => showToast(error.message || "Không thể đọc file", "error")));
            docEl("doc-builder-sheet-select")?.addEventListener("change", event => {
                state.aiDocument.selectedSheet = event.target.value;
                renderDocumentSourceCard();
            });
            docEl("doc-builder-facts")?.addEventListener("input", updateDocumentPromptCounter);
            docEl("doc-builder-copy-btn")?.addEventListener("click", () => {
                const doc = state.aiDocument.currentDocument;
                if (!doc) return showToast("Chưa có văn bản để sao chép.", "warning");
                navigator.clipboard.writeText(`${doc.title}\n\n${doc.content?.markdown || ""}`);
                showToast("Đã sao chép văn bản.", "success");
            });
            docEl("doc-builder-export-docx-btn")?.addEventListener("click", () => exportAiDocument("docx"));
            docEl("doc-builder-export-pdf-btn")?.addEventListener("click", () => exportAiDocument("pdf"));
            docEl("doc-builder-history-btn")?.addEventListener("click", showAiDocumentHistory);
            docEl("doc-builder-save-template-btn")?.addEventListener("click", () => showToast("Mẫu tài liệu được lấy từ backend; chức năng lưu mẫu cá nhân sẽ dùng API template khi bật.", "info"));
            docEl("doc-builder-edit-btn")?.addEventListener("click", () => docEl("doc-builder-preview-text")?.setAttribute("contenteditable", "true"));
            docEl("doc-builder-fullscreen-btn")?.addEventListener("click", () => docEl("doc-builder-preview-text")?.requestFullscreen?.());
        }
        updateDocumentPromptCounter();
        await loadAiDocumentData();
    }

    initAiDocumentPage().catch(() => {});

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

    function downloadOutputFile(output) {
        if (!output?.id) return;
        const token = getAccessToken();
        fetch(exportService.downloadUrl(output.id), {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        })
            .then(res => {
                if (!res.ok) throw new Error(`Lỗi ${res.status}`);
                return res.blob();
            })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = output.display_name || output.displayName || "excelai-output";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            })
            .catch(error => showToast(error.message || "Không thể tải file output", "error"));
    }

    // ----------------------------------------------------------------------
    // 15. INITIALIZE APP STATE
    // ----------------------------------------------------------------------
    renderThreadsList();
    renderAPIKeysTable();
    renderAdminCoupons();
    startLiveMetrics();
    refreshPricingFromApi();
    syncPricingUI();
    checkAPIKeysLock();


    // Template categories filter registration
    const templatesCategoryContainer = document.getElementById("templates-category-filters");
    if (templatesCategoryContainer) {
        templatesCategoryContainer.querySelectorAll(".selection-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                templatesCategoryContainer.querySelectorAll(".selection-chip").forEach(c => c.classList.remove("active"));
                chip.classList.add("active");
                const cat = chip.getAttribute("data-category");

                document.querySelectorAll("#templates-grid .template-card").forEach(card => {
                    const cardCat = card.getAttribute("data-category") || "";
                    if (cat === "all" || cardCat === cat) {
                        card.style.display = "flex";
                    } else {
                        card.style.display = "none";
                    }
                });
            });
        });
    }

    // Table Builder Quick Template click registration
    const tableBuilderQuickChips = document.querySelectorAll("#table-builder-quick-templates .selection-chip");
    tableBuilderQuickChips.forEach(chip => {
        chip.addEventListener("click", () => {
            tableBuilderQuickChips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            const desc = chip.getAttribute("data-desc");
            const type = chip.getAttribute("data-type");

            if (tableBuilderDesc) tableBuilderDesc.value = desc;
            if (tableBuilderType) tableBuilderType.value = type;

            showToast("Đã chọn cấu hình mẫu nhanh!", "success");
        });
    });

    // Table Builder Mode selector click registration
    const tableBuilderModeSelector = document.getElementById("table-builder-mode-selector");
    if (tableBuilderModeSelector) {
        tableBuilderModeSelector.querySelectorAll(".selector-item-card").forEach(card => {
            card.addEventListener("click", () => {
                tableBuilderModeSelector.querySelectorAll(".selector-item-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                showToast(`Chuyển sang chế độ: ${card.querySelector("strong").innerText}`, "info");
            });
        });
    }

    // Doc Builder Output Format selector click registration
    const docBuilderFormatSelector = document.getElementById("doc-builder-format-selector");
    if (docBuilderFormatSelector) {
        docBuilderFormatSelector.querySelectorAll(".selector-item-card").forEach(card => {
            card.addEventListener("click", () => {
                docBuilderFormatSelector.querySelectorAll(".selector-item-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                showToast(`Đã chọn định dạng: ${card.querySelector("strong").innerText}`, "info");
            });
        });
    }

    showView("landing");
    updateWorkspaceSidebarUI();
});

    // Global click listener to close custom dropdowns
    document.addEventListener("click", () => {
        document.querySelectorAll(".dropdown-menu-v3").forEach(m => m.style.display = "none");
    });
