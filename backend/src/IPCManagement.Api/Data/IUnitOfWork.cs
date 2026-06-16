using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore.Storage;

namespace IPCManagement.Api.Data;

public interface IUnitOfWork
{
    Task<IDbContextTransaction> BeginTransactionAsync();
    Task<int> SaveChangesAsync();
}
