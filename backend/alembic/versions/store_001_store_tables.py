"""Store module tables: projects, stages, materials, challans, boq, alerts

Revision ID: store_001
Revises: 002
Create Date: 2026-10-09 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'store_001'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. projects
    if 'projects' not in existing_tables:
        op.create_table(
            'projects',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('site_address', sa.String(length=255), nullable=True),
            sa.Column('centroid_lat', sa.Float(), nullable=True),
            sa.Column('centroid_lng', sa.Float(), nullable=True),
            sa.Column('site_radius_m', sa.Float(), server_default='200.0', nullable=False),
            sa.Column('start_date', sa.Date(), nullable=True),
            sa.Column('end_date', sa.Date(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_projects_id'), 'projects', ['id'], unique=False)

    # 2. project_members
    if 'project_members' not in existing_tables:
        op.create_table(
            'project_members',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('role', sa.String(length=50), nullable=False),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_project_members_id'), 'project_members', ['id'], unique=False)

    # 3. project_settings
    if 'project_settings' not in existing_tables:
        op.create_table(
            'project_settings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('boq_tolerance_pct', sa.Numeric(precision=5, scale=2), server_default='5.0', nullable=False),
            sa.Column('expected_usage_tolerance', sa.Numeric(precision=5, scale=2), server_default='0.15', nullable=False),
            sa.Column('zscore_limit', sa.Numeric(precision=5, scale=2), server_default='2.5', nullable=False),
            sa.Column('allow_new_vendors', sa.Integer(), server_default='1', nullable=False),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('project_id')
        )
        op.create_index(op.f('ix_project_settings_id'), 'project_settings', ['id'], unique=False)

    # 4. stages
    if 'stages' not in existing_tables:
        op.create_table(
            'stages',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('order', sa.Integer(), server_default='1', nullable=False),
            sa.Column('status', sa.String(length=50), server_default='PENDING', nullable=False),
            sa.Column('verified_progress', sa.Numeric(precision=5, scale=4), server_default='0.0', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_stages_id'), 'stages', ['id'], unique=False)

    # 5. materials
    if 'materials' not in existing_tables:
        op.create_table(
            'materials',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('base_unit', sa.String(length=50), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_materials_id'), 'materials', ['id'], unique=False)
        op.create_index(op.f('ix_materials_name'), 'materials', ['name'], unique=True)

    # 6. unit_conversions
    if 'unit_conversions' not in existing_tables:
        op.create_table(
            'unit_conversions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('material_id', sa.Integer(), nullable=False),
            sa.Column('unit', sa.String(length=50), nullable=False),
            sa.Column('factor_to_base', sa.Numeric(precision=14, scale=4), nullable=False),
            sa.ForeignKeyConstraint(['material_id'], ['materials.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_unit_conversions_id'), 'unit_conversions', ['id'], unique=False)

    # 7. vendors
    if 'vendors' not in existing_tables:
        op.create_table(
            'vendors',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('is_approved', sa.Boolean(), server_default=sa.text('1'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_vendors_id'), 'vendors', ['id'], unique=False)
        op.create_index(op.f('ix_vendors_name'), 'vendors', ['name'], unique=True)

    # 8. boq_items
    if 'boq_items' not in existing_tables:
        op.create_table(
            'boq_items',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('stage_id', sa.Integer(), nullable=True),
            sa.Column('material_id', sa.Integer(), nullable=False),
            sa.Column('planned_qty', sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column('unit', sa.String(length=50), nullable=False),
            sa.Column('planned_qty_base', sa.Numeric(precision=14, scale=4), nullable=False),
            sa.ForeignKeyConstraint(['material_id'], ['materials.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['stage_id'], ['stages.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_boq_items_id'), 'boq_items', ['id'], unique=False)

    # 9. challans
    if 'challans' not in existing_tables:
        op.create_table(
            'challans',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('vendor_id', sa.Integer(), nullable=True),
            sa.Column('vendor_name_raw', sa.String(length=255), nullable=True),
            sa.Column('challan_no', sa.String(length=100), nullable=False),
            sa.Column('challan_date', sa.Date(), nullable=True),
            sa.Column('uploaded_by', sa.Integer(), nullable=False),
            sa.Column('file_path', sa.String(length=500), nullable=False),
            sa.Column('sha256', sa.String(length=64), nullable=False),
            sa.Column('ocr_raw_text', sa.Text(), nullable=True),
            sa.Column('ocr_confidence', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column('reviewed', sa.Boolean(), server_default=sa.text('0'), nullable=False),
            sa.Column('status', sa.String(length=20), server_default='processing', nullable=False),
            sa.Column('failure_reason', sa.Text(), nullable=True),
            sa.Column('version', sa.Integer(), server_default='1', nullable=False),
            sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('vendor_id', 'challan_no', name='uq_vendor_challan_no')
        )
        op.create_index(op.f('ix_challans_id'), 'challans', ['id'], unique=False)
        op.create_index(op.f('ix_challans_sha256'), 'challans', ['sha256'], unique=False)

    # 10. challan_items
    if 'challan_items' not in existing_tables:
        op.create_table(
            'challan_items',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('challan_id', sa.Integer(), nullable=False),
            sa.Column('material_id', sa.Integer(), nullable=True),
            sa.Column('stage_id', sa.Integer(), nullable=True),
            sa.Column('material_name_raw', sa.String(length=255), nullable=True),
            sa.Column('qty', sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column('unit', sa.String(length=50), nullable=False),
            sa.Column('qty_base', sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column('field_confidence', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.ForeignKeyConstraint(['challan_id'], ['challans.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['material_id'], ['materials.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['stage_id'], ['stages.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_challan_items_id'), 'challan_items', ['id'], unique=False)

    # 11. material_issues
    if 'material_issues' not in existing_tables:
        op.create_table(
            'material_issues',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('stage_id', sa.Integer(), nullable=False),
            sa.Column('material_id', sa.Integer(), nullable=False),
            sa.Column('qty', sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column('unit', sa.String(length=50), nullable=False),
            sa.Column('qty_base', sa.Numeric(precision=14, scale=4), nullable=False),
            sa.Column('issued_by', sa.Integer(), nullable=False),
            sa.Column('issued_to', sa.String(length=255), nullable=False),
            sa.Column('note', sa.Text(), nullable=True),
            sa.Column('anomaly_flag', sa.Boolean(), server_default=sa.text('0'), nullable=False),
            sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['issued_by'], ['users.id'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['material_id'], ['materials.id'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['stage_id'], ['stages.id'], ondelete='RESTRICT'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_material_issues_id'), 'material_issues', ['id'], unique=False)

    # 12. alerts
    if 'alerts' not in existing_tables:
        op.create_table(
            'alerts',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('project_id', sa.Integer(), nullable=False),
            sa.Column('stage_id', sa.Integer(), nullable=True),
            sa.Column('challan_id', sa.Integer(), nullable=True),
            sa.Column('issue_id', sa.Integer(), nullable=True),
            sa.Column('photo_id', sa.Integer(), nullable=True),
            sa.Column('type', sa.String(length=100), nullable=False),
            sa.Column('severity', sa.String(length=20), nullable=False),
            sa.Column('status', sa.String(length=20), server_default='open', nullable=False),
            sa.Column('explanation', sa.Text(), nullable=False),
            sa.Column('evidence', sa.Text(), nullable=True),
            sa.Column('auditor_comment', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['challan_id'], ['challans.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['issue_id'], ['material_issues.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['stage_id'], ['stages.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_alerts_id'), 'alerts', ['id'], unique=False)
        op.create_index(op.f('ix_alerts_project_id'), 'alerts', ['project_id'], unique=False)
        op.create_index(op.f('ix_alerts_stage_id'), 'alerts', ['stage_id'], unique=False)
        op.create_index(op.f('ix_alerts_challan_id'), 'alerts', ['challan_id'], unique=False)
        op.create_index(op.f('ix_alerts_issue_id'), 'alerts', ['issue_id'], unique=False)


def downgrade() -> None:
    op.drop_table('alerts')
    op.drop_table('material_issues')
    op.drop_table('challan_items')
    op.drop_table('challans')
    op.drop_table('boq_items')
    op.drop_table('vendors')
    op.drop_table('unit_conversions')
    op.drop_table('materials')
    op.drop_table('stages')
    op.drop_table('project_settings')
    op.drop_table('project_members')
    op.drop_table('projects')
