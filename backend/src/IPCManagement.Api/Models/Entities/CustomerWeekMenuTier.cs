namespace IPCManagement.Api.Models.Entities;

public partial class CustomerWeekMenuTier
{
    public byte[] TierId { get; set; } = null!;

    public byte[] CustomerId { get; set; } = null!;

    public DateOnly WeekStartDate { get; set; }

    public decimal PriceTierAmount { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual ICollection<MenuSchedule> Menuschedules { get; set; } = new List<MenuSchedule>();
}
