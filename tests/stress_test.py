import asyncio
import aiohttp
import psutil
import time
import logging
import json
from datetime import datetime
from typing import Dict, List, Any
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import matplotlib.pyplot as plt
from app.services.workflow_optimizer import WorkflowOptimizer
from app.services.error_handler import ErrorHandler
from app.services.failover import FailoverManager
from app.services.compliance import ComplianceChecker
from app.services.db_optimization import DatabaseOptimizer
from app.services.forensic_audit import ForensicAuditService
from app.services.encryption import EncryptionService

class StressTest:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.metrics = {
            'response_times': [],
            'error_rates': [],
            'resource_usage': [],
            'ai_operations': [],
            'security_events': []
        }
        self.start_time = None
        self.end_time = None
        
        # Initialize services
        self.workflow_optimizer = WorkflowOptimizer()
        self.error_handler = ErrorHandler(None)  # Mock DB session
        self.failover_manager = FailoverManager(None, config)  # Mock DB session
        self.compliance_checker = ComplianceChecker(None, config)  # Mock DB session
        self.db_optimizer = DatabaseOptimizer(None, config)  # Mock DB session
        self.forensic_audit = ForensicAuditService(None, EncryptionService("test_key"))  # Mock DB session
    
    async def run_load_test(self, num_users: int, duration: int):
        """Run load test with specified number of virtual users"""
        self.start_time = time.time()
        self.logger.info(f"Starting load test with {num_users} virtual users for {duration} seconds")
        
        # Create tasks for each virtual user
        tasks = []
        for i in range(num_users):
            tasks.append(self.simulate_user_session(i))
        
        # Run tasks concurrently
        await asyncio.gather(*tasks)
        
        self.end_time = time.time()
        self.generate_report()
    
    async def simulate_user_session(self, user_id: int):
        """Simulate a user session with various operations"""
        async with aiohttp.ClientSession() as session:
            while time.time() - self.start_time < self.config['test_duration']:
                try:
                    # Simulate API calls
                    await self.simulate_api_calls(session, user_id)
                    
                    # Simulate AI operations
                    await self.simulate_ai_operations(user_id)
                    
                    # Simulate security checks
                    await self.simulate_security_checks(user_id)
                    
                    # Add delay between operations
                    await asyncio.sleep(np.random.uniform(0.1, 0.5))
                    
                except Exception as e:
                    self.logger.error(f"Error in user session {user_id}: {str(e)}")
                    self.metrics['error_rates'].append({
                        'timestamp': datetime.now().isoformat(),
                        'user_id': user_id,
                        'error': str(e)
                    })
    
    async def simulate_api_calls(self, session: aiohttp.ClientSession, user_id: int):
        """Simulate various API calls"""
        endpoints = [
            '/api/workflow/optimize',
            '/api/compliance/check',
            '/api/security/audit',
            '/api/performance/metrics'
        ]
        
        for endpoint in endpoints:
            start_time = time.time()
            try:
                async with session.get(f"{self.config['base_url']}{endpoint}") as response:
                    if response.status == 200:
                        await response.json()
                    else:
                        raise Exception(f"API call failed with status {response.status}")
            except Exception as e:
                self.logger.error(f"API call failed for {endpoint}: {str(e)}")
            
            response_time = time.time() - start_time
            self.metrics['response_times'].append({
                'timestamp': datetime.now().isoformat(),
                'endpoint': endpoint,
                'response_time': response_time,
                'user_id': user_id
            })
    
    async def simulate_ai_operations(self, user_id: int):
        """Simulate AI-driven operations"""
        start_time = time.time()
        
        try:
            # Simulate workflow optimization
            workflow_data = {
                'input_data_size': np.random.randint(1000, 10000),
                'output_data_size': np.random.randint(1000, 10000),
                'has_error': np.random.choice([0, 1], p=[0.9, 0.1]),
                'status_encoded': np.random.randint(0, 4)
            }
            
            execution_time = self.workflow_optimizer.predict_execution_time(workflow_data)
            
            self.metrics['ai_operations'].append({
                'timestamp': datetime.now().isoformat(),
                'operation': 'workflow_optimization',
                'execution_time': execution_time,
                'user_id': user_id
            })
            
        except Exception as e:
            self.logger.error(f"AI operation failed: {str(e)}")
    
    async def simulate_security_checks(self, user_id: int):
        """Simulate security and compliance checks"""
        start_time = time.time()
        
        try:
            # Simulate compliance check
            workflow_data = {
                'data_type': 'sensitive',
                'user_id': user_id,
                'tenant_id': 1
            }
            
            compliance_result = self.compliance_checker.check_compliance(
                workflow_data,
                user_id,
                1
            )
            
            self.metrics['security_events'].append({
                'timestamp': datetime.now().isoformat(),
                'event_type': 'compliance_check',
                'result': compliance_result,
                'user_id': user_id
            })
            
        except Exception as e:
            self.logger.error(f"Security check failed: {str(e)}")
    
    def monitor_resources(self):
        """Monitor system resource usage"""
        while time.time() - self.start_time < self.config['test_duration']:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            self.metrics['resource_usage'].append({
                'timestamp': datetime.now().isoformat(),
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'disk_percent': disk.percent
            })
            
            time.sleep(1)
    
    def generate_report(self):
        """Generate comprehensive test report"""
        report = {
            'test_duration': self.end_time - self.start_time,
            'metrics': self.metrics,
            'summary': self._generate_summary()
        }
        
        # Save report to file
        with open('stress_test_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        # Generate plots
        self._generate_plots()
        
        return report
    
    def _generate_summary(self) -> Dict[str, Any]:
        """Generate summary statistics"""
        response_times = [m['response_time'] for m in self.metrics['response_times']]
        error_count = len(self.metrics['error_rates'])
        total_operations = len(self.metrics['response_times'])
        
        return {
            'average_response_time': np.mean(response_times) if response_times else 0,
            'max_response_time': np.max(response_times) if response_times else 0,
            'error_rate': error_count / total_operations if total_operations > 0 else 0,
            'total_operations': total_operations,
            'failed_operations': error_count
        }
    
    def _generate_plots(self):
        """Generate visualization plots"""
        # Response time plot
        plt.figure(figsize=(12, 6))
        response_times = [m['response_time'] for m in self.metrics['response_times']]
        plt.plot(response_times)
        plt.title('Response Times Over Time')
        plt.xlabel('Request Number')
        plt.ylabel('Response Time (seconds)')
        plt.savefig('response_times.png')
        plt.close()
        
        # Resource usage plot
        plt.figure(figsize=(12, 6))
        timestamps = [m['timestamp'] for m in self.metrics['resource_usage']]
        cpu_usage = [m['cpu_percent'] for m in self.metrics['resource_usage']]
        memory_usage = [m['memory_percent'] for m in self.metrics['resource_usage']]
        
        plt.plot(timestamps, cpu_usage, label='CPU Usage')
        plt.plot(timestamps, memory_usage, label='Memory Usage')
        plt.title('Resource Usage Over Time')
        plt.xlabel('Time')
        plt.ylabel('Usage (%)')
        plt.legend()
        plt.savefig('resource_usage.png')
        plt.close()

async def main():
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Test configuration
    config = {
        'base_url': 'http://localhost:8000',
        'test_duration': 300,  # 5 minutes
        'num_users': 500,  # Start with 500 users
        'ramp_up_time': 60  # 1 minute ramp-up
    }
    
    # Initialize and run stress test
    stress_test = StressTest(config)
    
    # Start resource monitoring in a separate thread
    with ThreadPoolExecutor() as executor:
        executor.submit(stress_test.monitor_resources)
        
        # Run load test
        await stress_test.run_load_test(config['num_users'], config['test_duration'])
    
    # Generate and print report
    report = stress_test.generate_report()
    print("\nStress Test Report:")
    print(json.dumps(report['summary'], indent=2))

if __name__ == "__main__":
    asyncio.run(main()) 