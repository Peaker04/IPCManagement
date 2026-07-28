FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

WORKDIR /src

# Restore trước để tận dụng Docker layer cache khi source code thay đổi.
COPY backend/src/IPCManagement.Api/IPCManagement.Api.csproj backend/src/IPCManagement.Api/
RUN dotnet restore backend/src/IPCManagement.Api/IPCManagement.Api.csproj

COPY backend/src/IPCManagement.Api/ backend/src/IPCManagement.Api/

RUN dotnet publish backend/src/IPCManagement.Api/IPCManagement.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime

WORKDIR /app

# Render Web Service dùng port 10000 mặc định.
ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "IPCManagement.Api.dll"]
