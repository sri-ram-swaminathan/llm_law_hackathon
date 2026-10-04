# Context = repo root (needs data/ and contracts/). Layout mirrors the repo: cco.config uses parents[2] as REPO_ROOT.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1 \
    PATH="/app/backend/.venv/bin:$PATH" CCO_DATA_DIR=/app/data/runtime
RUN useradd --create-home --uid 10001 cco
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
COPY backend/cco ./cco
RUN uv sync --frozen --no-dev
COPY data /app/data
COPY contracts /app/contracts
RUN mkdir -p /app/data/runtime && chown -R cco:cco /app/data/runtime
USER cco
EXPOSE 20000
CMD ["sh", "-c", "python -m cco.seed && exec uvicorn cco.main:app --host 0.0.0.0 --port 20000 --workers 1"]
