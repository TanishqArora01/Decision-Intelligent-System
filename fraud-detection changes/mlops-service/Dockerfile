FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    librdkafka-dev gcc && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir \
    fastapi==0.111.0 uvicorn[standard]==0.29.0 \
    confluent-kafka==2.3.0 prometheus-client==0.20.0 \
    mlflow==2.13.0 httpx==0.27.0
COPY main.py .
RUN useradd -r -u 1013 mlopsvc
USER mlopsvc
EXPOSE 8700 9111
ENTRYPOINT ["python", "main.py"]
