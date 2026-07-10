using FluentAssertions;
using FluentValidation;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Ingredient;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.DTOs.Supplier;
using IPCManagement.Api.Models.Validators;

namespace IPCManagement.Api.Tests;

public class BoundaryValueAndValidationTests
{
    [Theory]
    [InlineData(-1, 1)]
    [InlineData(0, 1)]
    [InlineData(1, 1)]
    [InlineData(2, 2)]
    public void PagedRequestDto_Should_ClampPageNumber_AtLowerBoundary(
        int input,
        int expected)
    {
        var request = new PagedRequestDto { PageNumber = input };

        request.PageNumber.Should().Be(expected);
    }

    [Theory]
    [InlineData(-1, 1)]
    [InlineData(0, 1)]
    [InlineData(1, 1)]
    [InlineData(100, 100)]
    [InlineData(101, 100)]
    public void PagedRequestDto_Should_ClampPageSize_ToSupportedRange(
        int input,
        int expected)
    {
        var request = new PagedRequestDto { PageSize = input };

        request.PageSize.Should().Be(expected);
    }

    [Theory]
    [InlineData("0.0000004", "0")]
    [InlineData("0.0000005", "0.000001")]
    [InlineData("1.2345674", "1.234567")]
    [InlineData("1.2345675", "1.234568")]
    public void DecimalPolicy_Should_RoundQuantity_AtPrecisionBoundary(
        string rawValue,
        string expectedValue)
    {
        var result = DecimalPolicy.RoundQuantity(decimal.Parse(rawValue));

        result.Should().Be(decimal.Parse(expectedValue));
    }

