#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting AetherIQ deployment and testing..."

# Check for existing Docker containers and stop them
echo "🔍 Checking for existing containers..."
if [ "$(docker ps -q)" ]; then
    echo "⚠️ Found running containers. Stopping them..."
    docker-compose down
fi

# Clean up any dangling resources
echo "🧹 Cleaning up resources..."
docker system prune -f

# Build and start services
echo "📦 Building and starting services..."
docker-compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check if services are running properly
echo "🔍 Verifying service health..."
for service in frontend backend db redis prometheus grafana; do
    if ! docker-compose ps $service | grep -q "Up"; then
        echo "❌ Service $service failed to start"
        docker-compose logs $service
        exit 1
    fi
done

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose exec backend alembic upgrade head

# Run load tests
echo "🧪 Running load tests..."
docker-compose run k6 k6 run /scripts/load-test.js

# Generate test report
echo "📊 Generating test report..."
docker-compose exec prometheus promtool query instant http://localhost:9090 'up' > test-report.txt
docker-compose exec prometheus promtool query instant http://localhost:9090 'rate(http_requests_total[5m])' >> test-report.txt
docker-compose exec prometheus promtool query instant http://localhost:9090 'rate(errors_total[5m])' >> test-report.txt

echo "✅ Deployment and testing completed!"
echo "📈 View test results in test-report.txt"
echo "📊 Access Grafana dashboard at http://localhost:3001"
echo "📊 Access Prometheus at http://localhost:9090"

# Add cleanup on script exit
trap 'echo "🧹 Cleaning up..."; docker-compose down' EXIT 