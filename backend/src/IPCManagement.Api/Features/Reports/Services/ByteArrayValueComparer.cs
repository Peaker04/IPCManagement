namespace IPCManagement.Api.Features.Reports.Services;

internal sealed class ByteArrayValueComparer : IEqualityComparer<byte[]>
{
    internal static readonly ByteArrayValueComparer Instance = new();

    public bool Equals(byte[]? x, byte[]? y)
        => ReferenceEquals(x, y) || (x is not null && y is not null && x.SequenceEqual(y));

    public int GetHashCode(byte[] obj)
    {
        var hash = new HashCode();
        foreach (var value in obj) hash.Add(value);
        return hash.ToHashCode();
    }
}
