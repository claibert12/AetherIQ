-- Create workflow_executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    output_data JSONB,
    error_message TEXT,
    execution_time FLOAT,
    resource_usage JSONB NOT NULL,
    optimization_suggestions JSONB,
    risk_alerts JSONB,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow_optimizations table
CREATE TABLE IF NOT EXISTS workflow_optimizations (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id),
    optimization_plan JSONB NOT NULL,
    status VARCHAR(50) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL,
    results JSONB,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow_metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_workflow_metrics AS
SELECT 
    w.id as workflow_id,
    w.name,
    COUNT(we.id) as total_executions,
    AVG(we.execution_time) as avg_execution_time,
    MAX(we.execution_time) as max_execution_time,
    MIN(we.execution_time) as min_execution_time,
    COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
    w.tenant_id
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
GROUP BY w.id, w.name, w.tenant_id;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant_id ON workflow_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

CREATE INDEX IF NOT EXISTS idx_workflow_optimizations_workflow_id ON workflow_optimizations(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_optimizations_tenant_id ON workflow_optimizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_optimizations_status ON workflow_optimizations(status);
CREATE INDEX IF NOT EXISTS idx_workflow_optimizations_applied_at ON workflow_optimizations(applied_at);

-- Create function to refresh workflow metrics
CREATE OR REPLACE FUNCTION refresh_workflow_metrics()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_workflow_metrics;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh metrics
CREATE TRIGGER refresh_workflow_metrics_trigger
AFTER INSERT OR UPDATE OR DELETE ON workflow_executions
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_workflow_metrics();

-- Add RLS policies
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_executions_tenant_isolation ON workflow_executions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::integer);

CREATE POLICY workflow_optimizations_tenant_isolation ON workflow_optimizations
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::integer); 