FROM python:3.10-slim

# libgomp1 is required at runtime by xgboost (OpenMP) — without it, importing
# xgboost raises "libgomp.so.1: cannot open shared object file".
# build-essential ensures shap's C extensions can compile if no prebuilt
# wheel is available for this platform.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces convention: run as a non-root user with UID 1000
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

COPY --chown=user requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY --chown=user . /app

# Hugging Face Spaces only routes public traffic to port 7860
EXPOSE 7860

# workers=1 keeps memory use predictable (each worker holds its own copy of
# the model in memory); timeout is raised because SHAP's KernelExplainer
# fallback can be slow on the first request.
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "--workers", "1", "--timeout", "120", "app:app"]