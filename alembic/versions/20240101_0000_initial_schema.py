"""Initial database schema

Revision ID: 20240101_0000
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20240101_0000'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create enum types
    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user')")
    op.execute("CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled')")
    op.execute("CREATE TYPE integration_type AS ENUM ('api', 'database', 'message_queue', 'file_system', 'custom')")

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String()),
        sa.Column('role', postgresql.ENUM('admin', 'manager', 'user', name='user_role'), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now())
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # Create workflows table
    op.create_table(
        'workflows',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String()),
        sa.Column('template_id', sa.String(), nullable=False),
        sa.Column('parameters', postgresql.JSON()),
        sa.Column('status', postgresql.ENUM('pending', 'running', 'completed', 'failed', 'cancelled', name='workflow_status'), nullable=False),
        sa.Column('priority', sa.Integer(), default=0),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('started_at', sa.DateTime()),
        sa.Column('completed_at', sa.DateTime())
    )

    # Create workflow_tasks table
    op.create_table(
        'workflow_tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workflows.id')),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('task_type', sa.String(), nullable=False),
        sa.Column('parameters', postgresql.JSON()),
        sa.Column('status', postgresql.ENUM('pending', 'running', 'completed', 'failed', 'cancelled', name='workflow_status'), nullable=False),
        sa.Column('result', postgresql.JSON()),
        sa.Column('error_message', sa.String()),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('started_at', sa.DateTime()),
        sa.Column('completed_at', sa.DateTime())
    )

    # Create integrations table
    op.create_table(
        'integrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String()),
        sa.Column('integration_type', postgresql.ENUM('api', 'database', 'message_queue', 'file_system', 'custom', name='integration_type'), nullable=False),
        sa.Column('config', postgresql.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('last_health_check', sa.DateTime()),
        sa.Column('health_status', sa.Boolean())
    )

    # Create analytics table
    op.create_table(
        'analytics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workflow_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workflows.id')),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('metric_value', postgresql.JSON(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), default=sa.func.now()),
        sa.Column('metadata', postgresql.JSON())
    )

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('integration_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('integrations.id')),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource_type', sa.String(), nullable=False),
        sa.Column('resource_id', sa.String()),
        sa.Column('details', postgresql.JSON()),
        sa.Column('timestamp', sa.DateTime(), default=sa.func.now()),
        sa.Column('ip_address', sa.String()),
        sa.Column('user_agent', sa.String())
    )

    # Create compliance_checks table
    op.create_table(
        'compliance_checks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('framework', sa.String(), nullable=False),
        sa.Column('resource_type', sa.String(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=False),
        sa.Column('check_result', sa.Boolean(), nullable=False),
        sa.Column('details', postgresql.JSON()),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('remediation_steps', postgresql.JSON()),
        sa.Column('severity', sa.String())
    )

    # Create system_metrics table
    op.create_table(
        'system_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('metric_name', sa.String(), nullable=False),
        sa.Column('metric_value', postgresql.JSON(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), default=sa.func.now()),
        sa.Column('metadata', postgresql.JSON())
    )

def downgrade() -> None:
    # Drop tables
    op.drop_table('system_metrics')
    op.drop_table('compliance_checks')
    op.drop_table('audit_logs')
    op.drop_table('analytics')
    op.drop_table('integrations')
    op.drop_table('workflow_tasks')
    op.drop_table('workflows')
    op.drop_table('users')

    # Drop enum types
    op.execute('DROP TYPE user_role')
    op.execute('DROP TYPE workflow_status')
    op.execute('DROP TYPE integration_type') 