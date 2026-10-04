"""Validation pipeline records and project rules.

Revision ID: d022_validation_pipeline
Revises: d021_stage1_discovery
"""
from alembic import op
import sqlalchemy as sa

revision = "d022_validation_pipeline"
down_revision = "d021_stage1_discovery"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("validation_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("candidate_sets.id"), nullable=False),
        sa.Column("stage", sa.String(40), nullable=False),
        sa.Column("label", sa.String(80), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("baseline", sa.JSON(), nullable=False),
        sa.Column("baseline_source", sa.String(30), nullable=False),
        sa.Column("comparison", sa.JSON(), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("status_overridden", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_validation_records_candidate_id", "validation_records", ["candidate_id"])
    op.create_index("ix_validation_candidate_stage", "validation_records", ["candidate_id", "stage"])
    op.create_table("validation_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rules", sa.JSON(), nullable=False))


def downgrade():
    op.drop_table("validation_rules")
    op.drop_index("ix_validation_candidate_stage", "validation_records")
    op.drop_index("ix_validation_records_candidate_id", "validation_records")
    op.drop_table("validation_records")
