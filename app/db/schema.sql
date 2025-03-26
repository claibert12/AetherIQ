-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_partman;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create schema for sharding
CREATE SCHEMA IF NOT EXISTS shard;

-- Create query performance history table
CREATE TABLE IF NOT EXISTS query_performance_history (
    id SERIAL PRIMARY KEY,
    query_hash TEXT NOT NULL,
    query_text TEXT NOT NULL,
    execution_time FLOAT NOT NULL,
    rows_affected INTEGER,
    index_usage INTEGER,
    buffer_hits INTEGER,
    buffer_misses INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tenant_id INTEGER NOT NULL
);

-- Create index on query performance history
CREATE INDEX IF NOT EXISTS idx_query_performance_timestamp 
ON query_performance_history(timestamp);

-- Create partitioned tables for large datasets
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL,
    workflow_id INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time FLOAT,
    resource_usage JSONB,
    optimization_suggestions JSONB,
    risk_alerts JSONB,
    tenant_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for workflow executions
CREATE TABLE IF NOT EXISTS workflow_executions_y2024m01 
PARTITION OF workflow_executions 
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS workflow_executions_y2024m02 
PARTITION OF workflow_executions 
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Create indexes on partitioned tables
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id 
ON workflow_executions(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_status 
ON workflow_executions(status);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant_id 
ON workflow_executions(tenant_id);

-- Create materialized views for frequently accessed data
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_workflow_metrics AS
SELECT 
    w.id as workflow_id,
    w.name as workflow_name,
    COUNT(we.id) as total_executions,
    AVG(we.execution_time) as avg_execution_time,
    MAX(we.execution_time) as max_execution_time,
    MIN(we.execution_time) as min_execution_time,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
    w.tenant_id
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
GROUP BY w.id, w.name, w.tenant_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_workflow_metrics_workflow_id 
ON mv_workflow_metrics(workflow_id);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_workflow_metrics;
END;
$$ LANGUAGE plpgsql;

-- Create function for automatic partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    next_month DATE;
    partition_name TEXT;
BEGIN
    next_month := date_trunc('month', CURRENT_DATE + INTERVAL '1 month');
    partition_name := 'workflow_executions_y' || 
                     to_char(next_month, 'YYYY') || 'm' ||
                     to_char(next_month, 'MM');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF workflow_executions 
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        next_month,
        next_month + INTERVAL '1 month'
    );
END;
$$ LANGUAGE plpgsql;

-- Create function for query optimization
CREATE OR REPLACE FUNCTION optimize_query(query_text TEXT)
RETURNS JSONB AS $$
DECLARE
    query_plan JSONB;
    optimized_query TEXT;
BEGIN
    -- Get query execution plan
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || query_text 
    INTO query_plan;
    
    -- Analyze plan and generate optimizations
    -- This is a simplified example - in practice, you'd use the AI optimizer
    IF query_plan->0->>'Node Type' = 'Seq Scan' THEN
        optimized_query := regexp_replace(
            query_text,
            'WHERE',
            'WHERE /*+ INDEX(table_name idx_name) */'
        );
    ELSE
        optimized_query := query_text;
    END IF;
    
    RETURN jsonb_build_object(
        'original_query', query_text,
        'optimized_query', optimized_query,
        'execution_plan', query_plan
    );
END;
$$ LANGUAGE plpgsql;

-- Create function for automatic vacuum and analyze
CREATE OR REPLACE FUNCTION maintain_tables()
RETURNS void AS $$
BEGIN
    -- Vacuum tables
    VACUUM ANALYZE workflow_executions;
    VACUUM ANALYZE query_performance_history;
    
    -- Update statistics
    ANALYZE workflow_executions;
    ANALYZE query_performance_history;
END;
$$ LANGUAGE plpgsql;

-- Create function for backup management
CREATE OR REPLACE FUNCTION backup_database()
RETURNS void AS $$
DECLARE
    backup_path TEXT;
    timestamp TEXT;
BEGIN
    timestamp := to_char(CURRENT_TIMESTAMP, 'YYYYMMDD_HH24MISS');
    backup_path := '/backup/aetheriq_' || timestamp;
    
    -- Perform backup using pg_dump
    EXECUTE format(
        'pg_dump -Fc -f %L aetheriq',
        backup_path
    );
END;
$$ LANGUAGE plpgsql;

