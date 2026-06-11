FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    librdkafka-dev gcc && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir \
    fastapi==0.111.0 uvicorn[standard]==0.29.0 \
    confluent-kafka==2.3.0 prometheus-client==0.20.0 \
    pydantic==2.7.1 minio==7.2.7 pyarrow==16.0.0
COPY . .
RUN useradd -r -u 1012 adaptersvc
USER adaptersvc
EXPOSE 8600
ENTRYPOINT ["python", "webhook/adapter.py"]
