using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data;

public partial class IpcManagementContext
{
    public virtual DbSet<UnitNormalizationReview> Unitnormalizationreviews { get; set; }
}
