import asyncio
import json
import os
from datetime import datetime
from stress_test import StressTest

async def run_stress_test_suite():
    # Create results directory
    results_dir = f"stress_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(results_dir, exist_ok=True)
    
    # Test configurations with increasing user loads
    user_loads = [500, 1000, 1500, 2000]
    test_duration = 300  # 5 minutes per test
    
    overall_results = []
    
    for num_users in user_loads:
        print(f"\nRunning stress test with {num_users} users...")
        
        config = {
            'base_url': 'http://localhost:8000',
            'test_duration': test_duration,
            'num_users': num_users,
            'ramp_up_time': 60
        }
        
        # Initialize and run stress test
        stress_test = StressTest(config)
        await stress_test.run_load_test(num_users, test_duration)
        
        # Get test results
        report = stress_test.generate_report()
        
        # Save individual test results
        test_result_file = os.path.join(results_dir, f"stress_test_{num_users}_users.json")
        with open(test_result_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        # Add to overall results
        overall_results.append({
            'num_users': num_users,
            'summary': report['summary']
        })
        
        # Move generated plots to results directory
        if os.path.exists('response_times.png'):
            os.rename('response_times.png', 
                     os.path.join(results_dir, f'response_times_{num_users}_users.png'))
        if os.path.exists('resource_usage.png'):
            os.rename('resource_usage.png', 
                     os.path.join(results_dir, f'resource_usage_{num_users}_users.png'))
    
    # Generate overall summary
    overall_summary = {
        'test_suite_timestamp': datetime.now().isoformat(),
        'total_tests': len(user_loads),
        'user_loads_tested': user_loads,
        'test_duration_per_load': test_duration,
        'results': overall_results
    }
    
    # Save overall summary
    summary_file = os.path.join(results_dir, 'stress_test_suite_summary.json')
    with open(summary_file, 'w') as f:
        json.dump(overall_summary, f, indent=2)
    
    print("\nStress Test Suite Complete!")
    print(f"Results saved in: {results_dir}")
    print("\nOverall Summary:")
    print(json.dumps(overall_summary, indent=2))

if __name__ == "__main__":
    asyncio.run(run_stress_test_suite()) 