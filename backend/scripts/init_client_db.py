"""
Client Onboarding & Database Provisioning Script
=================================================
Automates client database initialization:
1. Connects to the client's dedicated Supabase / PostgreSQL instance.
2. Ensures required extensions (uuid-ossp, postgis) are enabled.
3. Dynamically creates all domain tables using the client's configured table names.
4. Seeds default office locations, leave quotas, and the initial Admin account.
5. Verifies schema integrity and produces an onboarding report.

Usage:
    python scripts/init_client_db.py --admin-email admin@client.com --admin-password ChangeMe123!
"""

import argparse
import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import get_settings
from app.database.base import Base
# Import all models so that Base.metadata contains all entity tables
import app.models  # noqa: F401
from app.models.employee import Employee, EmployeeRole
from app.models.office_location import OfficeLocation
from app.models.leave_balance import LeaveBalance
from app.models.system_config import SystemConfig
from app.services.auth_service import AuthService


async def provision_client_database(admin_email: str, admin_password: str, db_url: str = None):
    settings = get_settings()
    target_url = db_url or settings.database_url

    print("=================================================================")
    print(" FSM Master Core - Client Database Provisioning Engine")
    print("=================================================================")
    print(f"Target Database: {target_url.split('@')[-1] if '@' in target_url else target_url}")
    print(f"Configured Table Mappings:")
    for k, v in settings.tables.model_dump().items():
        print(f"  - {k.ljust(18)}: {v}")
    print("-----------------------------------------------------------------")

    engine = create_async_engine(target_url, echo=False)

    try:
        # Step 1: Create Extensions
        print("\n[1/4] Verifying and enabling PostgreSQL extensions...")
        async with engine.begin() as conn:
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
            print("  ✔ Extension uuid-ossp enabled")
            try:
                await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "postgis";'))
                print("  ✔ Extension postgis enabled")
            except Exception as e:
                print(f"  ⚠ PostGIS warning (Haversine math fallback will be used): {e}")

        # Step 2: Create Tables dynamically using client table names
        print("\n[2/4] Generating domain schema with dynamic table names...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            print("  ✔ All domain tables generated successfully")

        # Step 3: Seed Initial SuperAdmin & Defaults
        print("\n[3/4] Seeding initial Admin account and workspace defaults...")
        from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
        session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as session:
            from sqlalchemy import select
            stmt = select(Employee).where(Employee.email == admin_email)
            existing_admin = (await session.execute(stmt)).scalar_one_or_none()

            admin_id = None
            if not existing_admin:
                admin_employee = Employee(
                    email=admin_email,
                    password_hash=AuthService.hash_password(admin_password),
                    first_name="System",
                    last_name="Administrator",
                    role=EmployeeRole.ADMIN.value,
                    rank="Executive",
                    territory="Headquarters",
                    is_active=True,
                    metadata_json={"onboarded_by": "init_client_db_script"}
                )
                session.add(admin_employee)
                await session.flush()
                admin_id = admin_employee.id
                print(f"  ✔ SuperAdmin created: {admin_email}")

                # Seed Default Headquarters Office Location
                hq = OfficeLocation(
                    name="Corporate Headquarters",
                    address="Central Operations Hub",
                    latitude=12.9716,
                    longitude=77.5946,
                    radius_meters=200,
                    is_active=True
                )
                session.add(hq)
                print("  ✔ Seeded default office location")

                # Seed initial leave balances for Admin
                current_year = 2026
                for l_type, days in [("CASUAL", 12.0), ("SICK", 12.0), ("EARNED", 15.0)]:
                    lb = LeaveBalance(
                        employee_id=admin_employee.id,
                        leave_type=l_type,
                        year=current_year,
                        allocated_days=days,
                        used_days=0.0,
                        remaining_days=days
                    )
                    session.add(lb)
                print("  ✔ Seeded standard leave quotas")

                # Seed initial system configuration (feature flags)
                stmt_cfg = select(SystemConfig).where(SystemConfig.id == 1)
                existing_cfg = (await session.execute(stmt_cfg)).scalar_one_or_none()
                if not existing_cfg:
                    initial_features = {
                        "attendance": settings.features.attendance,
                        "field_visits": settings.features.field_visits,
                        "leaves": settings.features.leaves,
                        "tasks": settings.features.tasks,
                        "expenses": settings.features.expenses,
                        "analytics": settings.features.analytics,
                    }
                    cfg = SystemConfig(id=1, features=initial_features)
                    session.add(cfg)
                    print("  ✔ Seeded persistent system feature flags")

                await session.commit()
            else:
                print(f"  ℹ Admin account already exists: {admin_email}")

                # Ensure system_config is present even if admin already exists
                stmt_cfg = select(SystemConfig).where(SystemConfig.id == 1)
                existing_cfg = (await session.execute(stmt_cfg)).scalar_one_or_none()
                if not existing_cfg:
                    initial_features = {
                        "attendance": settings.features.attendance,
                        "field_visits": settings.features.field_visits,
                        "leaves": settings.features.leaves,
                        "tasks": settings.features.tasks,
                        "expenses": settings.features.expenses,
                        "analytics": settings.features.analytics,
                    }
                    cfg = SystemConfig(id=1, features=initial_features)
                    session.add(cfg)
                    await session.commit()
                    print("  ✔ Seeded missing system feature flags")

        # Step 4: Verification Check
        print("\n[4/4] Validating database integrity...")
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT count(*) FROM " + settings.tables.employees))
            count = res.scalar()
            print(f"  ✔ Table verification complete. Active employees in {settings.tables.employees}: {count}")

        print("\n=================================================================")
        print(" SUCCESS: Client database provisioning completed successfully!")
        print("=================================================================\n")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FSM Client Database Provisioning Script")
    parser.add_argument("--admin-email", default="admin@client.com", help="Initial SuperAdmin email")
    parser.add_argument("--admin-password", default="Admin@123456", help="Initial SuperAdmin password")
    parser.add_argument("--db-url", default=None, help="Target Supabase/PostgreSQL connection string")

    args = parser.parse_args()
    asyncio.run(provision_client_database(args.admin_email, args.admin_password, args.db_url))