    [Fact]
    public void CreateIngredientValidator_Should_AcceptBoundaryLengths_AndZeroReferencePrice()
    {
        var dto = new CreateIngredientDto
        {
            IngredientCode = new string('A', 50),
            IngredientName = new string('B', 200),
            ReferencePrice = 0,
            UnitId = Guid.NewGuid().ToString(),
            WarehouseId = Guid.NewGuid().ToString()
        };

        var result = new CreateIngredientDtoValidator().Validate(dto);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void CreateIngredientValidator_Should_RejectOutOfBoundaryValues()
    {
        var dto = new CreateIngredientDto
        {
            IngredientCode = new string('A', 51),
            IngredientName = new string('B', 201),
            ReferencePrice = -0.01m,
            UnitId = "not-a-guid",
            WarehouseId = string.Empty
        };

        var result = new CreateIngredientDtoValidator().Validate(dto);

        result.IsValid.Should().BeFalse();
        result.Errors.Select(error => error.PropertyName).Should().Contain(
            nameof(CreateIngredientDto.IngredientCode),
            nameof(CreateIngredientDto.IngredientName),
            nameof(CreateIngredientDto.ReferencePrice),
            nameof(CreateIngredientDto.UnitId),
            nameof(CreateIngredientDto.WarehouseId));
    }

    [Fact]
    public void UpdateIngredientValidator_Should_ValidateOnlyProvidedOptionalFields()
    {
        var validPatch = new UpdateIngredientDto();
        var invalidPatch = new UpdateIngredientDto
        {
            IngredientName = new string('N', 201),
            ReferencePrice = -1,
            UnitId = "bad-unit",
            WarehouseId = "bad-warehouse"
        };

        new UpdateIngredientDtoValidator().Validate(validPatch).IsValid.Should().BeTrue();
        var invalidResult = new UpdateIngredientDtoValidator().Validate(invalidPatch);

        invalidResult.Errors.Select(error => error.PropertyName).Should().Contain(
            nameof(UpdateIngredientDto.IngredientName),
            nameof(UpdateIngredientDto.ReferencePrice),
            nameof(UpdateIngredientDto.UnitId),
            nameof(UpdateIngredientDto.WarehouseId));
    }

    [Theory]
    [MemberData(nameof(ReceiptDateBoundaryCases))]
    public void CreateInventoryReceiptValidator_Should_EnforceDateBoundary(
        DateOnly receiptDate,
        bool expectedValid)
    {
        var dto = BuildValidReceipt();
        dto.ReceiptDate = receiptDate;

        var result = new CreateInventoryReceiptDtoValidator().Validate(dto);

        result.IsValid.Should().Be(expectedValid);
    }

    public static TheoryData<DateOnly, bool> ReceiptDateBoundaryCases()
        => new()
        {
            { DateOnly.FromDateTime(DateTime.Today.AddDays(1)), true },
            { DateOnly.FromDateTime(DateTime.Today.AddDays(2)), false }
        };

    [Theory]
    [InlineData("0", false)]
    [InlineData("0.000001", true)]
    public void CreateInventoryReceiptLineValidator_Should_EnforceQuantityLowerBoundary(
        string quantity,
        bool expectedValid)
    {
        var dto = BuildValidReceiptLine();
        dto.Quantity = decimal.Parse(quantity);

        var result = new CreateInventoryReceiptLineDtoValidator().Validate(dto);

        result.IsValid.Should().Be(expectedValid);
    }

    [Fact]
    public void CreateInventoryReceiptLineValidator_Should_RejectExpiryBeforeOrEqualManufactureDate()
    {
        var validator = new CreateInventoryReceiptLineDtoValidator();
        var manufactureDate = new DateOnly(2026, 7, 10);
        var equalDate = BuildValidReceiptLine();
        equalDate.ManufactureDate = manufactureDate;
        equalDate.ExpiredDate = manufactureDate;
        var nextDate = BuildValidReceiptLine();
        nextDate.ManufactureDate = manufactureDate;
        nextDate.ExpiredDate = manufactureDate.AddDays(1);

        validator.Validate(equalDate).IsValid.Should().BeFalse();
        validator.Validate(nextDate).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("10", "10", true)]
    [InlineData("11", "10", false)]
    [InlineData("0", "10", false)]
    public void CreateInventoryIssueLineValidator_Should_RejectIssuedQtyOutsideRequestedBoundary(
        string issuedQty,
        string requestedQty,
        bool expectedValid)
    {
        var dto = new CreateInventoryIssueLineDto
        {
            IngredientId = Guid.NewGuid().ToString(),
            UnitId = Guid.NewGuid().ToString(),
            IssuedQty = decimal.Parse(issuedQty),
            RequestedQty = decimal.Parse(requestedQty)
        };

        var result = new CreateInventoryIssueLineDtoValidator().Validate(dto);

        result.IsValid.Should().Be(expectedValid);
    }

    [Theory]
    [InlineData("RETURN", true)]
    [InlineData("WASTE", true)]
    [InlineData("return", true)]
    [InlineData("SCRAP", false)]
    public void CreateInventoryReturnValidator_Should_PartitionReturnTypes(
        string returnType,
        bool expectedValid)
    {
        var dto = new CreateInventoryReturnDto
        {
            ReturnDate = new DateOnly(2026, 7, 10),
            WarehouseId = Guid.NewGuid().ToString(),
            IssueId = Guid.NewGuid().ToString(),
            ReturnType = returnType,
            Reason = "Đối chiếu cuối ca",
            Lines =
            [
                new CreateInventoryReturnLineDto
                {
                    IngredientId = Guid.NewGuid().ToString(),
                    UnitId = Guid.NewGuid().ToString(),
                    Quantity = 1
                }
            ]
        };

        var result = new CreateInventoryReturnDtoValidator().Validate(dto);

        result.IsValid.Should().Be(expectedValid);
    }

    [Theory]
    [InlineData(255, true)]
    [InlineData(256, false)]
    public void SupplierQuotationValidators_Should_EnforceNoteLengthBoundary(
        int noteLength,
        bool expectedValid)
    {
        var dto = new CreateSupplierQuotationDto
        {
            SupplierId = Guid.NewGuid().ToString(),
            IngredientId = Guid.NewGuid().ToString(),
            UnitPrice = 1,
            EffectiveFrom = "2026-07-10",
            Note = new string('N', noteLength)
        };

        var result = new CreateSupplierQuotationDtoValidator().Validate(dto);

        result.IsValid.Should().Be(expectedValid);
    }

    [Theory]
    [InlineData("0", false)]
    [InlineData("0.01", true)]
    public void SupplierQuotationValidators_Should_EnforceUnitPriceLowerBoundary(
        string unitPrice,
        bool expectedValid)
    {
        var dto = new UpdateSupplierQuotationDto
        {
            UnitPrice = decimal.Parse(unitPrice),
            EffectiveFrom = "2026-07-10",
            Note = null,
            IsActive = true
        };

        var result = new UpdateSupplierQuotationDtoValidator().Validate(dto);

        result.IsValid.Should().Be(expectedValid);
    }

    private static CreateInventoryReceiptDto BuildValidReceipt()
        => new()
        {
            ReceiptDate = DateOnly.FromDateTime(DateTime.Today),
            SupplierId = Guid.NewGuid().ToString(),
            WarehouseId = Guid.NewGuid().ToString(),
            Lines = [BuildValidReceiptLine()]
        };

    private static CreateInventoryReceiptLineDto BuildValidReceiptLine()
        => new()
        {
            IngredientId = Guid.NewGuid().ToString(),
            Quantity = 1,
            UnitId = Guid.NewGuid().ToString(),
            UnitPrice = 0
        };
}
