"""
Metrics Collector for Stress Tests
"""
import time
import psutil
from datetime import datetime
from typing import Dict, List, Any
import numpy as np
from dataclasses import dataclass, asdict
import json
import os
import matplotlib.pyplot as plt
from tests.stress_tests.config import THRESHOLDS, REPORT_CONFIG

@dataclass
class RequestMetric:
    timestamp: str
    endpoint: str
    response_time: float
    status_code: int
    error: str = None

@dataclass
class ResourceMetric:
    timestamp: str
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    network_bytes_sent: int
    network_bytes_recv: int

class MetricsCollector:
    def __init__(self, test_id: str):
        self.test_id = test_id
        self.request_metrics: List[RequestMetric] = []
        self.resource_metrics: List[ResourceMetric] = []
        self.start_time = None
        self.end_time = None
        self._setup_output_directory()
    
    def _setup_output_directory(self):
        """Setup output directory for metrics and reports"""
        self.output_dir = os.path.join(
            REPORT_CONFIG['metrics_output_dir'],
            f"test_{self.test_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
        os.makedirs(self.output_dir, exist_ok=True)
    
    def start_collection(self):
        """Start metrics collection"""
        self.start_time = datetime.now()
        self.request_metrics = []
        self.resource_metrics = []
    
    def stop_collection(self):
        """Stop metrics collection"""
        self.end_time = datetime.now()
        self._save_metrics()
        self._generate_report()
    
    def record_request(self, endpoint: str, response_time: float, 
                      status_code: int, error: str = None):
        """Record API request metrics"""
        metric = RequestMetric(
            timestamp=datetime.now().isoformat(),
            endpoint=endpoint,
            response_time=response_time,
            status_code=status_code,
            error=error
        )
        self.request_metrics.append(metric)
    
    def record_resources(self):
        """Record system resource metrics"""
        net_io = psutil.net_io_counters()
        metric = ResourceMetric(
            timestamp=datetime.now().isoformat(),
            cpu_percent=psutil.cpu_percent(),
            memory_percent=psutil.virtual_memory().percent,
            disk_percent=psutil.disk_usage('/').percent,
            network_bytes_sent=net_io.bytes_sent,
            network_bytes_recv=net_io.bytes_recv
        )
        self.resource_metrics.append(metric)
    
    def _save_metrics(self):
        """Save collected metrics to files"""
        # Save request metrics
        request_data = [asdict(m) for m in self.request_metrics]
        with open(os.path.join(self.output_dir, 'request_metrics.json'), 'w') as f:
            json.dump(request_data, f, indent=2)
        
        # Save resource metrics
        resource_data = [asdict(m) for m in self.resource_metrics]
        with open(os.path.join(self.output_dir, 'resource_metrics.json'), 'w') as f:
            json.dump(resource_data, f, indent=2)
    
    def _generate_report(self):
        """Generate test report with visualizations"""
        summary = self._calculate_summary()
        self._generate_plots()
        self._save_summary(summary)
        if REPORT_CONFIG['generate_html_report']:
            self._generate_html_report(summary)
    
    def _calculate_summary(self) -> Dict[str, Any]:
        """Calculate summary statistics"""
        response_times = [m.response_time for m in self.request_metrics]
        error_count = len([m for m in self.request_metrics if m.status_code >= 400])
        
        return {
            'test_id': self.test_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'duration': (self.end_time - self.start_time).total_seconds(),
            'total_requests': len(self.request_metrics),
            'error_count': error_count,
            'error_rate': error_count / len(self.request_metrics) if self.request_metrics else 0,
            'response_time': {
                'min': np.min(response_times) if response_times else 0,
                'max': np.max(response_times) if response_times else 0,
                'mean': np.mean(response_times) if response_times else 0,
                'p95': np.percentile(response_times, 95) if response_times else 0
            },
            'resource_usage': {
                'cpu_max': np.max([m.cpu_percent for m in self.resource_metrics]),
                'memory_max': np.max([m.memory_percent for m in self.resource_metrics]),
                'disk_max': np.max([m.disk_percent for m in self.resource_metrics])
            },
            'thresholds_exceeded': self._check_thresholds()
        }
    
    def _check_thresholds(self) -> Dict[str, bool]:
        """Check if any thresholds were exceeded"""
        response_times = [m.response_time for m in self.request_metrics]
        error_rate = len([m for m in self.request_metrics if m.status_code >= 400]) / len(self.request_metrics) if self.request_metrics else 0
        
        return {
            'cpu': any(m.cpu_percent > THRESHOLDS['cpu_threshold'] for m in self.resource_metrics),
            'memory': any(m.memory_percent > THRESHOLDS['memory_threshold'] for m in self.resource_metrics),
            'response_time': any(rt > THRESHOLDS['response_time_threshold'] for rt in response_times),
            'error_rate': error_rate > THRESHOLDS['error_rate_threshold']
        }
    
    def _generate_plots(self):
        """Generate visualization plots"""
        self._plot_response_times()
        self._plot_resource_usage()
        self._plot_error_rates()
    
    def _plot_response_times(self):
        """Plot response time trends"""
        plt.figure(figsize=(12, 6))
        times = [datetime.fromisoformat(m.timestamp) for m in self.request_metrics]
        response_times = [m.response_time for m in self.request_metrics]
        
        plt.plot(times, response_times)
        plt.axhline(y=THRESHOLDS['response_time_threshold'], color='r', linestyle='--', label='Threshold')
        plt.title('Response Times Over Time')
        plt.xlabel('Time')
        plt.ylabel('Response Time (seconds)')
        plt.legend()
        plt.grid(True)
        
        for fmt in REPORT_CONFIG['plot_formats']:
            plt.savefig(os.path.join(self.output_dir, f'response_times.{fmt}'))
        plt.close()
    
    def _plot_resource_usage(self):
        """Plot resource usage trends"""
        plt.figure(figsize=(12, 6))
        times = [datetime.fromisoformat(m.timestamp) for m in self.resource_metrics]
        
        plt.plot(times, [m.cpu_percent for m in self.resource_metrics], label='CPU')
        plt.plot(times, [m.memory_percent for m in self.resource_metrics], label='Memory')
        plt.plot(times, [m.disk_percent for m in self.resource_metrics], label='Disk')
        
        plt.axhline(y=THRESHOLDS['cpu_threshold'], color='r', linestyle='--', label='CPU Threshold')
        plt.axhline(y=THRESHOLDS['memory_threshold'], color='g', linestyle='--', label='Memory Threshold')
        
        plt.title('Resource Usage Over Time')
        plt.xlabel('Time')
        plt.ylabel('Usage (%)')
        plt.legend()
        plt.grid(True)
        
        for fmt in REPORT_CONFIG['plot_formats']:
            plt.savefig(os.path.join(self.output_dir, f'resource_usage.{fmt}'))
        plt.close()
    
    def _plot_error_rates(self):
        """Plot error rate trends"""
        plt.figure(figsize=(12, 6))
        
        # Calculate error rates over time windows
        window_size = 60  # 1-minute windows
        times = [datetime.fromisoformat(m.timestamp) for m in self.request_metrics]
        errors = [1 if m.status_code >= 400 else 0 for m in self.request_metrics]
        
        # Group by time windows
        windows = []
        error_rates = []
        current_window = self.start_time
        while current_window <= self.end_time:
            next_window = current_window + timedelta(seconds=window_size)
            window_errors = sum(e for t, e in zip(times, errors) if current_window <= t < next_window)
            window_total = sum(1 for t in times if current_window <= t < next_window)
            
            windows.append(current_window)
            error_rates.append(window_errors / window_total if window_total > 0 else 0)
            
            current_window = next_window
        
        plt.plot(windows, error_rates)
        plt.axhline(y=THRESHOLDS['error_rate_threshold'], color='r', linestyle='--', label='Threshold')
        plt.title('Error Rates Over Time')
        plt.xlabel('Time')
        plt.ylabel('Error Rate')
        plt.legend()
        plt.grid(True)
        
        for fmt in REPORT_CONFIG['plot_formats']:
            plt.savefig(os.path.join(self.output_dir, f'error_rates.{fmt}'))
        plt.close()
    
    def _save_summary(self, summary: Dict[str, Any]):
        """Save summary to file"""
        with open(os.path.join(self.output_dir, 'summary.json'), 'w') as f:
            json.dump(summary, f, indent=2)
    
    def _generate_html_report(self, summary: Dict[str, Any]):
        """Generate HTML report"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Stress Test Report - {self.test_id}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .summary {{ margin-bottom: 20px; }}
                .plots {{ display: flex; flex-wrap: wrap; }}
                .plot {{ margin: 10px; }}
                .threshold-exceeded {{ color: red; }}
            </style>
        </head>
        <body>
            <h1>Stress Test Report - {self.test_id}</h1>
            
            <div class="summary">
                <h2>Summary</h2>
                <p>Test Duration: {summary['duration']:.2f} seconds</p>
                <p>Total Requests: {summary['total_requests']}</p>
                <p>Error Rate: {summary['error_rate']*100:.2f}%</p>
                <p>Response Times:</p>
                <ul>
                    <li>Min: {summary['response_time']['min']:.3f}s</li>
                    <li>Max: {summary['response_time']['max']:.3f}s</li>
                    <li>Mean: {summary['response_time']['mean']:.3f}s</li>
                    <li>95th Percentile: {summary['response_time']['p95']:.3f}s</li>
                </ul>
                <p>Resource Usage (Peak):</p>
                <ul>
                    <li>CPU: {summary['resource_usage']['cpu_max']:.1f}%</li>
                    <li>Memory: {summary['resource_usage']['memory_max']:.1f}%</li>
                    <li>Disk: {summary['resource_usage']['disk_max']:.1f}%</li>
                </ul>
            </div>
            
            <div class="plots">
                <div class="plot">
                    <h3>Response Times</h3>
                    <img src="response_times.png" alt="Response Times Plot">
                </div>
                <div class="plot">
                    <h3>Resource Usage</h3>
                    <img src="resource_usage.png" alt="Resource Usage Plot">
                </div>
                <div class="plot">
                    <h3>Error Rates</h3>
                    <img src="error_rates.png" alt="Error Rates Plot">
                </div>
            </div>
        </body>
        </html>
        """
        
        with open(os.path.join(self.output_dir, 'report.html'), 'w') as f:
            f.write(html_content) 