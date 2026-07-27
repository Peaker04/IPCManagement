using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.DTOs.Coordination;

public class BulkUpdateWeeklyMenuRequest
{
    public string CustomerId { get; set; } = null!;
    public List<WeeklyMenuSlotUpdateRequest> Slots { get; set; } = new();
}

public class WeeklyMenuSlotUpdateRequest
{
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = null!;
    public string SlotType { get; set; } = null!; // "morningSavory", "morningVegetarian", "afternoonSavory", "afternoonVegetarian"
    public string DishId { get; set; } = null!;
}
