FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Aloca.Api/Aloca.Api.csproj Aloca.Api/
RUN dotnet restore Aloca.Api/Aloca.Api.csproj

COPY Aloca.Api/ Aloca.Api/
RUN dotnet publish Aloca.Api/Aloca.Api.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080

RUN apt-get update \
    && apt-get install --no-install-recommends --yes curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .
COPY Aloca.Api/docker-entrypoint.sh /usr/local/bin/aloca-api-entrypoint
RUN chmod 0755 /usr/local/bin/aloca-api-entrypoint \
    && mkdir -p /app/data-protection-keys \
    && chown -R $APP_UID:$APP_UID /app

USER $APP_UID
ENTRYPOINT ["/usr/local/bin/aloca-api-entrypoint"]
