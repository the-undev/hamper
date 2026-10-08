BACKEND := backend
FRONTEND := frontend
SLN := $(BACKEND)/Hamper.slnx

.PHONY: setup dev live-test check image \
	backend-build backend-format backend-test \
	frontend-lint frontend-typecheck frontend-test frontend-build

setup:
	dotnet restore $(SLN)
	pnpm -C $(FRONTEND) install

# The API in the background and Vite in the foreground; the trap stops the API when Vite exits.
dev:
	dotnet run --project $(BACKEND)/src/Hamper.Api --launch-profile http & \
	api_pid=$$!; \
	trap 'kill $$api_pid 2>/dev/null' EXIT INT TERM; \
	pnpm -C $(FRONTEND) dev

# The API alone on its own port, database and data directory, clear of the dev database.
LIVE_TEST_DIR ?= /tmp/hamper-live-test
live-test:
	mkdir -p $(LIVE_TEST_DIR)
	cd $(BACKEND)/src/Hamper.Api && \
	ASPNETCORE_URLS=http://127.0.0.1:8777 \
	ConnectionStrings__Hamper="Data Source=$(LIVE_TEST_DIR)/live-test.db" \
	Storage__DataDir=$(LIVE_TEST_DIR)/data \
	dotnet run --no-launch-profile

# VERSION=x.y.z stamps the build and tags the image; without it both stay 0.0.0-dev.
IMAGE ?= hamper
GIT_SHA := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
VERSION ?=
BUILD_VERSION := $(if $(VERSION),$(VERSION),0.0.0-dev)
BUILD_INFORMATIONAL_VERSION := $(if $(VERSION),$(VERSION)+$(GIT_SHA),0.0.0-dev)

image:
	docker build \
		--build-arg VERSION=$(BUILD_VERSION) \
		--build-arg INFORMATIONAL_VERSION=$(BUILD_INFORMATIONAL_VERSION) \
		-t $(IMAGE):$(BUILD_VERSION) .

check: backend-build backend-format backend-test \
	frontend-lint frontend-typecheck frontend-test frontend-build
	@echo "All checks passed."

backend-build:
	dotnet build $(SLN)

backend-format:
	dotnet format $(SLN) --verify-no-changes

backend-test:
	dotnet test $(SLN)

frontend-lint:
	pnpm -C $(FRONTEND) lint

frontend-typecheck:
	pnpm -C $(FRONTEND) typecheck

frontend-test:
	pnpm -C $(FRONTEND) test

frontend-build:
	pnpm -C $(FRONTEND) build
