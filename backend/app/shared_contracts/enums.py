import enum


class MetricType(str, enum.Enum):
    REVENUE = "revenue"
    DOCTOR_VISITS = "doctor_visits"
    NEW_LEADS = "new_leads"
    CONVERSIONS = "conversions"
    COLLECTIONS = "collections"


class EntityType(str, enum.Enum):
    REPRESENTATIVE = "representative"
    TEAM = "team"
    TERRITORY = "territory"
    BRANCH = "branch"
    CUSTOMER = "customer"
    PRODUCT = "product"


class TargetStatus(str, enum.Enum):
    ACTIVE = "active"
    BACKFILLING = "backfilling"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class EntryType(str, enum.Enum):
    CONTRIBUTION = "contribution"
    REVERSAL = "reversal"


class TargetState(str, enum.Enum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    ACHIEVED = "achieved"
    ENDED_SHORT = "ended_short"
