FROM python:3.12-slim

WORKDIR /app/client-py

# Install client dependencies (includes maxi-format)
COPY client-py/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy client source
COPY client-py/ ./

# Shared schema (needed by loadSchema)
COPY shared/ /app/shared/

CMD ["python", "client.py"]
