/* ==========================================================================
   EXCELAI BOT - AI SIMULATION AND GENERATION SERVICE
   ========================================================================== */

export const aiService = {
    // Tạo phản hồi Chatbot tổng quát dựa trên systemPrompt của admin
    generateChatResponse(message, threadHistory, systemPrompt) {
        const text = message.toLowerCase().trim();
        
        let reply = "Tôi có thể hỗ trợ bạn rà soát lỗi Excel, sinh công thức, viết VBA/Macro, làm sạch dữ liệu, đối soát sổ sách và lập báo cáo tự động bằng tiếng Việt.\n\nHãy chọn một công cụ trên Sidebar hoặc mô tả yêu cầu tại đây.";
        
        if (text.includes("sumifs") || text.includes("tổng")) {
            reply = `Dựa trên phân tích yêu cầu tính tổng của bạn, bạn nên dùng hàm **SUMIFS**.
Hàm này cho phép tính tổng dải ô thỏa mãn nhiều điều kiện cùng lúc:
\`\`\`excel
=SUMIFS(Vùng_tính_tổng, Vùng_điều_kiện_1, Điều_kiện_1, [Vùng_điều_kiện_2, Điều_kiện_2], ...)
\`\`\`
**Ví dụ thực tế**:
Tính tổng số tiền tại cột C nếu cột A là "Nhân sự" và cột B là "Bán hàng":
\`\`\`excel
=SUMIFS(C:C, A:A, "Nhân sự", B:B, "Bán hàng")
\`\`\`
Bạn có muốn tôi điều chỉnh công thức này cho cột cụ thể trong bảng của bạn không?`;
        } else if (text.includes("vba") || text.includes("macro") || text.includes("macro tự động")) {
            reply = `Dưới đây là mã lệnh Macro VBA giúp định dạng bảng tính Excel tự động và canh chỉnh tiêu đề chuẩn xác:
\`\`\`vba
Sub FormatSalesSheet()
    ' Macro định dạng bảng tính tự động
    Dim LastRow As Long
    
    Application.ScreenUpdating = False
    
    ' Tìm dòng cuối cùng có dữ liệu trong cột A
    LastRow = Cells(Rows.Count, "A").End(xlUp).Row
    
    ' Định dạng tiêu đề cột (dòng 1)
    With Range("A1:E1")
        .Font.Bold = True
        .Font.Color = RGB(255, 255, 255)
        .Interior.Color = RGB(16, 124, 65) ' Màu xanh Excel
        .HorizontalAlignment = xlCenter
    End With
    
    ' Định dạng lưới ô và tự động căn rộng cột
    With Range("A1:E" & LastRow)
        .Borders.LineStyle = xlContinuous
        .Borders.Weight = xlThin
        .Columns.AutoFit
    End With
    
    Application.ScreenUpdating = True
    MsgBox "Đã định dạng bảng tính thành công!", vbInformation, "ExcelAI Notification"
End Sub
\`\`\`
*Cách chạy*: Nhấn Alt+F11 để mở VBA Editor, chọn Insert > Module, dán code này vào và nhấn F5 để chạy.`;
        } else if (text.includes("lỗi") || text.includes("anomalies") || text.includes("checker") || text.includes("#n/a")) {
            reply = `Trợ lý AI rà soát phát hiện các nhóm lỗi dữ liệu thường gặp trong Excel:
1. **Lỗi #N/A (Dò tìm thất bại)**: Thường do hàm VLOOKUP không tìm thấy giá trị. Hãy dùng \`IFERROR\` để làm sạch:
   \`\`\`excel
   =IFERROR(VLOOKUP(A2, B:C, 2, FALSE), "Không tìm thấy")
   \`\`\`
2. **Dòng trống (Missing values)**: Gây sai lệch khi tính toán.
3. **Giá trị âm bất thường (Outliers)**: Cột số tiền/doanh thu xuất hiện số âm.
Bạn có thể upload file vào mục **AI Data Checker** để AI rà soát lỗi tự động từng dòng!`;
        } else if (text.includes("tóm tắt") || text.includes("file") || text.includes("dữ liệu") || text.includes("sales_preview.csv") || text.includes("orders.csv")) {
            reply = `Nhận diện tệp đính kèm dữ liệu. Dưới đây là phân tích tóm tắt nhanh:
- **Cấu trúc bảng**: Gồm các cột Ngày, Sản phẩm, Số lượng, Đơn giá và Thành tiền.
- **Doanh thu cao nhất**: Đơn hàng trị giá **24,800,000đ** (Tai nghe Sony WH-1000XM5).
- **Mặt hàng bán chạy**: Thiết bị ngoại vi chiếm tỷ trọng cao.
Bạn muốn tôi lập công thức tính toán nào hay viết code xử lý tập dữ liệu này?`;
        }
        
        return reply;
    },

    // Sinh công thức Excel
    generateFormula(description, context, promptConfig) {
        const text = description.toLowerCase().trim();
        
        let formula = "=VLOOKUP(A2, D:E, 2, FALSE)";
        let explanation = "Dò tìm giá trị của ô A2 trong cột D, và trả về giá trị tương ứng ở cột E.";
        let inputExample = "Cột A chứa Mã sản phẩm (ví dụ: 'SP01'). Cột D và E là bảng danh mục sản phẩm.";
        let outputExample = "Trả về tên sản phẩm tương ứng trong danh mục.";

        if (text.includes("tổng") || text.includes("sum")) {
            formula = '=SUMIFS(C:C, A:A, ">=100", B:B, "Kế toán")';
            explanation = "Tính tổng các số ở cột C nếu dòng tương ứng ở cột A lớn hơn hoặc bằng 100, và cột B là 'Kế toán'.";
            inputExample = "Cột A: Số lượng, Cột B: Phòng ban, Cột C: Doanh thu.";
            outputExample = "Tổng doanh thu của phòng Kế toán có số lượng >= 100.";
        } else if (text.includes("nếu") || text.includes("if") || text.includes("thưởng")) {
            formula = '=IF(B2>100000000, A2 * 10%, A2 * 5%)';
            explanation = "Nếu doanh thu ở ô B2 lớn hơn 100,000,000đ, tính thưởng 10% doanh thu (ô A2). Ngược lại, tính thưởng 5% doanh thu.";
            inputExample = "Ô B2: Doanh thu thực tế (ví dụ: 120,000,000đ), Ô A2: Doanh thu gốc.";
            outputExample = "Trả về giá trị tính thưởng tương ứng (12,000,000đ).";
        } else if (text.includes("tách") || text.includes("cắt")) {
            formula = '=TEXTBEFORE(A2, " ")';
            explanation = "Trích xuất toàn bộ chuỗi văn bản đứng trước ký tự khoảng trắng đầu tiên trong ô A2 (thường dùng để lấy Họ).";
            inputExample = "Ô A2 chứa Họ và Tên (ví dụ: 'Nguyễn Văn A').";
            outputExample = "Trả về phần Họ ('Nguyễn').";
        } else if (context === "kế toán" && (text.includes("thuế") || text.includes("vat"))) {
            formula = "=A2 * 10%";
            explanation = "Tính tiền thuế VAT 10% trực tiếp dựa trên trị giá gốc tại ô A2.";
            inputExample = "Ô A2 chứa số tiền chưa thuế (ví dụ: 1,000,000đ).";
            outputExample = "Trả về tiền thuế tương ứng (100,000đ).";
        }

        return { formula, explanation, inputExample, outputExample };
    },

    // Sinh mã VBA
    generateVBA(description, promptConfig) {
        const text = description.toLowerCase().trim();
        
        let code = `' Macro xóa tất cả các dòng trống trong bảng tính đang chọn
Sub DeleteEmptyRows()
    Dim LastRow As Long
    Dim i As Long
    
    LastRow = ActiveSheet.UsedRange.Rows.Count
    
    ' Duyệt ngược từ dưới lên để tránh bỏ sót dòng khi xóa
    For i = LastRow To 1 Step -1
        If Application.WorksheetFunction.CountA(Rows(i)) = 0 Then
            Rows(i).Delete
        End If
    Next i
    
    MsgBox "Đã xóa tất cả các dòng trống!", vbInformation, "ExcelAI"
End Sub`;
        
        if (text.includes("email") || text.includes("thư") || text.includes("gửi")) {
            code = `' Macro tự động gửi Email báo cáo từ Excel qua Outlook
Sub SendAutoEmails()
    Dim OutlookApp As Object
    Dim OutlookMail As Object
    Dim i As Long
    Dim LastRow As Long
    
    Set OutlookApp = CreateObject("Outlook.Application")
    LastRow = Cells(Rows.Count, 1).End(xlUp).Row
    
    For i = 2 To LastRow ' Chạy từ dòng 2 (bỏ qua tiêu đề)
        If Cells(i, 2).Value <> "" Then ' Cột B chứa địa chỉ Email
            Set OutlookMail = OutlookApp.CreateItem(0)
            With OutlookMail
                .To = Cells(i, 2).Value
                .Subject = "Báo cáo công việc định kỳ"
                .Body = "Kính gửi " & Cells(i, 1).Value & "," & vbCrLf & _
                        "Vui lòng xem báo cáo tiến độ và công nợ đi kèm."
                .Send
            End With
        End If
    Next i
    
    Set OutlookApp = Nothing
    MsgBox "Đã gửi email thành công!", vbInformation, "ExcelAI"
End Sub`;
        } else if (text.includes("gộp") || text.includes("file") || text.includes("thư mục")) {
            code = `' Macro gộp dữ liệu từ nhiều file Excel trong 1 thư mục vào file hiện tại
Sub MergeAllWorkbooks()
    Dim MyFolder As String
    Dim MyFile As String
    Dim wbSource As Workbook
    Dim wsSource As Worksheet
    Dim wsTarget As Workbook
    Dim NextRow As Long
    
    ' Chọn thư mục chứa file Excel (thêm dấu gạch chéo cuối)
    MyFolder = "C:\\ExcelData\\" 
    MyFile = Dir(MyFolder & "*.xlsx")
    
    Set wsTarget = ActiveWorkbook
    
    Application.ScreenUpdating = False
    Do While MyFile <> ""
        Set wbSource = Workbooks.Open(MyFolder & MyFile)
        Set wsSource = wbSource.Sheets(1)
        
        NextRow = wsTarget.ActiveSheet.Cells(wsTarget.ActiveSheet.Rows.Count, "A").End(xlUp).Row + 1
        wsSource.UsedRange.Copy wsTarget.ActiveSheet.Range("A" & NextRow)
        
        wbSource.Close SaveChanges:=False
        MyFile = Dir()
    Loop
    Application.ScreenUpdating = True
    MsgBox "Đã gộp dữ liệu thành công!", vbInformation, "ExcelAI"
End Sub`;
        } else if (text.includes("tô màu") || text.includes("màu đỏ") || text.includes("quá hạn")) {
            code = `' Macro lọc đơn hàng quá hạn và tô màu đỏ
Sub HighlightOverdueOrders()
    Dim Cell As Range
    Dim LastRow As Long
    Dim CheckDate As Date
    
    LastRow = Cells(Rows.Count, "A").End(xlUp).Row
    CheckDate = Date
    
    Application.ScreenUpdating = False
    
    For Each Cell In Range("D2:D" & LastRow) ' Giả thiết cột D chứa Ngày Hạn
        If IsDate(Cell.Value) Then
            If CDate(Cell.Value) < CheckDate Then
                ' Tô màu đỏ nhạt dòng chứa đơn hàng quá hạn
                Range("A" & Cell.Row & ":E" & Cell.Row).Interior.Color = RGB(255, 204, 204)
            End If
        End If
    Next Cell
    
    Application.ScreenUpdating = True
    MsgBox "Đã đánh dấu các dòng quá hạn!", vbInformation, "ExcelAI"
End Sub`;
        }

        return code;
    },

    explainVBA(code) {
        if (code.includes("DeleteEmptyRows")) {
            return `Giải thích chi tiết mã lệnh VBA:
- **Sub DeleteEmptyRows() / End Sub**: Bắt đầu và kết thúc một chương trình Macro.
- **Dim LastRow, i**: Khai báo biến lưu dòng cuối cùng và biến lặp.
- **ActiveSheet.UsedRange.Rows.Count**: Tìm phạm vi dòng tối đa đang được dùng trên sheet.
- **For i = LastRow To 1 Step -1**: Vòng lặp chạy ngược từ dưới lên. Việc chạy ngược cực kỳ quan trọng vì nếu chạy xuôi, sau khi xóa dòng 5 thì dòng 6 nhảy thành dòng 5, vòng lặp tiếp tục sang dòng cũ thứ 7 (nay là 6) sẽ bỏ sót dòng.
- **CountA(Rows(i)) = 0**: Hàm kiểm tra xem dòng thứ i có hoàn toàn trống hay không. Nếu trống, gọi lệnh **Delete** để xóa dòng.`;
        } else if (code.includes("SendAutoEmails")) {
            return `Giải thích chi tiết mã lệnh VBA:
- **CreateObject(\"Outlook.Application\")**: Khởi tạo kết nối nền tảng đến ứng dụng Outlook của Microsoft.
- **Cells(Rows.Count, 1).End(xlUp).Row**: Tìm dòng cuối cùng chứa dữ liệu ở cột A để xác định vùng lặp.
- **Cells(i, 2).Value**: Lấy địa chỉ email nằm ở cột B (cột 2).
- **Cells(i, 1).Value**: Lấy tên người nhận nằm ở cột A (cột 1) để cá nhân hóa lời chào trong Email.
- **OutlookMail.Send**: Tự động thực thi gửi Email ngay lập tức không cần bấm nút duyệt thủ công.`;
        } else if (code.includes("HighlightOverdueOrders")) {
            return `Giải thích chi tiết mã lệnh VBA:
- **HighlightOverdueOrders**: Tên chương trình.
- **CDate(Cell.Value) < CheckDate**: Chuyển giá trị trong ô thành kiểu Ngày và so sánh với Ngày hôm nay (\`CheckDate\`).
- **RGB(255, 204, 204)**: Mã màu đỏ nhạt dùng làm nền đánh dấu cảnh báo để người dùng dễ kiểm soát thủ công.`;
        }
        return `Giải thích chi tiết mã lệnh VBA:
- **Sub ... / End Sub**: Khai báo bắt đầu và kết thúc của một chương trình Macro.
- **Application.ScreenUpdating = False**: Tắt cập nhật màn hình để tăng tốc độ xử lý của Excel (giúp code chạy nhanh hơn 5-10 lần nếu bảng dữ liệu lớn).
- **UsedRange**: Tham chiếu đến vùng dữ liệu đang được sử dụng thực tế.
- **MsgBox**: Hiển thị hộp thoại popup thông báo cho người dùng khi hoàn tất tác vụ.`;
    },

    // Phân tích dữ liệu bảng tính
    generateDataAnalysisSuggestions(stats) {
        const suggestions = [];
        
        if (stats.duplicateRows > 0) {
            suggestions.push({
                type: "Làm sạch",
                text: `Phát hiện khoảng **${stats.duplicateRows} dòng trùng lặp**. Bạn nên sử dụng công cụ 'Remove Duplicates' trong thẻ Data của Excel hoặc dùng hàm \`=UNIQUE()\` để trích xuất danh sách độc nhất.`
            });
        } else {
            suggestions.push({
                type: "Làm sạch",
                text: "Không phát hiện dòng dữ liệu trùng lặp đáng kể. Cấu trúc bảng khá sạch."
            });
        }
        
        if (stats.missingValues > 0) {
            suggestions.push({
                type: "Kiểm toán",
                text: `Phát hiện **${stats.missingValues} ô trống (thiếu dữ liệu)**. Bạn có thể sử dụng hàm \`=IFNA()\` hoặc \`=IFERROR()\` để gán giá trị mặc định, tránh việc xảy ra lỗi tính toán liên đới.`
            });
        } else {
            suggestions.push({
                type: "Kiểm toán",
                text: "Mức độ đầy đủ của dữ liệu rất cao (0 ô trống). Tất cả cột dữ liệu đều đã được điền thông tin đầy đủ."
            });
        }
        
        const numCols = stats.columns.filter(c => c.type === "Số");
        const textCols = stats.columns.filter(c => c.type === "Văn bản");
        
        if (numCols.length > 0 && textCols.length > 0) {
            suggestions.push({
                type: "Báo cáo",
                text: `Đề xuất: Tạo biểu đồ PivotTable tổng hợp chỉ số **${numCols[0].name}** phân chia theo nhóm **${textCols[0].name}** để phát hiện các phân khúc đóng góp sản lượng cao nhất.`
            });
        } else {
            suggestions.push({
                type: "Báo cáo",
                text: "Đề xuất: Tạo bảng thống kê tổng hợp số lượng bản ghi phân bổ theo thời gian hoặc danh mục để theo dõi mật độ phân bố."
            });
        }

        return suggestions;
    },

    // Tạo nhận định đối soát dữ liệu
    generateReconciliationSuggestions(stats) {
        let insight = `Đã hoàn tất đối đối soát dữ liệu bảng tính:<br>`;
        insight += `• Tổng số bản ghi khớp tuyệt đối: **${stats.matchedCount} đơn**.<br>`;
        insight += `• Phát hiện **${stats.mismatchedCount} dòng lệch giá trị** về số tiền.<br>`;
        insight += `• File A thừa **${stats.missingInBCount} dòng** so với File B.<br>`;
        insight += `• File B thừa **${stats.missingInACount} dòng** so với File A.<br>`;
        
        if (stats.mismatchedCount > 0) {
            insight += `💡 **Khuyến nghị:** Cần ưu tiên kiểm tra ${stats.mismatchedCount} dòng chênh lệch số tiền vì đây là rủi ro kế toán/doanh thu trực tiếp.`;
        } else if (stats.missingInBCount > 0 || stats.missingInACount > 0) {
            insight += `💡 **Khuyến nghị:** Đối chiếu lại danh sách các giao dịch bị thiếu để xác nhận đơn hàng chưa được đồng bộ hoàn toàn giữa hai hệ thống.`;
        } else {
            insight += `✅ **Nhận định:** Hai bảng khớp hoàn toàn 100%. Dữ liệu đối soát an toàn.`;
        }
        
        return insight;
    },

    // Hướng dẫn làm sạch dữ liệu
    generateCleaningInstructions(column, rule) {
        let desc = "";
        let formula = "";
        
        if (rule === "trim") {
            desc = `Xóa toàn bộ khoảng trắng thừa ở đầu, cuối và khoảng trắng kép ở giữa các từ của cột [${column}].`;
            formula = `=TRIM(${column}2)`;
        } else if (rule === "upper") {
            desc = `Chuyển đổi toàn bộ văn bản trong cột [${column}] thành chữ IN HOA chuẩn hóa.`;
            formula = `=UPPER(${column}2)`;
        } else if (rule === "lower") {
            desc = `Chuyển đổi toàn bộ văn bản trong cột [${column}] thành chữ thường.`;
            formula = `=LOWER(${column}2)`;
        } else if (rule === "phone") {
            desc = `Chuẩn hóa số điện thoại cột [${column}] bằng cách loại bỏ các ký tự trống, gạch ngang và thêm số 0 ở đầu nếu thiếu.`;
            formula = `=IF(LEFT(TRIM(${column}2),1)="0", TRIM(${column}2), "0"&TRIM(${column}2))`;
        } else if (rule === "email") {
            desc = `Chuẩn hóa email cột [${column}] bằng cách chuyển thành chữ thường và loại bỏ khoảng trắng.`;
            formula = `=LOWER(TRIM(${column}2))`;
        } else if (rule === "name") {
            desc = `Tách cột Họ và Tên đệm từ cột chứa Tên Đầy Đủ [${column}].`;
            formula = `=TEXTBEFORE(TRIM(${column}2), " ", , , , "Không tách được")`;
        }

        return { desc, formula };
    }
};

export default aiService;
