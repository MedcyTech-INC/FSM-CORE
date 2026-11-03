import uuid
import pytest
from app.models.tenant import Tenant, TenantFeature, TenantBranding
from app.models.branch import Branch
from app.models.customer import Customer
from app.models.employee import Employee, EmployeeRole


def test_tenant_model_schema_and_defaults():
    tenant_id = uuid.uuid4()
    t = Tenant(
        id=tenant_id,
        slug="zydus-health",
        legal_name="Zydus Healthcare Private Limited",
        trade_name="Zydus",
        subscription_tier="enterprise",
        is_active=True,
    )

    assert t.__table_args__["schema"] == "fsm_system"
    assert t.__tablename__ == "tenants"
    assert t.slug == "zydus-health"
    assert t.subscription_tier == "enterprise"
    assert t.is_active is True


def test_tenant_features_and_branding_models():
    tenant_id = uuid.uuid4()
    tf = TenantFeature(
        tenant_id=tenant_id,
        feature_key="attendance",
        is_enabled=True,
    )
    assert tf.__table_args__[1]["schema"] == "fsm_system"
    assert tf.__tablename__ == "tenant_features"
    assert tf.feature_key == "attendance"

    tb = TenantBranding(
        tenant_id=tenant_id,
        brand_name="Zydus Health Core",
        primary_color="#1e3a8a",
        terminology_mapping={"target": "Doctor", "visit": "DCR Call"},
    )
    assert tb.__table_args__["schema"] == "fsm_system"
    assert tb.terminology_mapping["target"] == "Doctor"


def test_branch_model_schema_and_hierarchy():
    tenant_id = uuid.uuid4()
    branch_id = uuid.uuid4()
    b = Branch(
        id=branch_id,
        tenant_id=tenant_id,
        name="Mumbai West Regional Branch",
        branch_code="BR-MUM-01",
        city="Mumbai",
        is_head_office=True,
        is_active=True,
    )

    assert b.__table_args__[2]["schema"] == "fsm_app"
    assert b.__tablename__ == "branches"
    assert b.branch_code == "BR-MUM-01"
    assert b.is_head_office is True


def test_canonical_customer_model():
    tenant_id = uuid.uuid4()
    branch_id = uuid.uuid4()
    cust_id = uuid.uuid4()

    c = Customer(
        id=cust_id,
        tenant_id=tenant_id,
        branch_id=branch_id,
        name="Apex Cardiology Center",
        customer_type="Clinic",
        phone="+919876543210",
        contact_person="Dr. Kapoor",
        location_city="Mumbai",
        latitude=18.922,
        longitude=72.834,
        is_active=True,
    )

    assert c.__table_args__[3]["schema"] == "fsm_app"
    assert c.__tablename__ == "customers"
    assert c.name == "Apex Cardiology Center"
    assert c.customer_type == "Clinic"
    assert c.contact_person == "Dr. Kapoor"


def test_employee_multitenant_attributes():
    tenant_id = uuid.uuid4()
    branch_id = uuid.uuid4()
    emp_id = uuid.uuid4()

    emp = Employee(
        id=emp_id,
        tenant_id=tenant_id,
        branch_id=branch_id,
        is_tenant_root_admin=True,
        email="admin@zydus.com",
        password_hash="secret123",
        first_name="Ramesh",
        last_name="Patel",
        role=EmployeeRole.ADMIN.value,
        is_active=True,
    )

    assert emp.tenant_id == tenant_id
    assert emp.branch_id == branch_id
    assert emp.is_tenant_root_admin is True
    assert emp.full_name == "Ramesh Patel"
