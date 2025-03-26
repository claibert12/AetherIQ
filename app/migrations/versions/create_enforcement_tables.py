"""create enforcement tables

Revision ID: 001_create_enforcement_tables
Revises: 
Create Date: 2024-03-25 01:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_create_enforcement_tables'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create enforcement_rule table
    op.create_table(
        'enforcement_rule',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('capability', sa.String(), nullable=False),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('conditions', sa.JSON(), nullable=False),
        sa.Column('exceptions', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_enforcement_rule_id', 'enforcement_rule', ['id'])
    op.create_index('ix_enforcement_rule_name', 'enforcement_rule', ['name'])

    # Create enforcement_policy table
    op.create_table(
        'enforcement_policy',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('default_action', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_enforcement_policy_id', 'enforcement_policy', ['id'])
    op.create_index('ix_enforcement_policy_name', 'enforcement_policy', ['name'])

    # Create policy_rules association table
    op.create_table(
        'policy_rules',
        sa.Column('policy_id', sa.String(), nullable=False),
        sa.Column('rule_id', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['policy_id'], ['enforcement_policy.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['rule_id'], ['enforcement_rule.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('policy_id', 'rule_id')
    )

    # Create enforcement_audit_log table
    op.create_table(
        'enforcement_audit_log',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=False),
        sa.Column('capability', sa.String(), nullable=False),
        sa.Column('request_data', sa.JSON(), nullable=False),
        sa.Column('applied_rule_id', sa.String(), nullable=True),
        sa.Column('applied_policy_id', sa.String(), nullable=True),
        sa.Column('action_taken', sa.String(), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=False, server_default='{}'),
        sa.ForeignKeyConstraint(['applied_policy_id'], ['enforcement_policy.id'], ),
        sa.ForeignKeyConstraint(['applied_rule_id'], ['enforcement_rule.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_enforcement_audit_log_id', 'enforcement_audit_log', ['id'])
    op.create_index('ix_enforcement_audit_log_user_id', 'enforcement_audit_log', ['user_id'])
    op.create_index('ix_enforcement_audit_log_organization_id', 'enforcement_audit_log', ['organization_id'])

def downgrade():
    op.drop_table('enforcement_audit_log')
    op.drop_table('policy_rules')
    op.drop_table('enforcement_policy')
    op.drop_table('enforcement_rule') 