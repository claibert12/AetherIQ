from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="aetheriq",
    version="1.0.0",
    author="AetherIQ",
    author_email="Aetheriq@atheriq.ai",
    description="Enterprise AI Automation Platform",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-org/aetheriq",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: System Administrators",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: System :: Systems Administration",
    ],
    python_requires=">=3.9",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "aetheriq=aetheriq.main:main",
        ],
    },
    include_package_data=True,
    package_data={
        "aetheriq": [
            "alembic.ini",
            "alembic/*",
            "alembic/versions/*",
            "config/*.yml",
            "config/*.yaml",
            "config/*.json",
        ],
    },
) 