# The API serving the built frontend from its own wwwroot.

FROM node:24-alpine AS frontend
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /src/frontend
# Dependencies first, so the layer survives every change that is not a lockfile change.
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
# Unstamped builds keep 0.0.0-dev; `make image VERSION=x.y.z` stamps both.
ARG VERSION=0.0.0-dev
ARG INFORMATIONAL_VERSION=0.0.0-dev
WORKDIR /src
# EnforceCodeStyleInBuild reads .editorconfig and warnings are errors.
COPY .editorconfig ./
COPY backend/Directory.Build.props ./backend/
COPY backend/src/ ./backend/src/
RUN dotnet publish backend/src/Hamper.Api -c Release -o /app \
    -p:Version=$VERSION \
    -p:InformationalVersion=$INFORMATIONAL_VERSION

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=backend /app ./
COPY --from=frontend /src/frontend/dist ./wwwroot
# One /data volume holds everything mutable: the database and the images.
ENV ASPNETCORE_URLS=http://+:8080 \
    ConnectionStrings__Hamper="Data Source=/data/hamper.db" \
    Storage__DataDir=/data
RUN mkdir -p /data
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["dotnet", "Hamper.Api.dll"]
