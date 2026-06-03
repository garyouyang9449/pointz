# --- Build stage ---
FROM rust:1.83-slim-bookworm AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config ca-certificates && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock* ./
COPY src ./src
RUN cargo build --release --bins

# --- Runtime stage ---
FROM debian:bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/pointz-server /usr/local/bin/pointz-server
COPY --from=build /app/target/release/migrate       /usr/local/bin/pointz-migrate
COPY --from=build /app/target/release/seed          /usr/local/bin/pointz-seed
COPY --from=build /app/target/release/sync-cards    /usr/local/bin/pointz-sync-cards
COPY db ./db
ENV RUST_LOG=info
EXPOSE 3000
CMD ["pointz-server"]