-- Create function for failover detection
CREATE OR REPLACE FUNCTION check_replica_status()
RETURNS JSONB AS $$
DECLARE
    replica_status JSONB;
BEGIN
    -- Check replica lag and status
    SELECT jsonb_build_object(
        'replica_name', application_name,
        'lag', EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INT,
        'status', CASE 
            WHEN pg_is_in_recovery() THEN 'replica'
            ELSE 'primary'
        END
    )
    FROM pg_stat_replication
    INTO replica_status;
    
    RETURN replica_status;
END;
$$ LANGUAGE plpgsql;

-- Create function for automatic index maintenance
CREATE OR REPLACE FUNCTION maintain_indexes()
RETURNS void AS $$
DECLARE
    index_record RECORD;
BEGIN
    FOR index_record IN 
        SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
    LOOP
        -- Log unused indexes
        RAISE NOTICE 'Unused index: %.%.%', 
            index_record.schemaname,
            index_record.tablename,
            index_record.indexname;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled jobs
SELECT cron.schedule('0 0 * * *', $$SELECT create_monthly_partition()$$);
SELECT cron.schedule('0 1 * * *', $$SELECT refresh_materialized_views()$$);
SELECT cron.schedule('0 2 * * *', $$SELECT maintain_tables()$$);
SELECT cron.schedule('0 3 * * *', $$SELECT backup_database()$$);
SELECT cron.schedule('*/5 * * * *', $$SELECT check_replica_status()$$);
SELECT cron.schedule('0 4 * * *', $$SELECT maintain_indexes()$$);

-- Create monitoring views
CREATE OR REPLACE VIEW v_database_health AS
SELECT 
    current_timestamp as check_time,
    (SELECT count(*) FROM pg_stat_activity) as active_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) as waiting_connections,
    (SELECT sum(blks_hit)::float / NULLIF(sum(blks_hit + blks_read), 0) 
     FROM pg_stat_database) as cache_hit_ratio,
    (SELECT count(*) FROM pg_stat_user_tables 
     WHERE n_dead_tup > 1000) as tables_needing_vacuum;

-- Create function for performance reporting
CREATE OR REPLACE FUNCTION get_performance_report()
RETURNS JSONB AS $$
DECLARE
    report JSONB;
BEGIN
    SELECT jsonb_build_object(
        'database_health', (SELECT row_to_json(v_database_health.*) FROM v_database_health),
        'slow_queries', (
            SELECT jsonb_agg(row_to_json(q))
            FROM (
                SELECT 
                    query,
                    calls,
                    total_time,
                    mean_time,
                    rows
                FROM pg_stat_statements
                ORDER BY mean_time DESC
                LIMIT 10
            ) q
        ),
        'table_statistics', (
            SELECT jsonb_agg(row_to_json(t))
            FROM (
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
            ) t
        )
    )
    INTO report;
    
    RETURN report;
END;
$$ LANGUAGE plpgsql;

-- Create compliance tables
CREATE TABLE IF NOT EXISTS compliance_violations (
    id SERIAL PRIMARY KEY,
    policy_name TEXT NOT NULL,
    violation_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    affected_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    risk_score FLOAT NOT NULL,
    remediation_steps JSONB,
    workflow_id INTEGER,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_checks (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    violations JSONB,
    risk_scores JSONB,
    overall_risk_score FLOAT NOT NULL,
    anomaly_score FLOAT NOT NULL,
    recommendations JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_consents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    data_type TEXT NOT NULL,
    consent_status TEXT NOT NULL,
    consent_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, data_type)
);

CREATE TABLE IF NOT EXISTS user_phi_authorizations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    phi_access_level INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    granted_by INTEGER NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for compliance tables
CREATE INDEX IF NOT EXISTS idx_compliance_violations_policy 
ON compliance_violations(policy_name);

CREATE INDEX IF NOT EXISTS idx_compliance_violations_severity 
ON compliance_violations(severity);

CREATE INDEX IF NOT EXISTS idx_compliance_violations_timestamp 
ON compliance_violations(timestamp);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_workflow 
ON compliance_checks(workflow_id);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_status 
ON compliance_checks(status);

CREATE INDEX IF NOT EXISTS idx_user_consents_user 
ON user_consents(user_id);

CREATE INDEX IF NOT EXISTS idx_user_consents_status 
ON user_consents(consent_status);

