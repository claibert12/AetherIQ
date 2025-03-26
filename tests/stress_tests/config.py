"""
Stress Test Configuration
"""
from typing import Dict, Any

# Base test configuration
BASE_CONFIG: Dict[str, Any] = {
    'base_url': 'http://localhost:8000',  # Base URL for API endpoints
    'test_duration': 300,  # 5 minutes per test
    'ramp_up_time': 60,  # 1 minute ramp-up
    'request_timeout': 30,  # 30 seconds timeout for requests
    'monitoring_interval': 1,  # 1 second interval for resource monitoring
}

# Test scenarios configuration
TEST_SCENARIOS = {
    'workflow_optimization': {
        'endpoints': [
            '/api/workflow/optimize',
            '/api/workflow/analyze',
            '/api/workflow/execute'
        ],
        'weight': 0.4  # 40% of requests
    },
    'security_compliance': {
        'endpoints': [
            '/api/security/check',
            '/api/compliance/validate',
            '/api/audit/log'
        ],
        'weight': 0.3  # 30% of requests
    },
    'resource_management': {
        'endpoints': [
            '/api/resources/allocate',
            '/api/resources/monitor',
            '/api/resources/optimize'
        ],
        'weight': 0.3  # 30% of requests
    }
}

# User load configurations
USER_LOAD_STEPS = [
    {'users': 500, 'duration': 300},   # 500 users for 5 minutes
    {'users': 1000, 'duration': 300},  # 1000 users for 5 minutes
    {'users': 1500, 'duration': 300},  # 1500 users for 5 minutes
    {'users': 2000, 'duration': 300}   # 2000 users for 5 minutes
]

# Monitoring thresholds
THRESHOLDS = {
    'cpu_threshold': 80,  # 80% CPU usage threshold
    'memory_threshold': 80,  # 80% memory usage threshold
    'response_time_threshold': 2.0,  # 2 seconds response time threshold
    'error_rate_threshold': 0.05  # 5% error rate threshold
}

# Reporting configuration
REPORT_CONFIG = {
    'metrics_output_dir': 'stress_test_results',
    'plot_formats': ['png', 'svg'],
    'save_raw_data': True,
    'generate_html_report': True
} 