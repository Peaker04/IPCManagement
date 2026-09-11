using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.DatabaseTool;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MySqlConnector;
using NSubstitute;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;

namespace IPCManagement.Api.Tests;

/// <summary>
/// [Fact] nhưng tự skip khi workbook nghiệp vụ riêng không có mặt.
///
/// Ba test dùng attribute này đọc <c>.docs/IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx</c>.
/// Thư mục <c>.docs/</c> bị .gitignore chặn (dữ liệu vận hành thật của khách hàng, không đưa
/// lên repo), nên trên CI sạch file đó KHÔNG tồn tại và ba test sẽ fail vì FileNotFoundException
/// — làm đỏ bước "Test backend" trước cả khi tới các gate khác.
///
/// Cổng ở đây là sự tồn tại của file chứ không phải biến môi trường: máy nào có workbook thì
/// test chạy thật, máy nào không có thì skip kèm lý do rõ ràng. Không có nhánh nào "pass giả".
///
/// Lấy ý tưởng từ origin/main (a64c4a1) nhưng CHỈ đòi file thật sự được đọc. Bản của main đòi
/// thêm workbook 19.5.2026 — file đó không có trong .docs của máy này, dùng nguyên bản sẽ làm
/// ba test skip cả ở local và mất coverage đang có.
/// </summary>
internal sealed class PrivateWorkbookFactAttribute : FactAttribute
{
    private const string RequiredWorkbook = "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx";

    public PrivateWorkbookFactAttribute()
    {
        if (!RepositoryFileExists(".docs", RequiredWorkbook))
        {
            Skip = $"Cần workbook nghiệp vụ riêng '{RequiredWorkbook}' trong .docs (không nằm trong repo).";
        }
    }

    private static bool RepositoryFileExists(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine([current.FullName, .. segments])))
            {
                return true;
            }

            current = current.Parent;
        }

        return false;
    }
}
