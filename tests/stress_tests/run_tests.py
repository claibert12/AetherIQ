"""
Run Stress Tests and Analyze Results
"""
import asyncio
import argparse
import logging
import json
import os
from datetime import datetime
from tests.stress_tests.runner import StressTestRunner
from tests.stress_tests.metrics_collector import MetricsCollector

def setup_logging(log_dir: str):
    """Setup logging configuration"""
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(
        log_dir, 
        f"stress_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    )
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

def analyze_results(results_dir: str):
    """Analyze test results and generate summary"""
    logger = logging.getLogger(__name__)
    logger.info("Analyzing test results...")
    
    # Find all test result directories
    test_dirs = [d for d in os.listdir(results_dir) if os.path.isdir(os.path.join(results_dir, d))]
    
    overall_summary = {
        "total_tests": len(test_dirs),
        "total_requests": 0,
        "total_errors": 0,
        "avg_response_time": 0.0,
        "max_response_time": 0.0,
        "error_rate": 0.0,
        "peak_cpu_usage": 0.0,
        "peak_memory_usage": 0.0,
        "test_summaries": []
    }
    
    for test_dir in test_dirs:
        test_path = os.path.join(results_dir, test_dir)
        summary_file = os.path.join(test_path, "summary.json")
        
        try:
            with open(summary_file, 'r') as f:
                test_summary = json.load(f)
                
            overall_summary["total_requests"] += test_summary["total_requests"]
            overall_summary["total_errors"] += test_summary["total_errors"]
            overall_summary["avg_response_time"] += test_summary["avg_response_time"]
            overall_summary["max_response_time"] = max(
                overall_summary["max_response_time"],
                test_summary["max_response_time"]
            )
            overall_summary["peak_cpu_usage"] = max(
                overall_summary["peak_cpu_usage"],
                test_summary["peak_cpu_usage"]
            )
            overall_summary["peak_memory_usage"] = max(
                overall_summary["peak_memory_usage"],
                test_summary["peak_memory_usage"]
            )
            
            overall_summary["test_summaries"].append({
                "test_id": test_dir,
                "summary": test_summary
            })
            
        except Exception as e:
            logger.error(f"Error processing test results for {test_dir}: {str(e)}")
    
    # Calculate averages
    if overall_summary["total_tests"] > 0:
        overall_summary["avg_response_time"] /= overall_summary["total_tests"]
        overall_summary["error_rate"] = (
            overall_summary["total_errors"] / overall_summary["total_requests"]
            if overall_summary["total_requests"] > 0 else 0
        ) * 100
    
    # Save overall summary
    summary_path = os.path.join(results_dir, "overall_summary.json")
    with open(summary_path, 'w') as f:
        json.dump(overall_summary, f, indent=2)
    
    logger.info("Analysis complete. Results saved to overall_summary.json")
    return overall_summary

async def main():
    parser = argparse.ArgumentParser(description="Run stress tests for AetherIQ platform")
    parser.add_argument(
        "--results-dir",
        default="test_results",
        help="Directory to store test results"
    )
    parser.add_argument(
        "--log-dir",
        default="logs",
        help="Directory to store log files"
    )
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logging(args.log_dir)
    logger.info("Starting stress test suite")
    
    try:
        # Create results directory
        os.makedirs(args.results_dir, exist_ok=True)
        
        # Run tests
        runner = StressTestRunner()
        await runner.run_test_suite()
        
        # Analyze results
        summary = analyze_results(args.results_dir)
        
        # Log summary
        logger.info("Test Suite Summary:")
        logger.info(f"Total Tests: {summary['total_tests']}")
        logger.info(f"Total Requests: {summary['total_requests']}")
        logger.info(f"Error Rate: {summary['error_rate']:.2f}%")
        logger.info(f"Average Response Time: {summary['avg_response_time']:.2f}ms")
        logger.info(f"Peak CPU Usage: {summary['peak_cpu_usage']:.2f}%")
        logger.info(f"Peak Memory Usage: {summary['peak_memory_usage']:.2f}MB")
        
    except Exception as e:
        logger.error(f"Error running test suite: {str(e)}")
        raise
    
    logger.info("Test suite completed")

if __name__ == "__main__":
    asyncio.run(main()) 