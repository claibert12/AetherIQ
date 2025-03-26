"""
Stress Test Runner
"""
import asyncio
import aiohttp
import time
import uuid
from datetime import datetime
from typing import Dict, Any, List
import random
from concurrent.futures import ThreadPoolExecutor
import logging
from tests.stress_tests.config import BASE_CONFIG, TEST_SCENARIOS, USER_LOAD_STEPS
from tests.stress_tests.metrics_collector import MetricsCollector

class StressTestRunner:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.metrics_collector = None
        self.active_users = 0
        self.stop_flag = False
    
    async def run_test_suite(self):
        """Run complete test suite with different user loads"""
        for step in USER_LOAD_STEPS:
            self.logger.info(f"Starting test with {step['users']} users for {step['duration']} seconds")
            
            # Create new metrics collector for this test
            test_id = f"load_{step['users']}_users_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            self.metrics_collector = MetricsCollector(test_id)
            
            # Run the test
            await self.run_load_test(step['users'], step['duration'])
            
            # Wait between tests
            await asyncio.sleep(30)  # 30 seconds cool-down period
    
    async def run_load_test(self, num_users: int, duration: int):
        """Run a single load test with specified number of users"""
        self.stop_flag = False
        self.active_users = 0
        
        # Start metrics collection
        self.metrics_collector.start_collection()
        
        # Start resource monitoring in a separate thread
        with ThreadPoolExecutor() as executor:
            executor.submit(self._monitor_resources, duration)
            
            # Create user sessions
            user_tasks = []
            for i in range(num_users):
                # Gradual user ramp-up
                if i > 0 and i % 50 == 0:  # Add users in batches of 50
                    await asyncio.sleep(2)  # 2 second delay between batches
                
                user_task = asyncio.create_task(
                    self._simulate_user_session(f"user_{i}", duration)
                )
                user_tasks.append(user_task)
                self.active_users += 1
            
            # Wait for all user sessions to complete
            await asyncio.gather(*user_tasks)
        
        # Stop metrics collection and generate report
        self.metrics_collector.stop_collection()
    
    def _monitor_resources(self, duration: int):
        """Monitor system resources"""
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag:
            try:
                self.metrics_collector.record_resources()
                time.sleep(BASE_CONFIG['monitoring_interval'])
            except Exception as e:
                self.logger.error(f"Error monitoring resources: {str(e)}")
    
    async def _simulate_user_session(self, user_id: str, duration: int):
        """Simulate a user session with various API calls"""
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            while time.time() - start_time < duration and not self.stop_flag:
                try:
                    # Select scenario based on weights
                    scenario = self._select_scenario()
                    
                    # Execute scenario
                    await self._execute_scenario(session, scenario, user_id)
                    
                    # Add random delay between requests (100ms to 1s)
                    await asyncio.sleep(random.uniform(0.1, 1.0))
                    
                except Exception as e:
                    self.logger.error(f"Error in user session {user_id}: {str(e)}")
                    
                    # Record error metric
                    self.metrics_collector.record_request(
                        endpoint="unknown",
                        response_time=0,
                        status_code=500,
                        error=str(e)
                    )
    
    def _select_scenario(self) -> str:
        """Select a test scenario based on weights"""
        weights = [s['weight'] for s in TEST_SCENARIOS.values()]
        return random.choices(list(TEST_SCENARIOS.keys()), weights=weights)[0]
    
    async def _execute_scenario(self, session: aiohttp.ClientSession, 
                              scenario_name: str, user_id: str):
        """Execute a test scenario"""
        scenario = TEST_SCENARIOS[scenario_name]
        
        for endpoint in scenario['endpoints']:
            start_time = time.time()
            try:
                # Prepare request data
                request_data = self._prepare_request_data(scenario_name, endpoint, user_id)
                
                # Make API call
                async with session.post(
                    f"{BASE_CONFIG['base_url']}{endpoint}",
                    json=request_data,
                    timeout=BASE_CONFIG['request_timeout']
                ) as response:
                    response_time = time.time() - start_time
                    
                    # Record metrics
                    self.metrics_collector.record_request(
                        endpoint=endpoint,
                        response_time=response_time,
                        status_code=response.status,
                        error=None if response.status < 400 else "HTTP Error"
                    )
                    
                    # Handle response
                    if response.status >= 400:
                        self.logger.warning(
                            f"Request failed: {endpoint}, status: {response.status}"
                        )
                    
            except asyncio.TimeoutError:
                response_time = time.time() - start_time
                self.metrics_collector.record_request(
                    endpoint=endpoint,
                    response_time=response_time,
                    status_code=408,
                    error="Timeout"
                )
                self.logger.warning(f"Request timeout: {endpoint}")
                
            except Exception as e:
                response_time = time.time() - start_time
                self.metrics_collector.record_request(
                    endpoint=endpoint,
                    response_time=response_time,
                    status_code=500,
                    error=str(e)
                )
                self.logger.error(f"Request error: {endpoint}, error: {str(e)}")
    
    def _prepare_request_data(self, scenario_name: str, endpoint: str, user_id: str) -> Dict[str, Any]:
        """Prepare request data based on scenario and endpoint"""
        base_data = {
            "user_id": user_id,
            "timestamp": datetime.now().isoformat(),
            "request_id": str(uuid.uuid4())
        }
        
        # Add scenario-specific data
        if scenario_name == "workflow_optimization":
            base_data.update({
                "workflow_type": random.choice(["sequential", "parallel", "conditional"]),
                "input_size": random.randint(100, 10000),
                "priority": random.choice(["low", "medium", "high"])
            })
        
        elif scenario_name == "security_compliance":
            base_data.update({
                "resource_type": random.choice(["data", "compute", "network"]),
                "access_level": random.choice(["read", "write", "admin"]),
                "security_context": {
                    "encryption": random.choice(["AES-256", "RSA-2048"]),
                    "compliance": random.choice(["GDPR", "HIPAA", "SOC2"])
                }
            })
        
        elif scenario_name == "resource_management":
            base_data.update({
                "resource_type": random.choice(["CPU", "Memory", "Storage"]),
                "allocation_size": random.randint(1, 100),
                "duration": random.randint(300, 3600)
            })
        
        return base_data

async def main():
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create and run test suite
    runner = StressTestRunner()
    await runner.run_test_suite()

if __name__ == "__main__":
    asyncio.run(main()) 