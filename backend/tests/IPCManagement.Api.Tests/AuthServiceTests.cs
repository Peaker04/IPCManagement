using System;
using System.Threading.Tasks;
using FluentAssertions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using NSubstitute;
using Microsoft.Extensions.Logging;
using Xunit;

namespace IPCManagement.Api.Tests;

public class AuthServiceTests
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService _tokenService;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly ILogger<AuthService> _logger;
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        _userRepository = Substitute.For<IUserRepository>();
        _tokenService = Substitute.For<ITokenService>();
        _refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        _logger = Substitute.For<ILogger<AuthService>>();

        _service = new AuthService(
            _userRepository,
            _tokenService,
            _refreshTokenRepository,
            _logger);
    }

    [Fact]
    public async Task GetProfileAsync_Should_ReturnUserInfo_When_UserExistsAndActive()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var userIdString = userId.ToString();
        var userIdBytes = GuidHelper.ParseGuidString(userIdString)!;

        var role = new Role { RoleName = "Admin" };
        var user = new User
        {
            UserId = userIdBytes,
            Username = "testuser",
            FullName = "Test User",
            IsActive = true,
            Role = role
        };

        _userRepository.GetWithRoleAsync(Arg.Is<byte[]>(b => System.Linq.Enumerable.SequenceEqual(b, userIdBytes)))
            .Returns(user);

        // Act
        var result = await _service.GetProfileAsync(userIdString);

        // Assert
        result.Should().NotBeNull();
        result!.UserId.Should().Be(userIdString);
        result.Username.Should().Be("testuser");
        result.FullName.Should().Be("Test User");
        result.RoleName.Should().Be("Admin");
        result.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task GetProfileAsync_Should_ReturnNull_When_UserDoesNotExist()
    {
        // Arrange
        var userIdString = Guid.NewGuid().ToString();
        var userIdBytes = GuidHelper.ParseGuidString(userIdString)!;

        _userRepository.GetWithRoleAsync(Arg.Any<byte[]>())
            .Returns((User?)null);

        // Act
        var result = await _service.GetProfileAsync(userIdString);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetProfileAsync_Should_ReturnNull_When_UserIsInactive()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var userIdString = userId.ToString();
        var userIdBytes = GuidHelper.ParseGuidString(userIdString)!;

        var role = new Role { RoleName = "Admin" };
        var user = new User
        {
            UserId = userIdBytes,
            Username = "testuser",
            FullName = "Test User",
            IsActive = false,
            Role = role
        };

        _userRepository.GetWithRoleAsync(Arg.Is<byte[]>(b => System.Linq.Enumerable.SequenceEqual(b, userIdBytes)))
            .Returns(user);

        // Act
        var result = await _service.GetProfileAsync(userIdString);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetProfileAsync_Should_ReturnDemandPermissionOnly_ForCoordinator()
    {
        var userId = Guid.NewGuid();
        var userIdString = userId.ToString();
        var userIdBytes = GuidHelper.ParseGuidString(userIdString)!;
        var user = new User
        {
            UserId = userIdBytes,
            Username = "dieuphoi",
            FullName = "Điều phối",
            IsActive = true,
            Role = new Role { RoleCode = "COORDINATOR", RoleName = "Điều phối" }
        };

        _userRepository.GetWithRoleAsync(Arg.Is<byte[]>(b => System.Linq.Enumerable.SequenceEqual(b, userIdBytes)))
            .Returns(user);

        var result = await _service.GetProfileAsync(userIdString);

        result.Should().NotBeNull();
        result!.Permissions.Should().Contain(AuthorizationPolicies.DemandGenerate);
        result.Permissions.Should().NotContain(AuthorizationPolicies.PurchaseGenerate);
    }

    [Fact]
    public async Task GetProfileAsync_Should_ReturnPurchasePermissionOnly_ForPurchasing()
    {
        var userId = Guid.NewGuid();
        var userIdString = userId.ToString();
        var userIdBytes = GuidHelper.ParseGuidString(userIdString)!;
        var user = new User
        {
            UserId = userIdBytes,
            Username = "thumua",
            FullName = "Thu mua",
            IsActive = true,
            Role = new Role { RoleCode = "PURCHASING", RoleName = "Thu mua" }
        };

        _userRepository.GetWithRoleAsync(Arg.Is<byte[]>(b => System.Linq.Enumerable.SequenceEqual(b, userIdBytes)))
            .Returns(user);

        var result = await _service.GetProfileAsync(userIdString);

        result.Should().NotBeNull();
        result!.Permissions.Should().Contain(AuthorizationPolicies.PurchaseRead);
        result.Permissions.Should().Contain(AuthorizationPolicies.PurchaseGenerate);
        result.Permissions.Should().NotContain(AuthorizationPolicies.DemandGenerate);
    }
}
