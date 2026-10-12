# Build from the repository root:  docker build -f python/Dockerfile -t carvalue-ml-python .
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CAR_PRICE_DATA=/app/data/used_cars.csv

WORKDIR /app
COPY python/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY python/ ./
COPY data/raw/used_cars.csv ./data/used_cars.csv

# Train during the build so the image ships with a model artifact and figures.
RUN python -m car_price.train

EXPOSE 8000 8501
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