CREATE INDEX IF NOT EXISTS idx_user_phi_authorizations_user 
ON user_phi_authorizations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_phi_authorizations_level 
ON user_phi_authorizations(phi_access_level);

-- Create materialized view for compliance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_compliance_metrics AS
SELECT 
    policy_name,
    COUNT(*) as total_violations,
    AVG(risk_score) as avg_risk_score,
    MAX(risk_score) as max_risk_score,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_violations,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_violations,
    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_violations,
    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_violations,
    date_trunc('day', timestamp) as check_date
FROM compliance_violations
GROUP BY policy_name, date_trunc('day', timestamp);

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_compliance_metrics_policy_date 
ON mv_compliance_metrics(policy_name, check_date);

-- Create function to refresh compliance metrics
CREATE OR REPLACE FUNCTION refresh_compliance_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_metrics;
END;
$$ LANGUAGE plpgsql;

-- Schedule compliance metrics refresh
SELECT cron.schedule('0 5 * * *', $$SELECT refresh_compliance_metrics()$$);

-- Create function for compliance reporting
CREATE OR REPLACE FUNCTION generate_compliance_report(
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
    report JSONB;
BEGIN
    SELECT jsonb_build_object(
        'period', jsonb_build_object(
            'start_date', start_date,
            'end_date', end_date
        ),
        'violations', (
            SELECT jsonb_agg(row_to_json(v))
            FROM (
                SELECT 
                    policy_name,
                    COUNT(*) as total_violations,
                    AVG(risk_score) as avg_risk_score,
                    MAX(risk_score) as max_risk_score,
                    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_violations,
                    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_violations,
                    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_violations,
                    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_violations
                FROM compliance_violations
                WHERE timestamp BETWEEN start_date AND end_date
                GROUP BY policy_name
            ) v
        ),
        'consent_status', (
            SELECT jsonb_agg(row_to_json(c))
            FROM (
                SELECT 
                    data_type,
                    COUNT(*) as total_consents,
                    COUNT(CASE WHEN consent_status = 'active' THEN 1 END) as active_consents,
                    COUNT(CASE WHEN consent_status = 'expired' THEN 1 END) as expired_consents
                FROM user_consents
                WHERE consent_date BETWEEN start_date AND end_date
                GROUP BY data_type
            ) c
        ),
        'phi_access', (
            SELECT jsonb_agg(row_to_json(p))
            FROM (
                SELECT 
                    phi_access_level,
                    COUNT(*) as total_authorizations,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_authorizations
                FROM user_phi_authorizations
                WHERE granted_at BETWEEN start_date AND end_date
                GROUP BY phi_access_level
            ) p
        )
    )
    INTO report;
    
    RETURN report;
END;
$$ LANGUAGE plpgsql;

-- Create failover tables
CREATE TABLE IF NOT EXISTS job_states (
    job_id TEXT PRIMARY KEY,
    workflow_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    checkpoint_data JSONB,
    last_checkpoint TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    priority INTEGER DEFAULT 0,
    dependencies JSONB,
    node_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_failures (
    id SERIAL PRIMARY KEY,
    job_id TEXT NOT NULL,
    workflow_id INTEGER NOT NULL,
    failure_reason TEXT NOT NULL,
    checkpoint_data JSONB,
    retry_count INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_capabilities (
    id SERIAL PRIMARY KEY,
    node_id TEXT NOT NULL,
    workflow_type TEXT NOT NULL,
    max_concurrent_jobs INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(node_id, workflow_type)
);

CREATE TABLE IF NOT EXISTS node_health (
    node_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    role TEXT NOT NULL,
    load FLOAT NOT NULL,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    capabilities JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for failover tables
CREATE INDEX IF NOT EXISTS idx_job_states_status 
ON job_states(status);

CREATE INDEX IF NOT EXISTS idx_job_states_workflow 
ON job_states(workflow_id);

CREATE INDEX IF NOT EXISTS idx_job_states_node 
ON job_states(node_id);

CREATE INDEX IF NOT EXISTS idx_job_failures_job 
ON job_failures(job_id);

CREATE INDEX IF NOT EXISTS idx_job_failures_workflow 
ON job_failures(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_capabilities_node 
ON workflow_capabilities(node_id);

CREATE INDEX IF NOT EXISTS idx_workflow_capabilities_type 
ON workflow_capabilities(workflow_type);

-- Create function to update node health
CREATE OR REPLACE FUNCTION update_node_health(
    p_node_id TEXT,
    p_status TEXT,
    p_role TEXT,
    p_load FLOAT,
    p_capabilities JSONB
)
RETURNS void AS $$
BEGIN
    INSERT INTO node_health (
        node_id,
        status,
        role,
        load,
        last_heartbeat,
        capabilities,
        updated_at
    ) VALUES (
        p_node_id,
        p_status,
        p_role,
        p_load,
        CURRENT_TIMESTAMP,
        p_capabilities,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (node_id) DO UPDATE
    SET status = EXCLUDED.status,
        role = EXCLUDED.role,
        load = EXCLUDED.load,
        last_heartbeat = EXCLUDED.last_heartbeat,
        capabilities = EXCLUDED.capabilities,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create function to get failed jobs
CREATE OR REPLACE FUNCTION get_failed_jobs()
RETURNS TABLE (
    job_id TEXT,
    workflow_id INTEGER,
    status TEXT,
    checkpoint_data JSONB,
    last_checkpoint TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER,
    max_retries INTEGER,
    priority INTEGER,
    dependencies JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        js.job_id,
        js.workflow_id,
        js.status,
        js.checkpoint_data,
        js.last_checkpoint,
        js.retry_count,
        js.max_retries,
        js.priority,
        js.dependencies,
        js.created_at,
        js.updated_at
    FROM job_states js
    WHERE js.status = 'failed'
    AND js.retry_count < js.max_retries
    ORDER BY js.priority DESC, js.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to update job state
CREATE OR REPLACE FUNCTION update_job_state(
    p_job_id TEXT,
    p_status TEXT,
    p_checkpoint_data JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE job_states
    SET status = p_status,
        checkpoint_data = COALESCE(p_checkpoint_data, checkpoint_data),
        last_checkpoint = CASE 
            WHEN p_checkpoint_data IS NOT NULL THEN CURRENT_TIMESTAMP
            ELSE last_checkpoint
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE job_id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment retry count
CREATE OR REPLACE FUNCTION increment_retry_count(p_job_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE job_states
    SET retry_count = retry_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE job_id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to log job failure
CREATE OR REPLACE FUNCTION log_job_failure(
    p_job_id TEXT,
    p_workflow_id INTEGER,
    p_failure_reason TEXT,
    p_checkpoint_data JSONB,
    p_retry_count INTEGER
)
RETURNS void AS $$
BEGIN
    INSERT INTO job_failures (
        job_id,
        workflow_id,
        failure_reason,
        checkpoint_data,
        retry_count
    ) VALUES (
        p_job_id,
        p_workflow_id,
        p_failure_reason,
        p_checkpoint_data,
        p_retry_count
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to get node capabilities
CREATE OR REPLACE FUNCTION get_node_capabilities(p_node_id TEXT)
RETURNS TABLE (
    workflow_type TEXT,
    max_concurrent_jobs INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wc.workflow_type,
        wc.max_concurrent_jobs
    FROM workflow_capabilities wc
    WHERE wc.node_id = p_node_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get node health
CREATE OR REPLACE FUNCTION get_node_health(p_node_id TEXT)
RETURNS TABLE (
    status TEXT,
    role TEXT,
    load FLOAT,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    capabilities JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        nh.status,
        nh.role,
        nh.load,
        nh.last_heartbeat,
        nh.capabilities
    FROM node_health nh
    WHERE nh.node_id = p_node_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get active nodes
CREATE OR REPLACE FUNCTION get_active_nodes()
RETURNS TABLE (
    node_id TEXT,
    status TEXT,
    role TEXT,
    load FLOAT,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    capabilities JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        nh.node_id,
        nh.status,
        nh.role,
        nh.load,
        nh.last_heartbeat,
        nh.capabilities
    FROM node_health nh
    WHERE nh.status = 'active'
    AND nh.last_heartbeat > CURRENT_TIMESTAMP - INTERVAL '30 seconds'
    ORDER BY nh.load ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get failed jobs count
CREATE OR REPLACE FUNCTION get_failed_jobs_count()
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO count
    FROM job_states
    WHERE status = 'failed'
    AND retry_count < max_retries;
    
    RETURN count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get node load
CREATE OR REPLACE FUNCTION get_node_load(p_node_id TEXT)
RETURNS FLOAT AS $$
DECLARE
    load FLOAT;
BEGIN
    SELECT COUNT(*)::FLOAT / NULLIF(MAX(wc.max_concurrent_jobs), 0)
    INTO load
    FROM job_states js
    JOIN workflow_capabilities wc ON js.workflow_id = wc.workflow_type
    WHERE js.node_id = p_node_id
    AND js.status = 'running';
    
    RETURN COALESCE(load, 0.0);
END;
$$ LANGUAGE plpgsql;

-- Create function to get failover status
CREATE OR REPLACE FUNCTION get_failover_status()
RETURNS JSONB AS $$
DECLARE
    status JSONB;
BEGIN
    SELECT jsonb_build_object(
        'active_nodes', (
            SELECT jsonb_agg(row_to_json(nh))
            FROM node_health nh
            WHERE nh.status = 'active'
            AND nh.last_heartbeat > CURRENT_TIMESTAMP - INTERVAL '30 seconds'
        ),
        'failed_jobs', get_failed_jobs_count(),
        'node_health', (
            SELECT jsonb_agg(row_to_json(nh))
            FROM node_health nh
        )
    )
    INTO status;
    
    RETURN status;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up stale nodes
CREATE OR REPLACE FUNCTION cleanup_stale_nodes()
RETURNS void AS $$
BEGIN
    UPDATE node_health
    SET status = 'inactive'
    WHERE last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '30 seconds'
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup of stale nodes
SELECT cron.schedule('*/5 * * * *', $$SELECT cleanup_stale_nodes()$$);

-- Error handling tables
CREATE TABLE error_patterns (
    id SERIAL PRIMARY KEY,
    error_type VARCHAR(255) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    severity VARCHAR(50) NOT NULL,
    workflow_id INTEGER REFERENCES workflows(id),
    retry_count INTEGER DEFAULT 0,
    resolution_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE error_recovery_attempts (
    id SERIAL PRIMARY KEY,
    error_pattern_id INTEGER REFERENCES error_patterns(id),
    attempt_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    result JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE error_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    total_errors INTEGER DEFAULT 0,
    critical_errors INTEGER DEFAULT 0,
    high_errors INTEGER DEFAULT 0,
    medium_errors INTEGER DEFAULT 0,
    low_errors INTEGER DEFAULT 0,
    resolved_errors INTEGER DEFAULT 0,
    pending_errors INTEGER DEFAULT 0,
    failed_errors INTEGER DEFAULT 0,
    average_resolution_time FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- Indexes
CREATE INDEX idx_error_patterns_workflow_id ON error_patterns(workflow_id);
CREATE INDEX idx_error_patterns_severity ON error_patterns(severity);
CREATE INDEX idx_error_patterns_status ON error_patterns(resolution_status);
CREATE INDEX idx_error_patterns_timestamp ON error_patterns(timestamp);
CREATE INDEX idx_error_recovery_attempts_pattern_id ON error_recovery_attempts(error_pattern_id);
CREATE INDEX idx_error_metrics_date ON error_metrics(date);

-- Functions
CREATE OR REPLACE FUNCTION update_error_pattern(
    p_id INTEGER,
    p_resolution_status VARCHAR,
    p_retry_count INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE error_patterns
    SET resolution_status = p_resolution_status,
        retry_count = COALESCE(p_retry_count, retry_count),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_error_recovery_attempt(
    p_error_pattern_id INTEGER,
    p_attempt_type VARCHAR,
    p_status VARCHAR,
    p_result JSONB DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO error_recovery_attempts (
        error_pattern_id,
        attempt_type,
        status,
        result
    ) VALUES (
        p_error_pattern_id,
        p_attempt_type,
        p_status,
        p_result
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_error_metrics() RETURNS VOID AS $$
BEGIN
    INSERT INTO error_metrics (
        date,
        total_errors,
        critical_errors,
        high_errors,
        medium_errors,
        low_errors,
        resolved_errors,
        pending_errors,
        failed_errors,
        average_resolution_time
    )
    SELECT 
        CURRENT_DATE,
        COUNT(*),
        COUNT(CASE WHEN severity = 'critical' THEN 1 END),
        COUNT(CASE WHEN severity = 'high' THEN 1 END),
        COUNT(CASE WHEN severity = 'medium' THEN 1 END),
        COUNT(CASE WHEN severity = 'low' THEN 1 END),
        COUNT(CASE WHEN resolution_status = 'resolved' THEN 1 END),
        COUNT(CASE WHEN resolution_status = 'pending' THEN 1 END),
        COUNT(CASE WHEN resolution_status = 'failed' THEN 1 END),
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))
    FROM error_patterns
    WHERE timestamp >= CURRENT_DATE - INTERVAL '1 day'
    ON CONFLICT (date) DO UPDATE SET
        total_errors = EXCLUDED.total_errors,
        critical_errors = EXCLUDED.critical_errors,
        high_errors = EXCLUDED.high_errors,
        medium_errors = EXCLUDED.medium_errors,
        low_errors = EXCLUDED.low_errors,
        resolved_errors = EXCLUDED.resolved_errors,
        pending_errors = EXCLUDED.pending_errors,
        failed_errors = EXCLUDED.failed_errors,
        average_resolution_time = EXCLUDED.average_resolution_time;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job to update error metrics
SELECT cron.schedule('0 0 * * *', $$
    SELECT update_error_metrics();
$$);

-- Materialized view for error patterns
CREATE MATERIALIZED VIEW mv_error_patterns AS
SELECT 
    ep.id,
    ep.error_type,
    ep.error_message,
    ep.severity,
    ep.workflow_id,
    ep.retry_count,
    ep.resolution_status,
    ep.timestamp,
    ep.created_at,
    w.name as workflow_name,
    COUNT(era.id) as recovery_attempts,
    MAX(era.timestamp) as last_attempt
FROM error_patterns ep
LEFT JOIN workflows w ON ep.workflow_id = w.id
LEFT JOIN error_recovery_attempts era ON ep.id = era.error_pattern_id
GROUP BY ep.id, w.name;

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_error_patterns_view() RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_error_patterns;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job to refresh materialized view
SELECT cron.schedule('*/15 * * * *', $$
    SELECT refresh_error_patterns_view();
$$);

-- License Management Tables

CREATE TABLE licenses (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    assigned_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    features JSONB NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE user_access (
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    roles JSONB NOT NULL,
    permissions JSONB NOT NULL,
    last_access TIMESTAMP,
    access_patterns JSONB,
    risk_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, tenant_id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE license_usage (
    id SERIAL PRIMARY KEY,
    license_id VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    feature VARCHAR(50) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_license FOREIGN KEY (license_id) REFERENCES licenses(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Indexes for License Management

CREATE INDEX idx_licenses_user_tenant ON licenses(user_id, tenant_id);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_expires_at ON licenses(expires_at);
CREATE INDEX idx_licenses_last_used_at ON licenses(last_used_at);

CREATE INDEX idx_user_access_last_access ON user_access(last_access);
CREATE INDEX idx_user_access_risk_score ON user_access(risk_score);

CREATE INDEX idx_access_logs_user_tenant ON access_logs(user_id, tenant_id);
CREATE INDEX idx_access_logs_action ON access_logs(action);
CREATE INDEX idx_access_logs_timestamp ON access_logs(timestamp);

CREATE INDEX idx_license_usage_license ON license_usage(license_id);
CREATE INDEX idx_license_usage_feature ON license_usage(feature);
CREATE INDEX idx_license_usage_last_used ON license_usage(last_used_at);

-- Functions for License Management

CREATE OR REPLACE FUNCTION update_license_usage(
    p_license_id VARCHAR,
    p_user_id INTEGER,
    p_tenant_id INTEGER,
    p_feature VARCHAR
) RETURNS VOID AS $$
BEGIN
    INSERT INTO license_usage (
        license_id,
        user_id,
        tenant_id,
        feature
    ) VALUES (
        p_license_id,
        p_user_id,
        p_tenant_id,
        p_feature
    )
    ON CONFLICT (license_id, feature) DO UPDATE
    SET usage_count = license_usage.usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP;
    
    UPDATE licenses
    SET usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_license_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_access_patterns(
    p_user_id INTEGER,
    p_tenant_id INTEGER,
    p_pattern JSONB
) RETURNS VOID AS $$
BEGIN
    UPDATE user_access
    SET access_patterns = COALESCE(access_patterns, '[]'::jsonb) || p_pattern,
        last_access = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_license_risk_score(
    p_license_id VARCHAR
) RETURNS DECIMAL AS $$
DECLARE
    v_risk_score DECIMAL;
    v_days_since_use INTEGER;
    v_days_to_expiry INTEGER;
    v_usage_count INTEGER;
BEGIN
    SELECT 
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(last_used_at, assigned_at))) / 86400,
        CASE 
            WHEN expires_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) / 86400
            ELSE 999999
        END,
        usage_count
    INTO v_days_since_use, v_days_to_expiry, v_usage_count
    FROM licenses
    WHERE id = p_license_id;
    
    -- Calculate risk score based on various factors
    v_risk_score := 
        CASE 
            WHEN v_days_since_use > 90 THEN 1.0  -- High risk if unused for 90+ days
            WHEN v_days_since_use > 30 THEN 0.8  -- Medium risk if unused for 30+ days
            WHEN v_days_to_expiry < 7 THEN 0.9   -- High risk if expiring soon
            WHEN v_days_to_expiry < 30 THEN 0.7  -- Medium risk if expiring in 30 days
            WHEN v_usage_count = 0 THEN 0.6      -- Medium risk if never used
            ELSE 0.3                             -- Low risk otherwise
        END;
    
    RETURN v_risk_score;
END;
$$ LANGUAGE plpgsql;

-- Materialized View for License Analytics

CREATE MATERIALIZED VIEW mv_license_analytics AS
SELECT 
    l.tenant_id,
    COUNT(*) as total_licenses,
    COUNT(*) FILTER (WHERE l.status = 'active') as active_licenses,
    COUNT(*) FILTER (WHERE l.status = 'expired') as expired_licenses,
    COUNT(*) FILTER (WHERE l.status = 'suspended') as suspended_licenses,
    SUM(l.cost) as total_cost,
    AVG(calculate_license_risk_score(l.id)) as avg_risk_score,
    COUNT(*) FILTER (WHERE l.last_used_at IS NULL OR l.last_used_at < CURRENT_TIMESTAMP - INTERVAL '90 days') as unused_licenses,
    COUNT(*) FILTER (WHERE l.expires_at IS NOT NULL AND l.expires_at < CURRENT_TIMESTAMP + INTERVAL '30 days') as expiring_licenses
FROM licenses l
GROUP BY l.tenant_id;

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_license_analytics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_license_analytics;
END;
$$ LANGUAGE plpgsql;

-- Schedule the refresh job
SELECT cron.schedule('0 0 * * *', $$SELECT refresh_license_analytics()$$);

-- Function to generate license report
CREATE OR REPLACE FUNCTION generate_license_report(
    p_tenant_id INTEGER,
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP
) RETURNS JSONB AS $$
DECLARE
    v_report JSONB;
BEGIN
    SELECT jsonb_build_object(
        'summary', jsonb_build_object(
            'total_licenses', COUNT(*),
            'active_licenses', COUNT(*) FILTER (WHERE status = 'active'),
            'total_cost', SUM(cost),
            'avg_risk_score', AVG(calculate_license_risk_score(id))
        ),
        'unused_licenses', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'type', type,
                'user_id', user_id,
                'last_used_at', last_used_at,
                'cost', cost
            ))
            FROM licenses
            WHERE tenant_id = p_tenant_id
            AND (last_used_at IS NULL OR last_used_at < CURRENT_TIMESTAMP - INTERVAL '90 days')
        ),
        'high_risk_licenses', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'type', type,
                'user_id', user_id,
                'risk_score', calculate_license_risk_score(id),
                'expires_at', expires_at
            ))
            FROM licenses
            WHERE tenant_id = p_tenant_id
            AND calculate_license_risk_score(id) > 0.7
        ),
        'usage_patterns', (
            SELECT jsonb_agg(jsonb_build_object(
                'feature', feature,
                'total_usage', SUM(usage_count),
                'unique_users', COUNT(DISTINCT user_id)
            ))
            FROM license_usage
            WHERE tenant_id = p_tenant_id
            AND last_used_at BETWEEN p_start_date AND p_end_date
            GROUP BY feature
        )
    )
    INTO v_report
    FROM licenses
    WHERE tenant_id = p_tenant_id;
    
    RETURN v_report;
END;
$$ LANGUAGE plpgsql; 