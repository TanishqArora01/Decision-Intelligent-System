FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    librdkafka-dev libpq-dev gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
RUN useradd -r -u 1011 feedbacksvc
USER feedbacksvc
EXPOSE 8500 9110
ENTRYPOINT ["python", "main.py"]
