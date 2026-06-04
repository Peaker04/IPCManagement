using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Role
{
    public byte[] RoleId { get; set; } = null!;

    public string RoleCode { get; set; } = null!;

    public string RoleName { get; set; } = null!;

    public virtual ICollection<User> Users { get; set; } = new List<User>();
}
