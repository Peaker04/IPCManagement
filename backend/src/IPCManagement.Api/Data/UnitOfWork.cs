using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore.Storage;

namespace IPCManagement.Api.Data;

public class UnitOfWork : IUnitOfWork
{
    private readonly IpcManagementContext _context;

    public UnitOfWork(IpcManagementContext context)
    {
        _context = context;
    }

    public Task<IDbContextTransaction> BeginTransactionAsync()
    {
        return _context.Database.BeginTransactionAsync();
    }

    public Task<int> SaveChangesAsync()
    {
        return _context.SaveChangesAsync();
    }
}
