from sqlalchemy.orm import Session
from sqlalchemy import text, create_engine
from typing import Dict, Any, List, Optional
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from datetime import datetime, timedelta
import json
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

class DatabaseOptimizer:
    def __init__(self, db: Session, config: Dict[str, Any]):
        self.db = db
        self.config = config
        self.query_optimizer = RandomForestRegressor(n_estimators=100)
        self._initialize_optimizer()
        self.logger = logging.getLogger(__name__)
    
    def _initialize_optimizer(self):
        """Initialize the AI query optimizer with historical data"""
        try:
            # Get historical query performance data
            historical_data = self._get_historical_query_data()
            if historical_data:
                # Train the optimizer
                self._train_optimizer(historical_data)
        except Exception as e:
            self.logger.error(f"Failed to initialize query optimizer: {str(e)}")
    
    def _get_historical_query_data(self) -> List[Dict[str, Any]]:
        """Retrieve historical query performance data"""
        query = text("""
            SELECT 
                query_hash,
                execution_time,
                rows_affected,
                index_usage,
                buffer_hits,
                buffer_misses,
                timestamp
            FROM query_performance_history
            WHERE timestamp > NOW() - INTERVAL '30 days'
        """)
        return self.db.execute(query).fetchall()
    
    def _train_optimizer(self, historical_data: List[Dict[str, Any]]):
        """Train the AI query optimizer"""
        features = []
        targets = []
        
        for record in historical_data:
            feature_vector = [
                record['rows_affected'],
                record['index_usage'],
                record['buffer_hits'],
                record['buffer_misses']
            ]
            features.append(feature_vector)
            targets.append(record['execution_time'])
        
        if features and targets:
            self.query_optimizer.fit(features, targets)
    
    def optimize_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Optimize a query using AI"""
        try:
            # Analyze query
            query_plan = self._analyze_query(query, params)
            
            # Extract features for prediction
            features = self._extract_query_features(query_plan)
            
            # Predict execution time
            predicted_time = self.query_optimizer.predict([features])[0]
            
            # Generate optimization suggestions
            suggestions = self._generate_optimization_suggestions(query_plan, predicted_time)
            
            # Create optimized query
            optimized_query = self._apply_optimizations(query, suggestions)
            
            return {
                "original_query": query,
                "optimized_query": optimized_query,
                "predicted_execution_time": float(predicted_time),
                "suggestions": suggestions,
                "query_plan": query_plan
            }
        except Exception as e:
            self.logger.error(f"Query optimization failed: {str(e)}")
            return {
                "original_query": query,
                "error": str(e)
            }
    
    def _analyze_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Analyze query execution plan"""
        try:
            # Get query execution plan
            plan_query = text("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query)
            result = self.db.execute(plan_query, params or {}).scalar()
            return json.loads(result)
        except Exception as e:
            self.logger.error(f"Query analysis failed: {str(e)}")
            return {}
    
    def _extract_query_features(self, query_plan: Dict[str, Any]) -> List[float]:
        """Extract numerical features from query plan"""
        features = []
        
        try:
            # Extract plan statistics
            plan_stats = self._get_plan_statistics(query_plan)
            
            features = [
                plan_stats.get('rows', 0),
                plan_stats.get('index_usage', 0),
                plan_stats.get('buffer_hits', 0),
                plan_stats.get('buffer_misses', 0)
            ]
        except Exception as e:
            self.logger.error(f"Feature extraction failed: {str(e)}")
        
        return features
    
    def _get_plan_statistics(self, plan: Dict[str, Any]) -> Dict[str, float]:
        """Extract statistics from query plan"""
        stats = {
            'rows': 0,
            'index_usage': 0,
            'buffer_hits': 0,
            'buffer_misses': 0
        }
        
        def extract_node_stats(node: Dict[str, Any]):
            if 'Plan Rows' in node:
                stats['rows'] += node['Plan Rows']
            if 'Index Cond' in node:
                stats['index_usage'] += 1
            if 'Shared Hit Blocks' in node:
                stats['buffer_hits'] += node['Shared Hit Blocks']
            if 'Shared Miss Blocks' in node:
                stats['buffer_misses'] += node['Shared Miss Blocks']
            
            if 'Plans' in node:
                for subplan in node['Plans']:
                    extract_node_stats(subplan)
        
        extract_node_stats(plan)
        return stats
    
    def _generate_optimization_suggestions(
        self,
        query_plan: Dict[str, Any],
        predicted_time: float
    ) -> List[Dict[str, Any]]:
        """Generate optimization suggestions based on query plan"""
        suggestions = []
        
        try:
            # Analyze sequential scans
            if self._has_sequential_scan(query_plan):
                suggestions.append({
                    "type": "index",
                    "severity": "high",
                    "description": "Sequential scan detected",
                    "suggestion": "Consider adding an index"
                })
            
            # Analyze buffer usage
            if self._has_buffer_misses(query_plan):
                suggestions.append({
                    "type": "buffer",
                    "severity": "medium",
                    "description": "High buffer misses",
                    "suggestion": "Consider increasing shared buffers"
                })
            
            # Analyze join operations
            if self._has_inefficient_joins(query_plan):
                suggestions.append({
                    "type": "join",
                    "severity": "medium",
                    "description": "Inefficient join detected",
                    "suggestion": "Consider optimizing join conditions"
                })
            
            # Analyze predicted execution time
            if predicted_time > 1000:  # More than 1 second
                suggestions.append({
                    "type": "performance",
                    "severity": "high",
                    "description": "High predicted execution time",
                    "suggestion": "Consider query optimization or materialized views"
                })
        except Exception as e:
            self.logger.error(f"Failed to generate suggestions: {str(e)}")
        
        return suggestions
    
    def _apply_optimizations(self, query: str, suggestions: List[Dict[str, Any]]) -> str:
        """Apply optimizations to the query"""
        optimized_query = query
        
        try:
            for suggestion in suggestions:
                if suggestion["type"] == "index":
                    # Add index hints if supported
                    optimized_query = self._add_index_hints(optimized_query)
                elif suggestion["type"] == "join":
                    # Optimize join order
                    optimized_query = self._optimize_joins(optimized_query)
        except Exception as e:
            self.logger.error(f"Failed to apply optimizations: {str(e)}")
        
        return optimized_query
    
    def _has_sequential_scan(self, plan: Dict[str, Any]) -> bool:
        """Check if query plan contains sequential scans"""
        def check_node(node: Dict[str, Any]) -> bool:
            if node.get('Node Type') == 'Seq Scan':
                return True
            if 'Plans' in node:
                return any(check_node(subplan) for subplan in node['Plans'])
            return False
        
        return check_node(plan)
    
    def _has_buffer_misses(self, plan: Dict[str, Any]) -> bool:
        """Check if query plan has high buffer misses"""
        def check_node(node: Dict[str, Any]) -> bool:
            if node.get('Shared Miss Blocks', 0) > 100:
                return True
            if 'Plans' in node:
                return any(check_node(subplan) for subplan in node['Plans'])
            return False
        
        return check_node(plan)
    
    def _has_inefficient_joins(self, plan: Dict[str, Any]) -> bool:
        """Check if query plan has inefficient joins"""
        def check_node(node: Dict[str, Any]) -> bool:
            if node.get('Node Type') == 'Hash Join' and node.get('Plan Rows', 0) > 10000:
                return True
            if 'Plans' in node:
                return any(check_node(subplan) for subplan in node['Plans'])
            return False
        
        return check_node(plan)
    
    def _add_index_hints(self, query: str) -> str:
        """Add index hints to query"""
        # This is a simplified example - in practice, you'd need more sophisticated parsing
        if 'WHERE' in query:
            query = query.replace('WHERE', 'WHERE /*+ INDEX(table_name idx_name) */')
        return query
    
    def _optimize_joins(self, query: str) -> str:
        """Optimize join order in query"""
        # This is a simplified example - in practice, you'd need more sophisticated parsing
        if 'JOIN' in query:
            query = query.replace('JOIN', '/*+ LEADING(table1 table2) */ JOIN')
        return query
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get database performance metrics"""
        try:
            metrics = {
                "query_stats": self._get_query_statistics(),
                "index_usage": self._get_index_usage(),
                "buffer_stats": self._get_buffer_statistics(),
                "table_stats": self._get_table_statistics()
            }
            return metrics
        except Exception as e:
            self.logger.error(f"Failed to get performance metrics: {str(e)}")
            return {}
    
    def _get_query_statistics(self) -> Dict[str, Any]:
        """Get query performance statistics"""
        query = text("""
            SELECT 
                COUNT(*) as total_queries,
                AVG(execution_time) as avg_execution_time,
                MAX(execution_time) as max_execution_time,
                MIN(execution_time) as min_execution_time
            FROM query_performance_history
            WHERE timestamp > NOW() - INTERVAL '1 hour'
        """)
        return dict(self.db.execute(query).first())
    
    def _get_index_usage(self) -> Dict[str, Any]:
        """Get index usage statistics"""
        query = text("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan,
                idx_tup_read,
                idx_tup_fetch
            FROM pg_stat_user_indexes
            ORDER BY idx_scan DESC
            LIMIT 10
        """)
        return {"indexes": self.db.execute(query).fetchall()}
    
    def _get_buffer_statistics(self) -> Dict[str, Any]:
        """Get buffer cache statistics"""
        query = text("""
            SELECT 
                buffers_alloc,
                buffers_backend,
                buffers_backend_fsync,
                buffers_clean,
                buffers_dirty
            FROM pg_stat_bgwriter
        """)
        return dict(self.db.execute(query).first())
    
    def _get_table_statistics(self) -> Dict[str, Any]:
        """Get table statistics"""
        query = text("""
            SELECT 
                schemaname,
                tablename,
                seq_scan,
                seq_tup_read,
                idx_scan,
                idx_tup_fetch,
                n_tup_ins,
                n_tup_upd,
                n_tup_del
            FROM pg_stat_user_tables
            ORDER BY seq_scan DESC
            LIMIT 10
        """)
        return {"tables": self.db.execute(query).fetchall()} 