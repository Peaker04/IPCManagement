using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal sealed record ReconciliationSupplementalSnapshot(
    IReadOnlyList<ReconciliationSupplementalDemandDish> Dishes,
    IReadOnlyList<ReconciliationSupplementalDemandMaterial> Materials, string Fingerprint);

internal static class ReconciliationSupplementalSnapshotBuilder
{
    internal static ReconciliationSupplementalSnapshot Build(ReconciliationBatch batch, DateOnly day,
        IReadOnlyList<ReconciliationSupplementalDishSelection> selections,
        IReadOnlyList<ReconciliationBatchDailyLine> dailyLines, IReadOnlyList<ReconciliationBatchContributor> contributors)
    {
        if (selections.Count == 0) throw Invalid("Chọn ít nhất một món và số suất phát sinh.");
        var lines = dailyLines.Where(x => x.BatchId.SequenceEqual(batch.BatchId) && x.ServiceDate == day)
            .ToDictionary(x => Key(x.DailyLineId), StringComparer.Ordinal);
        var dishes = new List<ReconciliationSupplementalDemandDish>();
        var materials = new Dictionary<string, ReconciliationSupplementalDemandMaterial>(StringComparer.Ordinal);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var selection in selections.OrderBy(x => x.DishId, StringComparer.Ordinal)
                     .ThenBy(x => x.ShiftName, StringComparer.Ordinal).ThenBy(x => x.MenuVariant, StringComparer.Ordinal))
        {
            var dishId = GuidHelper.ParseGuidString(selection.DishId);
            if (dishId is null || selection.ExtraServings <= 0 || string.IsNullOrWhiteSpace(selection.ShiftName)
                || string.IsNullOrWhiteSpace(selection.MenuVariant)) throw Invalid("Món, ca, loại suất và số suất phát sinh không hợp lệ.");
            if (!seen.Add($"{Key(dishId)}:{selection.ShiftName}:{selection.MenuVariant}")) throw Invalid("Món cùng ca và loại suất bị lặp.");
            var facts = contributors.Where(x => x.InvalidatedAt == null && x.DishId is not null && x.DishId.SequenceEqual(dishId)
                && x.FrozenShiftName == selection.ShiftName && x.FrozenMenuVariant == selection.MenuVariant
                && x.DailyLineId is not null && lines.ContainsKey(Key(x.DailyLineId)))
                .OrderBy(x => Key(x.ContributorId), StringComparer.Ordinal).ToList();
            ValidateFacts(facts, lines);
            var first = facts[0];
            var dish = new ReconciliationSupplementalDemandDish { DemandDishId = GuidHelper.NewId(), DishId = dishId,
                FrozenDishCode = first.FrozenDishCode!, FrozenDishName = first.FrozenDishName!,
                ShiftName = selection.ShiftName, MenuVariant = selection.MenuVariant, ExtraServings = selection.ExtraServings };
            dishes.Add(dish);
            foreach (var group in facts.GroupBy(x => Key(x.DailyLineId!)).OrderBy(x => x.Key, StringComparer.Ordinal))
            {
                var source = group.First();
                var line = lines[group.Key];
                FrozenBomQuantityPolicy.TryGetCanonicalPerServing(source, out var rate);
                decimal required;
                try { required = checked(rate * selection.ExtraServings); }
                catch (OverflowException) { throw Invalid("Lượng nguyên liệu phát sinh vượt giới hạn lưu trữ."); }
                if (!materials.TryGetValue(group.Key, out var material))
                {
                    material = new() { DemandMaterialId = GuidHelper.NewId(), BatchId = batch.BatchId,
                        DailyLineId = line.DailyLineId, IngredientId = line.IngredientId, CanonicalUnitId = line.CanonicalUnitId };
                    materials.Add(group.Key, material);
                }
                var contribution = new ReconciliationSupplementalDemandContribution { DemandContributionId = GuidHelper.NewId(),
                    DemandDishId = dish.DemandDishId, DemandDish = dish, DemandMaterialId = material.DemandMaterialId, DemandMaterial = material,
                    FrozenContributorId = source.ContributorId, CanonicalQuantityPerServing = rate,
                    FrozenBomQuantityPerServing = source.FrozenBomQuantityPerServing!.Value,
                    FrozenBomUnitToBaseRate = source.FrozenBomUnitToBaseRate!.Value,
                    FrozenCanonicalUnitToBaseRate = source.FrozenCanonicalUnitToBaseRate!.Value,
                    WasteRatePercent = source.FrozenWasteRatePercent ?? 0, RequiredQuantity = required };
                dish.Contributions.Add(contribution); material.Contributions.Add(contribution);
            }
        }
        foreach (var material in materials.Values)
        {
            try { material.RequiredQuantity = DecimalPolicy.RoundQuantity(material.Contributions.Sum(x => x.RequiredQuantity)); }
            catch (OverflowException) { throw Invalid("Lượng nguyên liệu phát sinh vượt giới hạn lưu trữ."); }
            if (material.RequiredQuantity is <= 0 or > 999999999999.999999m)
                throw Invalid("Lượng nguyên liệu phát sinh quá nhỏ hoặc vượt giới hạn lưu trữ.");
        }
        // Hash source identities and raw conversion facts, never random child IDs or current master-data values.
        var evidence = new { BatchId = Key(batch.BatchId), Day = day, Dishes = dishes.Select(d => new {
            DishId = Key(d.DishId), d.ShiftName, d.MenuVariant, d.ExtraServings, d.FrozenDishCode, d.FrozenDishName,
            Contributions = d.Contributions.OrderBy(c => Key(c.DemandMaterial.DailyLineId), StringComparer.Ordinal).Select(c => new {
                DailyLineId = Key(c.DemandMaterial.DailyLineId), ContributorId = Key(c.FrozenContributorId),
                IngredientId = Key(c.DemandMaterial.IngredientId), UnitId = Key(c.DemandMaterial.CanonicalUnitId),
                c.FrozenBomQuantityPerServing, c.FrozenBomUnitToBaseRate, c.FrozenCanonicalUnitToBaseRate, c.WasteRatePercent }) }) };
        return new(dishes, materials.Values.ToList(), Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(evidence)))));
    }

    internal static void ValidateFacts(IReadOnlyList<ReconciliationBatchContributor> facts,
        IReadOnlyDictionary<string, ReconciliationBatchDailyLine> lines)
    {
        if (facts.Count == 0) throw Invalid("Món không có BOM đóng băng đúng lô, ngày, ca và loại suất.");
        var first = facts[0];
        if (string.IsNullOrWhiteSpace(first.FrozenDishCode) || string.IsNullOrWhiteSpace(first.FrozenDishName)
            || facts.Any(x => x.FrozenDishName != first.FrozenDishName || x.FrozenDishCode != first.FrozenDishCode))
            throw Invalid("Tên hoặc mã món trong nguồn đóng băng không thống nhất.");
        foreach (var group in facts.GroupBy(x => Key(x.DailyLineId!)))
        {
            var source = group.First();
            var line = lines[group.Key];
            if (group.Any(x => !x.BatchLineId.SequenceEqual(line.BatchLineId)
                || x.FrozenBomQuantityPerServing != source.FrozenBomQuantityPerServing
                || x.FrozenBomUnitToBaseRate != source.FrozenBomUnitToBaseRate
                || x.FrozenCanonicalUnitToBaseRate != source.FrozenCanonicalUnitToBaseRate
                || x.FrozenWasteRatePercent != source.FrozenWasteRatePercent))
                throw Invalid("BOM hoặc quy đổi đóng băng có nhiều giá trị cho cùng món và nguyên liệu.");
            if (!FrozenBomQuantityPolicy.TryGetCanonicalPerServing(source, out _))
                throw Invalid("Thiếu định lượng hoặc quy đổi BOM đóng băng. Không thể suy diễn từ BOM hiện hành.");
        }
    }

    private static string Key(byte[] id) => Convert.ToHexString(id);
    private static BusinessRuleException Invalid(string message) => new(message);
}
