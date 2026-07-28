using System.Threading.Tasks;

namespace IPCManagement.Api.Data;

public class UnitOfWork : IUnitOfWork
{
    private readonly IpcManagementContext _context;

    public UnitOfWork(IpcManagementContext context)
    {
        _context = context;
    }

    public Task<int> SaveChangesAsync()
    {
        return _context.SaveChangesAsync();
    }
}
