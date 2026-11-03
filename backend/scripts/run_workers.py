#!/usr/bin/env python
"""
Enterprise Multi-Tenant Background Worker CLI Runner.
Usage:
    python backend/scripts/run_workers.py --job sweeper
    python backend/scripts/run_workers.py --job reconcile --tenant zydus
    python backend/scripts/run_workers.py --job all
"""
import argparse
import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.workers import MultiTenantWorkerDaemon


async def main():
    parser = argparse.ArgumentParser(
        description="Master Core FSM - Enterprise Multi-Tenant Background Worker CLI"
    )
    parser.add_argument(
        "--job",
        "-j",
        type=str,
        required=True,
        choices=[
            "sweeper",
            "reconcile",
            "closing",
            "archive",
            "leakage_scan",
            "digest",
            "escalate",
            "all",
        ],
        help="Background job to execute across active tenants.",
    )
    parser.add_argument(
        "--tenant",
        "-t",
        type=str,
        default=None,
        help="Optional: restrict execution to a single tenant slug.",
    )

    args = parser.parse_args()

    print(f"=== Multi-Tenant Background Daemon: Job '{args.job}' ===")
    if args.tenant:
        print(f"Filter: Scoped strictly to tenant '{args.tenant}'")

    daemon = MultiTenantWorkerDaemon()

    if args.job == "sweeper":
        summaries = await daemon.run_outbox_sweeper(tenant_slug=args.tenant)
    elif args.job == "reconcile":
        summaries = await daemon.run_nightly_reconciliation(tenant_slug=args.tenant)
    elif args.job == "closing":
        summaries = await daemon.run_target_closing(tenant_slug=args.tenant)
    elif args.job == "archive":
        summaries = await daemon.run_data_archiving(tenant_slug=args.tenant)
    elif args.job == "leakage_scan":
        summaries = await daemon.run_revenue_leakage_scanner(tenant_slug=args.tenant)
    elif args.job == "digest":
        summaries = await daemon.run_daily_digest(tenant_slug=args.tenant)
    elif args.job == "escalate":
        summaries = await daemon.run_alert_escalation(tenant_slug=args.tenant)
    elif args.job == "all":
        summaries = await daemon.run_all_jobs(tenant_slug=args.tenant)
    else:
        print(f"Unknown job: {args.job}")
        sys.exit(1)

    print("\n--- Summary of Tenant Execution ---")
    succeeded = sum(1 for s in summaries if s.success)
    failed = sum(1 for s in summaries if not s.success)
    total_processed = sum(s.items_processed for s in summaries)

    for s in summaries:
        status_icon = "SUCCESS" if s.success else "FAILED"
        print(f"[{status_icon}] Tenant: {s.tenant_slug:<20} | Job: {s.job_name:<22} | Processed: {s.items_processed} | Error: {s.error}")

    print(f"\nTotal: {len(summaries)} executions ({succeeded} succeeded, {failed} failed), {total_processed} items processed.")


if __name__ == "__main__":
    asyncio.run(main())
