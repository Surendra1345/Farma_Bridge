# Farma Bridge API
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first (cached until pyproject.toml changes). The dev group (httpx)
# is included so scripts/seed_demo.py can run inside the container.
COPY pyproject.toml ./
RUN python -c "import tomllib; p = tomllib.load(open('pyproject.toml', 'rb')); print('\n'.join(p['project']['dependencies'] + p.get('dependency-groups', {}).get('dev', [])))" > /tmp/requirements.txt \
 && pip install -r /tmp/requirements.txt

COPY src ./src
COPY scripts ./scripts
COPY docker-entrypoint.sh ./

# Run as an unprivileged user; uploads live in a volume owned by that user.
RUN useradd --create-home --uid 1000 app \
 && mkdir -p static/uploads \
 && chown -R app:app /app \
 && chmod +x docker-entrypoint.sh
USER app

ENV PYTHONPATH=/app/src/farma_bridge
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/crop-listings', timeout=2)"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "src/farma_bridge", "--proxy-headers", "--forwarded-allow-ips", "*"]
