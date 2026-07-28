using System.Threading.Tasks;

namespace IPCManagement.Api.Data;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync();
}
