FROM python:3.12-slim

WORKDIR /app/server-py

# Install server dependencies (includes maxi-format)
COPY server-py/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy server source
COPY server-py/ ./

# Shared schema + seed data — baked into image, never written to
COPY shared/ /app/shared/

EXPOSE 5000
CMD ["python", "server.py"]
