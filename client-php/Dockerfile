FROM php:8.2-cli

WORKDIR /app/client-php

# Install runtime dependencies needed by Composer
RUN apt-get update && apt-get install -y --no-install-recommends unzip git && rm -rf /var/lib/apt/lists/*

# Install composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Copy client source and install dependencies
COPY client-php/ ./
RUN composer update --no-interaction --no-progress

# Copy shared schema files (needed for loadSchema)
COPY shared/ /app/shared/

CMD ["php", "client.php"]
