"""
AetherIQ Platform Runner
"""
import subprocess
import sys
import os
import time
import signal
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_environment():
    """Setup Python environments and install dependencies"""
    logger.info("Setting up environments...")
    
    # Create app environment
    logger.info("Setting up app environment...")
    subprocess.run(["py", "-3.11", "-m", "venv", "app_venv"], check=True)
    
    # Install app dependencies
    pip_cmd = str(Path("app_venv/Scripts/pip") if os.name == "nt" else "app_venv/bin/pip")
    subprocess.run([pip_cmd, "install", "--upgrade", "pip", "setuptools", "wheel"], check=True)
    subprocess.run([pip_cmd, "install", "-r", "app/requirements.txt"], check=True)
    
    # Create tests environment
    logger.info("Setting up tests environment...")
    subprocess.run(["py", "-3.11", "-m", "venv", "tests_venv"], check=True)
    
    # Install test dependencies
    pip_cmd = str(Path("tests_venv/Scripts/pip") if os.name == "nt" else "tests_venv/bin/pip")
    subprocess.run([pip_cmd, "install", "--upgrade", "pip", "setuptools", "wheel"], check=True)
    subprocess.run([pip_cmd, "install", "-r", "tests/stress_tests/requirements.txt"], check=True)

def start_api_server():
    """Start the FastAPI server"""
    logger.info("Starting API server...")
    python_cmd = str(Path("app_venv/Scripts/python") if os.name == "nt" else "app_venv/bin/python")
    return subprocess.Popen(
        [python_cmd, "app/main.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

def run_stress_tests():
    """Run the stress tests"""
    logger.info("Running stress tests...")
    python_cmd = str(Path("tests_venv/Scripts/python") if os.name == "nt" else "tests_venv/bin/python")
    return subprocess.run(
        [python_cmd, "-m", "tests.stress_tests.run_tests"],
        check=True
    )

def main():
    try:
        # Setup environments
        setup_environment()
        
        # Start API server
        api_process = start_api_server()
        logger.info("Waiting for API server to start...")
        time.sleep(5)  # Give the server time to start
        
        # Run stress tests
        run_stress_tests()
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Error running command: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
    finally:
        # Cleanup
        if 'api_process' in locals():
            logger.info("Shutting down API server...")
            if os.name == "nt":
                api_process.terminate()
            else:
                os.kill(api_process.pid, signal.SIGTERM)
            api_process.wait()

if __name__ == "__main__":
    main() 