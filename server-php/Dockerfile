FROM php:8.2-cli

WORKDIR /app/server-php

# Install runtime dependencies needed by Composer
RUN apt-get update && apt-get install -y --no-install-recommends unzip git && rm -rf /var/lib/apt/lists/*

# Install composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Copy server source (including composer.json) and install dependencies
COPY server-php/ ./
RUN composer update --no-interaction --no-progress

# Shared schema + seed data — baked into image, never written to
COPY shared/ /app/shared/

EXPOSE 8080
CMD ["php", "-S", "0.0.0.0:8080", "server.php"]
