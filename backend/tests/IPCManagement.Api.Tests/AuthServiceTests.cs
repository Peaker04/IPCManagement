using System;
using System.Threading.Tasks;
using FluentAssertions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using NSubstitute;
using Microsoft.Extensions.Logging;
using Xunit;
using IPCManagement.Api.Features.Auth.Services;
using IPCManagement.Api.Features.Auth.Contracts;
using IPCManagement.Api.Data.Transactions;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace IPCManagement.Api.Tests;

public class AuthServiceTests
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService _tokenService;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly ILogger<AuthService> _logger;
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        _userRepository = Substitute.For<IUserRepository>();
        _tokenService = Substitute.For<ITokenService>();
        _refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        _transactionRunner = Substitute.For<IEfTransactionRunner>();
        _logger = Substitute.For<ILogger<AuthService>>();

        _transactionRunner.ExecuteAsync(
                Arg.Any<Func<CancellationToken, Task>>(),
                Arg.Any<Func<CancellationToken, Task<bool>>>(),
                Arg.Any<IsolationLevel>(),
                Arg.Any<CancellationToken>())
            .Returns(call => call.ArgAt<Func<CancellationToken, Task>>(0)(CancellationToken.None));

        _service = new AuthService(
            _userRepository,
            _tokenService,
            _refreshTokenRepository,
            _transactionRunner,
            _logger);
    }

    [Fact]
    public async Task LoginAsync_Should_PrepareBoundedDeviceSessionBeforeAddingRefreshToken()
    {
        var userId = GuidHelper.NewId();
        _userRepository.FindByUsernameAsync("admin").Returns(new User
        {
            UserId = userId,
            Username = "admin",
            FullName = "Admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("secret", workFactor: 4),
            IsActive = true,
            Role = new Role { RoleCode = "ADMIN", RoleName = "Admin" }
        });
        _tokenService.GenerateRefreshToken().Returns("refresh-token");
        _tokenService.HashRefreshToken("refresh-token").Returns(new string('a', 64));
        _tokenService.GetRefreshTokenExpiryDays().Returns(30);
        _tokenService.GenerateAccessToken(Arg.Any<string>(), "admin", "Admin", "Admin")
            .Returns("access-token");

        var result = await _service.LoginAsync(
            new LoginRequest { Username = "admin", Password = "secret" },
            "test-device");

        result.Should().NotBeNull();
        Received.InOrder(() =>
        {
            _refreshTokenRepository.PrepareForLoginAsync(userId, "test-device", 9);
            _refreshTokenRepository.Add(Arg.Any<RefreshToken>());
            _refreshTokenRepository.SaveChangesAsync();
        });
    }

    [Fact]
    public async Task RefreshTokenAsync_Should_RotateOldAndNewTokensInOneTransaction()
    {
        var userId = Guid.NewGuid();
        var userIdBytes = GuidHelper.ParseGuidString(userId.ToString())!;
        var stored = new RefreshToken
        {
            TokenId = GuidHelper.NewId(),
            UserId = userIdBytes,
            TokenHash = new string('a', 64),
            ExpiresAt = DateTime.UtcNow.AddDays(1),
            User = new User
            {
                UserId = userIdBytes,
                Username = "admin",
                FullName = "Admin",
                Role = new Role { RoleCode = "ADMIN", RoleName = "Admin" }
            }
        };
        _tokenService.GetPrincipalFromExpiredToken("access-token").Returns(
            new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString())
            ])));
        _tokenService.HashRefreshToken("old-refresh-token").Returns(stored.TokenHash);
        _refreshTokenRepository.FindValidByHashAsync(stored.TokenHash, Arg.Any<byte[]>()).Returns(stored);
        _tokenService.GenerateRefreshToken().Returns("new-refresh-token");
        _tokenService.HashRefreshToken("new-refresh-token").Returns(new string('b', 64));
        _tokenService.GetRefreshTokenExpiryDays().Returns(30);
        _tokenService.GenerateAccessToken(Arg.Any<string>(), "admin", "Admin", "Admin")
            .Returns("new-access-token");

        var result = await _service.RefreshTokenAsync(new RefreshTokenRequest
        {
            AccessToken = "access-token",
            RefreshToken = "old-refresh-token"
        });

        result.Should().NotBeNull();
        stored.IsUsed.Should().BeTrue();
        stored.IsRevoked.Should().BeTrue();
        stored.ReplacedByToken.Should().Be(new string('b', 64));
        _refreshTokenRepository.Received(1).Add(Arg.Is<RefreshToken>(token =>
            token.TokenHash == new string('b', 64)));
        await _refreshTokenRepository.Received(1).SaveChangesAsync();
        await _transactionRunner.Received(1).ExecuteAsync(
            Arg.Any<Func<CancellationToken, Task>>(),
            Arg.Any<Func<CancellationToken, Task<bool>>>(),
            Arg.Any<IsolationLevel>(),
            Arg.Any<CancellationToken>());
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

    [Fact]
    public async Task GetProfileAsync_Should_ReturnApprovalPermissions_ForManager()
    {
        var userId = Guid.NewGuid();
        var userIdString = userId.ToString();
        var userIdBytes = GuidHelper.ParseGuidString(userIdString)!;
        var user = new User
        {
            UserId = userIdBytes,
            Username = "quanly",
            FullName = "Quản lý",
            IsActive = true,
            Role = new Role { RoleCode = "MANAGER", RoleName = "Quản lý" }
        };

        _userRepository.GetWithRoleAsync(Arg.Is<byte[]>(b => System.Linq.Enumerable.SequenceEqual(b, userIdBytes)))
            .Returns(user);

        var result = await _service.GetProfileAsync(userIdString);

        result.Should().NotBeNull();
        result!.Permissions.Should().Contain(AuthorizationPolicies.PurchaseRequestApprove);
        result.Permissions.Should().Contain(AuthorizationPolicies.PurchasePriceExceptionApprove);
    }
}
