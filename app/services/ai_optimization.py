import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import tensorflow as tf
from tensorflow.keras import layers, models
import joblib
import json

class WorkflowOptimizer:
    def __init__(self):
        self.lstm_model = None
        self.rf_model = None
        self.scaler = StandardScaler()
        self.feature_columns = [
            'input_data_size',
            'output_data_size',
            'has_error',
            'status_encoded',
            'hour_of_day',
            'day_of_week',
            'is_weekend'
        ]
        
    def build_lstm_model(self, input_shape: tuple) -> tf.keras.Model:
        """Build LSTM model for time series prediction"""
        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(64, input_shape=input_shape, return_sequences=True),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.LSTM(32),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(16, activation='relu'),
            tf.keras.layers.Dense(1)
        ])
        
        model.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        return model
    
    def prepare_execution_data(self, executions: List[Dict[str, Any]]) -> pd.DataFrame:
        """Prepare execution data for model training"""
        df = pd.DataFrame(executions)
        
        # Convert timestamps to datetime
        df['started_at'] = pd.to_datetime(df['started_at'])
        df['completed_at'] = pd.to_datetime(df['completed_at'])
        
        # Calculate execution time
        df['execution_time'] = (df['completed_at'] - df['started_at']).dt.total_seconds()
        
        # Extract time features
        df['hour_of_day'] = df['started_at'].dt.hour
        df['day_of_week'] = df['started_at'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Encode status
        status_map = {'pending': 0, 'running': 1, 'completed': 2, 'failed': 3}
        df['status_encoded'] = df['status'].map(status_map)
        
        # Calculate data sizes
        df['input_data_size'] = df['input_data'].apply(lambda x: len(str(x)) if x else 0)
        df['output_data_size'] = df['output_data'].apply(lambda x: len(str(x)) if x else 0)
        
        # Add error flag
        df['has_error'] = df['error_message'].notna().astype(int)
        
        return df
    
    def extract_features(self, df: pd.DataFrame) -> np.ndarray:
        """Extract features for model training"""
        return df[self.feature_columns].values
    
    def train(self, executions: List[Dict[str, Any]]):
        """Train both LSTM and Random Forest models"""
        if len(executions) < 10:
            return
            
        # Prepare data
        df = self.prepare_execution_data(executions)
        X = self.extract_features(df)
        y = df['execution_time'].values
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train Random Forest model
        self.rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.rf_model.fit(X_scaled, y)
        
        # Prepare LSTM data
        sequence_length = 5
        X_lstm = []
        y_lstm = []
        
        for i in range(len(X_scaled) - sequence_length):
            X_lstm.append(X_scaled[i:(i + sequence_length)])
            y_lstm.append(y[i + sequence_length])
            
        X_lstm = np.array(X_lstm)
        y_lstm = np.array(y_lstm)
        
        # Train LSTM model
        self.lstm_model = self.build_lstm_model((sequence_length, X_scaled.shape[1]))
        self.lstm_model.fit(
            X_lstm, y_lstm,
            epochs=50,
            batch_size=32,
            validation_split=0.2,
            verbose=0
        )
    
    def predict_execution_time(self, execution_data: Dict[str, Any]) -> float:
        """Predict execution time for a workflow"""
        if not self.rf_model or not self.lstm_model:
            return 0.0
            
        # Prepare input data
        df = pd.DataFrame([execution_data])
        X = self.extract_features(df)
        X_scaled = self.scaler.transform(X)
        
        # Get predictions from both models
        rf_pred = self.rf_model.predict(X_scaled)[0]
        
        # For LSTM, we need a sequence
        sequence = np.zeros((1, 5, X_scaled.shape[1]))
        sequence[0, -1] = X_scaled[0]
        lstm_pred = self.lstm_model.predict(sequence)[0][0]
        
        # Combine predictions (weighted average)
        return 0.7 * rf_pred + 0.3 * lstm_pred
    
    def analyze_bottlenecks(self, executions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze workflow bottlenecks"""
        if not executions:
            return []
            
        df = pd.DataFrame(executions)
        
        # Calculate execution times
        df['started_at'] = pd.to_datetime(df['started_at'])
        df['completed_at'] = pd.to_datetime(df['completed_at'])
        df['execution_time'] = (df['completed_at'] - df['started_at']).dt.total_seconds()
        
        # Identify bottlenecks
        bottlenecks = []
        
        # 1. High error rate
        error_rate = df['error_message'].notna().mean()
        if error_rate > 0.1:
            bottlenecks.append({
                "type": "high_error_rate",
                "severity": "high" if error_rate > 0.2 else "medium",
                "description": f"Error rate is {error_rate:.1%}",
                "suggestion": "Review error handling and add retry mechanisms"
            })
        
        # 2. Long execution times
        avg_time = df['execution_time'].mean()
        if avg_time > 300:  # More than 5 minutes
            bottlenecks.append({
                "type": "long_execution_time",
                "severity": "high" if avg_time > 600 else "medium",
                "description": f"Average execution time is {avg_time:.1f} seconds",
                "suggestion": "Optimize workflow steps and consider parallelization"
            })
        
        # 3. Resource usage
        if 'resource_usage' in df.columns:
            resource_usage = df['resource_usage'].apply(pd.Series)
            if resource_usage['cpu'].mean() > 80:
                bottlenecks.append({
                    "type": "high_cpu_usage",
                    "severity": "high",
                    "description": "High CPU usage detected",
                    "suggestion": "Optimize resource-intensive operations"
                })
        
        return bottlenecks
    
    def generate_optimization_suggestions(
        self,
        workflow: Dict[str, Any],
        executions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate optimization suggestions based on workflow analysis"""
        suggestions = []
        
        if not executions:
            return suggestions
            
        df = pd.DataFrame(executions)
        
        # 1. Performance optimization
        avg_time = (pd.to_datetime(df['completed_at']) - pd.to_datetime(df['started_at'])).dt.total_seconds().mean()
        if avg_time > 300:
            suggestions.append({
                "type": "performance",
                "priority": "high",
                "description": "Workflow execution time is high",
                "suggestion": "Consider implementing caching and optimizing data processing steps",
                "potential_savings": f"Estimated {avg_time * 0.3:.1f} seconds per execution"
            })
        
        # 2. Error handling
        error_rate = df['error_message'].notna().mean()
        if error_rate > 0.1:
            suggestions.append({
                "type": "reliability",
                "priority": "high",
                "description": "High error rate detected",
                "suggestion": "Implement robust error handling and retry mechanisms",
                "potential_savings": f"Reduce error rate by {error_rate * 0.5:.1%}"
            })
        
        # 3. Resource optimization
        if 'resource_usage' in df.columns:
            resource_usage = df['resource_usage'].apply(pd.Series)
            if resource_usage['memory'].mean() > 80:
                suggestions.append({
                    "type": "resource",
                    "priority": "medium",
                    "description": "High memory usage detected",
                    "suggestion": "Optimize memory usage and implement garbage collection",
                    "potential_savings": "Reduce memory footprint by 30%"
                })
        
        return suggestions
    
    def calculate_risk_score(
        self,
        workflow: Dict[str, Any],
        executions: List[Dict[str, Any]]
    ) -> float:
        """Calculate risk score for the workflow"""
        if not executions:
            return 0.0
            
        df = pd.DataFrame(executions)
        
        # Calculate risk factors
        risk_factors = {
            'error_rate': df['error_message'].notna().mean() * 0.4,
            'execution_time_variance': df['execution_time'].std() / df['execution_time'].mean() * 0.3,
            'resource_usage': df['resource_usage'].apply(lambda x: x.get('cpu', 0)).mean() / 100 * 0.3
        }
        
        # Combine risk factors
        risk_score = sum(risk_factors.values())
        
        # Normalize to 0-1 range
        return min(max(risk_score, 0.0), 1.0) 