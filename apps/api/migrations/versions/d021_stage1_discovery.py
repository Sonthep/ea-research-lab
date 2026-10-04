"""Record candidate discovery selection evidence.

Revision ID: d021_stage1_discovery
Revises: 5563350a2570
"""
from alembic import op
import sqlalchemy as sa

revision = "d021_stage1_discovery"
down_revision = "5563350a2570"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("discovery_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("optimization_runs.id"), nullable=False),
        sa.Column("policy", sa.JSON(), nullable=False),
        sa.Column("ranking", sa.JSON(), nullable=False),
        sa.Column("run_settings", sa.JSON(), nullable=False),
        sa.Column("selected_results", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_discovery_batches_run_id", "discovery_batches", ["run_id"])
    with op.batch_alter_table("candidate_sets") as batch:
        batch.add_column(sa.Column("discovery_batch_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_candidate_discovery_batch", "discovery_batches", ["discovery_batch_id"], ["id"])
        batch.create_index("ix_candidate_sets_discovery_batch_id", ["discovery_batch_id"])


def downgrade():
    with op.batch_alter_table("candidate_sets") as batch:
        batch.drop_index("ix_candidate_sets_discovery_batch_id")
        batch.drop_constraint("fk_candidate_discovery_batch", type_="foreignkey")
        batch.drop_column("discovery_batch_id")
    op.drop_table("discovery_batches")
