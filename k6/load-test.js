import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { WebSocket } from 'k6/ws';

// Custom metrics
const errorRate = new Rate('errors');
const workflowLatency = new Trend('workflow_latency');
const optimizationLatency = new Trend('optimization_latency');
const wsMessageRate = new Rate('ws_messages');
const wsConnections = new Counter('ws_connections');
const apiCalls = new Counter('api_calls');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Warm-up
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Spike to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 50 },   // Scale down to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    'errors': ['rate<0.1'],              // Error rate should be less than 10%
    'workflow_latency': ['p(95)<1000'],  // 95% of requests should be below 1s
    'optimization_latency': ['p(95)<2000'], // 95% of optimizations should be below 2s
    'ws_messages': ['rate>0.9'],         // WebSocket message success rate should be above 90%
    'http_req_duration': ['p(95)<2000'], // 95% of requests should complete within 2s
    'http_req_failed': ['rate<0.1'],     // HTTP error rate should be below 10%
  },
};

// Simulate workflow data
const generateWorkflowData = () => ({
  name: `Test Workflow ${__VU}_${Date.now()}`,
  description: 'Test workflow for load testing',
  definition: {
    steps: [
      {
        id: 1,
        type: 'data_processing',
        config: {
          batch_size: 1000,
          timeout: 30000,
        },
      },
      {
        id: 2,
        type: 'model_inference',
        config: {
          model: 'optimization_model',
          batch_size: 32,
        },
      },
      {
        id: 3,
        type: 'data_validation',
        config: {
          validation_rules: ['completeness', 'accuracy'],
          threshold: 0.95,
        },
      },
    ],
  },
  schedule: {
    frequency: 'daily',
    startTime: '00:00',
    timezone: 'UTC',
  },
});

// WebSocket connection handler
const handleWebSocket = () => {
  const token = 'test-token';
  const ws = new WebSocket(`ws://backend:8000/ws/workflows?token=${token}&channel=workflow_updates`);
  wsConnections.add(1);

  ws.onopen = () => {
    console.log('WebSocket connected');
    ws.send(JSON.stringify({ 
      type: 'subscribe',
      token: token,
      channel: 'workflow_updates'
    }));
  };

  ws.onmessage = (event) => {
    wsMessageRate.add(1);
    try {
      const data = JSON.parse(event.data);
      check(data, {
        'message has type': (obj) => obj.type !== undefined,
        'message has valid type': (obj) => ['subscribed', 'error', 'workflow_update'].includes(obj.type),
      });

      if (data.type === 'error') {
        console.error('WebSocket error from server:', data.message);
      } else if (data.type === 'subscribed') {
        console.log('Successfully subscribed to channel:', data.channel);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    errorRate.add(1);
  };

  ws.onclose = (event) => {
    console.log(`WebSocket closed with code ${event.code}:`, event.reason);
    if (event.code !== 1000) {
      errorRate.add(1);
    }
  };

  return ws;
};

// Main test function
export default function () {
  const baseUrl = 'http://backend:8000/api';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer test-token`,
  };

  // Establish WebSocket connection
  const ws = handleWebSocket();

  // Create workflow
  const workflowData = generateWorkflowData();
  const createResponse = http.post(
    `${baseUrl}/workflows`,
    JSON.stringify(workflowData),
    { headers }
  );
  apiCalls.add(1);
  
  check(createResponse, {
    'workflow created successfully': (r) => r.status === 201,
  }) || errorRate.add(1);

  if (createResponse.status === 201) {
    const workflowId = createResponse.json('id');
    
    // Get workflow metrics
    const metricsStart = Date.now();
    const metricsResponse = http.get(
      `${baseUrl}/workflows/${workflowId}/metrics?timeRange=24h`,
      { headers }
    );
    workflowLatency.add(Date.now() - metricsStart);
    apiCalls.add(1);

    check(metricsResponse, {
      'metrics retrieved successfully': (r) => r.status === 200,
      'metrics data valid': (r) => r.json() !== undefined,
    }) || errorRate.add(1);

    // Trigger optimization
    const optimizeStart = Date.now();
    const optimizeResponse = http.post(
      `${baseUrl}/workflows/${workflowId}/optimize`,
      '',  // Our API doesn't require a body for optimization
      { headers }
    );
    optimizationLatency.add(Date.now() - optimizeStart);
    apiCalls.add(1);

    check(optimizeResponse, {
      'optimization triggered successfully': (r) => r.status === 200,
      'optimization suggestions received': (r) => r.json('suggestions') !== undefined,
    }) || errorRate.add(1);

    // Get workflow logs instead of optimization history
    const logsResponse = http.get(
      `${baseUrl}/workflows/${workflowId}/logs?timeRange=24h`,
      { headers }
    );
    apiCalls.add(1);

    check(logsResponse, {
      'logs retrieved successfully': (r) => r.status === 200,
      'logs data valid': (r) => Array.isArray(r.json()),
    }) || errorRate.add(1);

    // Update workflow status after optimization
    if (optimizeResponse.status === 200) {
      const updateResponse = http.put(
        `${baseUrl}/workflows/${workflowId}`,
        JSON.stringify({
          ...workflowData,
          status: 'optimized',
          last_optimization: new Date().toISOString(),
        }),
        { headers }
      );
      apiCalls.add(1);

      check(updateResponse, {
        'workflow updated successfully': (r) => r.status === 200,
      }) || errorRate.add(1);
    }
  }

  // Get metrics summary instead of dashboard
  const summaryResponse = http.get(
    `${baseUrl}/workflows/metrics?timeRange=24h`,
    { headers }
  );
  apiCalls.add(1);

  check(summaryResponse, {
    'metrics summary retrieved successfully': (r) => r.status === 200,
    'metrics summary valid': (r) => Array.isArray(r.json()),
  }) || errorRate.add(1);

  // Close WebSocket connection
  ws.close();
  
  // Random sleep between 1-5 seconds to simulate real user behavior
  sleep(Math.random() * 4 + 1);
} 