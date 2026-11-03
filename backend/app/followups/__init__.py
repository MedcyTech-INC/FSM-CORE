from app.followups.models import Followup, FollowupHistory, FollowupStatus, FollowupActionType, FollowupPriority
from app.followups.service import FollowupService

__all__ = [
    "Followup",
    "FollowupHistory",
    "FollowupStatus",
    "FollowupActionType",
    "FollowupPriority",
    "FollowupService",
]
