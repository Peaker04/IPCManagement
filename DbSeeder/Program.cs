using System;
using MySqlConnector;

var connectionString = "server=localhost;port=3306;database=ipcmanagement;user=root;password=123456789;";

try
{
    using var connection = new MySqlConnection(connectionString);
    connection.Open();

    var query = @"
        SELECT pr.PurchaseRequestCode, pr.Status, pr.PurchaseForDate, prl.RequiredQty, prl.CurrentStockQty, prl.PurchaseQty, i.IngredientName
        FROM purchaserequests pr
        JOIN purchaserequestlines prl ON pr.PurchaseRequestId = prl.PurchaseRequestId
        JOIN ingredients i ON prl.IngredientId = i.IngredientId
    ";

    using var command = new MySqlCommand(query, connection);
    using var reader = command.ExecuteReader();

    Console.WriteLine("\n================ KẾT QUẢ TRUY VẤN TỪ DATABASE ================\n");
    if (!reader.HasRows) {
        Console.WriteLine("=> KHÔNG TÌM THẤY: Chưa có Đề xuất mua hàng nào được lưu xuống DB!");
    } else {
        while (reader.Read()) {
            Console.WriteLine($"[1] Mã Đề xuất mua hàng : {reader.GetString("PurchaseRequestCode")}");
            Console.WriteLine($"[2] Trạng thái          : {reader.GetString("Status")}");
            Console.WriteLine($"[3] Ngày phục vụ        : {reader.GetDateTime("PurchaseForDate"):yyyy-MM-dd}");
            Console.WriteLine($"[4] Nguyên liệu         : {reader.GetString("IngredientName")}");
            Console.WriteLine($"[5] Số lượng cần thiết  : {reader.GetDecimal("RequiredQty")} kg");
            Console.WriteLine($"[6] Tồn kho hiện tại    : {reader.GetDecimal("CurrentStockQty")} kg");
            Console.WriteLine($"[7] CHỐT SỐ LƯỢNG MUA   : {reader.GetDecimal("PurchaseQty")} kg");
            Console.WriteLine("--------------------------------------------------------------");
        }
    }
    Console.WriteLine("==============================================================\n");
}
catch (Exception ex)
{
    Console.WriteLine("LỖI KHI TRUY VẤN: " + ex.Message);
}
