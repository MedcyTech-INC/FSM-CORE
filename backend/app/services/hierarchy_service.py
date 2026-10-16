import uuid
from typing import List, Set, Dict, Any, Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.employee import Employee, EmployeeRole
from app.schemas.employee import EmployeeOrgNode

settings = get_settings()


class HierarchyService:
    """
    Organizational Hierarchy & RBAC Scoping Service.
    Executes recursive Common Table Expressions (CTE) over the reporting tree
    to enforce downward boundary isolation and prevent horizontal data leakage.
    """

    @classmethod
    async def get_subordinate_ids(
        cls,
        db: AsyncSession,
        manager_id: uuid.UUID,
        include_self: bool = True
    ) -> Set[uuid.UUID]:
        """
        Calculates all downward subordinate employee IDs under a given manager
        using a single recursive SQL query.
        """
        table_name = settings.tables.employees

        # Raw recursive CTE ensuring zero ORM query multiplication
        query = text(f"""
            WITH RECURSIVE subordinate_tree AS (
                SELECT id, reporting_to_id, role, 1 AS depth
                FROM {table_name}
                WHERE id = :manager_id AND is_active = TRUE

                UNION ALL

                SELECT e.id, e.reporting_to_id, e.role, st.depth + 1
                FROM {table_name} e
                INNER JOIN subordinate_tree st ON e.reporting_to_id = st.id
                WHERE e.is_active = TRUE
            )
            SELECT id FROM subordinate_tree;
        """)

        result = await db.execute(query, {"manager_id": str(manager_id)})
        subordinate_ids = {row[0] if isinstance(row[0], uuid.UUID) else uuid.UUID(str(row[0])) for row in result.fetchall()}

        if not include_self and manager_id in subordinate_ids:
            subordinate_ids.remove(manager_id)

        return subordinate_ids

    @classmethod
    async def can_access_employee(
        cls,
        db: AsyncSession,
        actor: Employee,
        target_employee_id: uuid.UUID
    ) -> bool:
        """
        Validates whether the actor has downward hierarchy permission to access
        or mutate the target employee's resources.
        """
        # Admins have global access
        if actor.role == EmployeeRole.ADMIN.value:
            return True

        # Users can always access their own records
        if actor.id == target_employee_id:
            return True

        # Check if target is in the actor's downward reporting chain
        allowed_ids = await cls.get_subordinate_ids(db, actor.id, include_self=False)
        return target_employee_id in allowed_ids

    @classmethod
    async def get_org_chart(
        cls,
        db: AsyncSession,
        root_manager_id: Optional[uuid.UUID] = None
    ) -> List[EmployeeOrgNode]:
        """
        Fetches reporting hierarchy and builds a nested organizational tree structure.
        """
        table_name = settings.tables.employees

        if root_manager_id:
            query = text(f"""
                WITH RECURSIVE subordinate_tree AS (
                    SELECT id, first_name, last_name, role, territory, reporting_to_id, 1 AS depth
                    FROM {table_name}
                    WHERE id = :manager_id AND is_active = TRUE

                    UNION ALL

                    SELECT e.id, e.first_name, e.last_name, e.role, e.territory, e.reporting_to_id, st.depth + 1
                    FROM {table_name} e
                    INNER JOIN subordinate_tree st ON e.reporting_to_id = st.id
                    WHERE e.is_active = TRUE
                )
                SELECT id, first_name, last_name, role, territory, reporting_to_id, depth
                FROM subordinate_tree
                ORDER BY depth ASC;
            """)
            result = await db.execute(query, {"manager_id": str(root_manager_id)})
        else:
            query = text(f"""
                SELECT id, first_name, last_name, role, territory, reporting_to_id, 1 as depth
                FROM {table_name}
                WHERE is_active = TRUE
                ORDER BY role DESC;
            """)
            result = await db.execute(query)

        rows = result.fetchall()
        node_map: Dict[uuid.UUID, EmployeeOrgNode] = {}
        root_nodes: List[EmployeeOrgNode] = []

        for row in rows:
            emp_id = row[0] if isinstance(row[0], uuid.UUID) else uuid.UUID(str(row[0]))
            rep_id = (row[5] if isinstance(row[5], uuid.UUID) else uuid.UUID(str(row[5]))) if row[5] else None
            node = EmployeeOrgNode(
                id=emp_id,
                full_name=f"{row[1]} {row[2]}".strip(),
                role=str(row[3]),
                territory=str(row[4]) if row[4] else None,
                reporting_to_id=rep_id,
                depth=int(row[6]),
                subordinates=[]
            )
            node_map[emp_id] = node

        for node in node_map.values():
            if node.reporting_to_id and node.reporting_to_id in node_map and node.id != node.reporting_to_id:
                node_map[node.reporting_to_id].subordinates.append(node)
            else:
                root_nodes.append(node)

        return root_nodes
