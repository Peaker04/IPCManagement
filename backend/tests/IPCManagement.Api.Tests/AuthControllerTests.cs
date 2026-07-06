using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Auth;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class AuthControllerTests
{
    private readonly IAuthService _authService = Substitute.For<IAuthService>();
    private readonly ICurrentUserService _currentUserService = Substitute.For<ICurrentUserService>();
    private readonly ITokenService _tokenService = Substitute.For<ITokenService>();

    [Fact]
    public async Task Login_Should_SetRefreshCookie_But_Not_ExposeRefreshTokenInBody()
    {
        var controller = CreateController();
        _tokenService.GetRefreshTokenExpiryDays().Returns(30);
        _authService.LoginAsync(Arg.Any<LoginRequestDto>(), Arg.Any<string>())
            .Returns(BuildLoginResponse("raw-refresh-token"));

        var result = await controller.Login(new LoginRequestDto { Username = "admin", Password = "admin" });

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<ApiResponse<LoginResponseDto>>().Subject;
        response.Data!.AccessToken.Should().Be("access-token");
        response.Data.RefreshToken.Should().BeEmpty();
        controller.Response.Headers.SetCookie.ToString().Should().Contain("refreshToken=raw-refresh-token");
    }

    [Fact]
    public async Task Refresh_Should_ReadRefreshCookie_But_Not_ExposeRotatedRefreshTokenInBody()
    {
        var controller = CreateController();
        controller.Request.Headers.Cookie = "refreshToken=old-refresh-token";
        _tokenService.GetRefreshTokenExpiryDays().Returns(30);
        _authService.RefreshTokenAsync(Arg.Is<RefreshTokenRequestDto>(request =>
                request.AccessToken == "expired-access-token" &&
                request.RefreshToken == "old-refresh-token"))
            .Returns(BuildLoginResponse("new-refresh-token"));

        var result = await controller.Refresh(new RefreshTokenRequestDto { AccessToken = "expired-access-token" });

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<ApiResponse<LoginResponseDto>>().Subject;
        response.Data!.AccessToken.Should().Be("access-token");
        response.Data.RefreshToken.Should().BeEmpty();
        controller.Response.Headers.SetCookie.ToString().Should().Contain("refreshToken=new-refresh-token");
    }

    private AuthController CreateController()
    {
        var controller = new AuthController(_authService, _currentUserService, _tokenService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
        controller.Request.Headers.UserAgent = "test-agent";
        return controller;
    }

    private static LoginResponseDto BuildLoginResponse(string refreshToken)
        => new()
        {
            AccessToken = "access-token",
            RefreshToken = refreshToken,
            TokenType = "Bearer",
            ExpiresIn = 900,
            User = new UserInfoDto
            {
                UserId = Guid.NewGuid().ToString(),
                Username = "admin",
                FullName = "Admin",
                RoleCode = "ADMIN",
                RoleName = "Admin",
                IsActive = true,
                IsAdminFullAccess = true
            }
        };
}
