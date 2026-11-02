"""
Resilient TSPTW Route & Schedule Optimizer
==========================================
Calculates road distance/duration matrices, enforces the 510-minute workday budget,
inserts a protected 45-minute lunch break, and sequences stops using Nearest Neighbor
and window-constrained 2-Opt heuristics.
"""

import math
from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, List, Tuple, Dict, Any, Set
import httpx

from app.config import get_settings, Settings
from app.features.daily_sales_plan.services.exceptions import (
    InvalidCoordinateError,
    InvalidTimeWindowError,
    MandatoryConflictError,
    RouteOptimizationError,
)


class RouteOptimizer:
    """
    Solves the Traveling Salesperson Problem with Time Windows (TSPTW)
    for daily sales field schedules with resilient OSRM / Haversine fallback.
    """

    EARTH_RADIUS_METERS = 6371000.0

    def __init__(
        self,
        settings: Optional[Settings] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        cfg = settings or get_settings()
        # 510 minutes gross workday (8.5 hours). Includes 45 min lunch.
        self.shift_budget_minutes = float(cfg.plan_standard_shift_hours * 60.0)
        self.lunch_duration_minutes = float(cfg.plan_mandatory_lunch_minutes)
        self.lunch_window_start = time(13, 0)
        self.lunch_window_end = time(14, 15)
        self.osrm_timeout_seconds = float(cfg.plan_osrm_timeout_seconds)
        self.winding_factor = float(cfg.plan_haversine_winding_factor)
        self.avg_speed_kmh = float(cfg.plan_haversine_avg_speed_kmh)
        # 30 km/h in meters per second = 30 * 1000 / 3600 = 8.333 m/s
        self.avg_speed_mps = (self.avg_speed_kmh * 1000.0) / 3600.0
        self.http_client = http_client

    # -------------------------------------------------------------------------
    # Coordinate Validation & Haversine Distance
    # -------------------------------------------------------------------------
    @classmethod
    def validate_coordinates(cls, lat: Optional[float], lon: Optional[float]) -> Tuple[float, float]:
        """
        Validates latitude and longitude ranges.
        Raises InvalidCoordinateError on missing, out-of-bounds, or Null Island (0,0) coords.
        """
        if lat is None or lon is None:
            raise InvalidCoordinateError("Coordinates cannot be None.")
        if math.isnan(lat) or math.isnan(lon) or math.isinf(lat) or math.isinf(lon):
            raise InvalidCoordinateError("Coordinates contain NaN or Infinite values.")
        if not (-90.0 <= lat <= 90.0):
            raise InvalidCoordinateError(f"Latitude {lat} out of range [-90.0, 90.0].")
        if not (-180.0 <= lon <= 180.0):
            raise InvalidCoordinateError(f"Longitude {lon} out of range [-180.0, 180.0].")
        if abs(lat) < 1e-5 and abs(lon) < 1e-5:
            raise InvalidCoordinateError("Coordinates locate at Null Island (0, 0), indicating unconfigured GPS.")
        return float(lat), float(lon)

    @classmethod
    def calculate_haversine_distance(
        cls,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float,
        winding_factor: float = 1.2,
    ) -> float:
        """
        Computes great-circle road-estimated distance in meters using Haversine formula
        multiplied by empirical road winding factor.
        """
        if abs(lat1 - lat2) < 1e-7 and abs(lon1 - lon2) < 1e-7:
            return 0.0

        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        great_circle = cls.EARTH_RADIUS_METERS * c
        return round(great_circle * winding_factor, 2)

    def calculate_haversine_matrix(
        self,
        coords: List[Tuple[float, float]],
    ) -> Tuple[List[List[float]], List[List[float]]]:
        """
        Generates pairwise distance (meters) and duration (seconds) matrices
        for all coordinate pairs using internal Haversine math.
        """
        n = len(coords)
        dist_matrix = [[0.0] * n for _ in range(n)]
        dur_matrix = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                if i != j:
                    d_m = self.calculate_haversine_distance(
                        coords[i][0], coords[i][1],
                        coords[j][0], coords[j][1],
                        self.winding_factor
                    )
                    t_s = d_m / self.avg_speed_mps if self.avg_speed_mps > 0 else 0.0
                    dist_matrix[i][j] = d_m
                    dur_matrix[i][j] = round(t_s, 1)

        return dist_matrix, dur_matrix

    # -------------------------------------------------------------------------
    # Resilient Matrix Acquisition (OSRM with Automatic Haversine Fallback)
    # -------------------------------------------------------------------------
    async def compute_travel_matrix(
        self,
        coords: List[Tuple[float, float]],
        osrm_endpoint: str = "https://router.project-osrm.org",
    ) -> Tuple[List[List[float]], List[List[float]], str]:
        """
        Queries OSRM table matrix API with 4.0s timeout.
        Recovers gracefully to internal Haversine matrix on:
        - Network timeouts
        - HTTP 4xx/5xx status codes
        - Malformed JSON / missing keys
        - Disconnected nodes (null cells)
        """
        n = len(coords)
        if n <= 1:
            return [[0.0]], [[0.0]], "HAVERSINE_ESTIMATED"

        # Validate all coordinates first
        for lat, lon in coords:
            self.validate_coordinates(lat, lon)

        # Baseline fallback matrix ready in memory
        fallback_dist, fallback_dur = self.calculate_haversine_matrix(coords)

        # Format coordinates for OSRM: {lon},{lat};{lon},{lat}...
        coord_str = ";".join([f"{lon:.6f},{lat:.6f}" for lat, lon in coords])
        url = f"{osrm_endpoint.rstrip('/')}/table/v1/driving/{coord_str}?annotations=distance,duration"

        client = self.http_client or httpx.AsyncClient(timeout=self.osrm_timeout_seconds)
        close_client = self.http_client is None

        try:
            response = await client.get(url)
            if response.status_code != 200:
                return fallback_dist, fallback_dur, "HAVERSINE_ESTIMATED"

            data = response.json()
            if not isinstance(data, dict) or data.get("code") != "Ok":
                return fallback_dist, fallback_dur, "HAVERSINE_ESTIMATED"

            durations = data.get("durations")
            distances = data.get("distances")

            if not durations or not distances or len(durations) != n or len(distances) != n:
                return fallback_dist, fallback_dur, "HAVERSINE_ESTIMATED"

            # Check and repair disconnected nodes (null cells or negative values)
            clean_dur = [[0.0] * n for _ in range(n)]
            clean_dist = [[0.0] * n for _ in range(n)]

            for i in range(n):
                for j in range(n):
                    d_val = distances[i][j]
                    t_val = durations[i][j]
                    # If OSRM returned null or invalid, substitute with Haversine estimate
                    if d_val is None or math.isnan(d_val) or d_val < 0:
                        clean_dist[i][j] = fallback_dist[i][j]
                    else:
                        clean_dist[i][j] = float(d_val)

                    if t_val is None or math.isnan(t_val) or t_val < 0:
                        clean_dur[i][j] = fallback_dur[i][j]
                    else:
                        clean_dur[i][j] = float(t_val)

            return clean_dist, clean_dur, "OSRM_NETWORK"

        except (httpx.TimeoutException, httpx.RequestError, ValueError, KeyError):
            return fallback_dist, fallback_dur, "HAVERSINE_ESTIMATED"
        finally:
            if close_client:
                await client.aclose()

    # -------------------------------------------------------------------------
    # Workday Budget & Feasibility Validation
    # -------------------------------------------------------------------------
    def calculate_net_field_budget(self, non_visit_blocks: List[Dict[str, Any]]) -> float:
        """
        Calculates available transit & physical visit budget.
        Total Gross Shift = 510 minutes.
        Gross shift includes the 45-minute lunch break.

        Formula:
            Net Field Budget = 510 - 45 (Lunch) - sum(Duration of Remote/Desk Blocks)
        """
        t_remote = sum(float(b.get("estimated_duration_minutes", 0)) for b in non_visit_blocks)
        net_budget = self.shift_budget_minutes - self.lunch_duration_minutes - t_remote
        return max(0.0, net_budget)

    def validate_mandatory_feasibility(
        self,
        mandatory_stops: List[Dict[str, Any]],
        travel_duration_matrix: List[List[float]],
        stop_index_map: Dict[str, int],
        available_field_minutes: float,
    ) -> None:
        """
        Validates reachability between mandatory stops and ensures they do not exceed shift limits.
        Raises MandatoryConflictError if impossible.
        """
        if not mandatory_stops:
            return

        total_service_minutes = sum(
            float(s.get("estimated_duration_minutes", 20)) for s in mandatory_stops
        )

        # Minimum travel time linking mandatory stops sequentially
        total_travel_minutes = 0.0
        for i in range(len(mandatory_stops) - 1):
            idx_a = stop_index_map.get(str(mandatory_stops[i].get("id")))
            idx_b = stop_index_map.get(str(mandatory_stops[i + 1].get("id")))
            if idx_a is not None and idx_b is not None:
                t_sec = travel_duration_matrix[idx_a][idx_b]
                total_travel_minutes += (t_sec / 60.0)

        total_required_minutes = total_service_minutes + total_travel_minutes

        if total_required_minutes > available_field_minutes:
            conflicting_ids = [s.get("id") for s in mandatory_stops]
            raise MandatoryConflictError(
                f"Mandatory stops exceed available field shift budget: "
                f"Required {total_required_minutes:.1f}m > Available {available_field_minutes:.1f}m.",
                conflicting_stop_ids=conflicting_ids,
                required_minutes=round(total_required_minutes, 1),
                available_minutes=round(available_field_minutes, 1),
            )

        # Pairwise fixed appointment window reachability
        for i in range(len(mandatory_stops)):
            w_start_a = mandatory_stops[i].get("window_start")
            w_end_a = mandatory_stops[i].get("window_end")
            if w_start_a and w_end_a and w_start_a > w_end_a:
                raise InvalidTimeWindowError(
                    f"Stop {mandatory_stops[i].get('id')} has inverted time window: {w_start_a} > {w_end_a}."
                )

    # -------------------------------------------------------------------------
    # Comprehensive Timeline Validation (Used by Nearest Neighbor & 2-Opt)
    # -------------------------------------------------------------------------
    def validate_and_build_timeline(
        self,
        stops: List[Dict[str, Any]],
        start_coords: Tuple[float, float],
        start_clock: time,
        coords_list: List[Tuple[float, float]],
        dist_matrix: List[List[float]],
        dur_matrix: List[List[float]],
        coord_index_map: Dict[str, int],
    ) -> Tuple[bool, List[Dict[str, Any]], float, int]:
        """
        Validates the entire schedule after route ordering.
        Enforces:
        - Transit times from previous node
        - Visit durations
        - Fixed appointment windows (arrival <= window_end)
        - Protected 45-minute lunch break (13:00 to 14:15)
        - 510-minute gross shift boundary

        Returns: (is_valid, scheduled_stops, total_distance_m, total_duration_s)
        """
        current_dt = datetime.combine(date.today(), start_clock)
        shift_start_dt = current_dt
        shift_end_limit = shift_start_dt + timedelta(minutes=self.shift_budget_minutes)

        lunch_start_limit = datetime.combine(date.today(), self.lunch_window_start)
        lunch_end_limit = datetime.combine(date.today(), self.lunch_window_end)
        lunch_inserted = False

        total_distance_m = 0.0
        scheduled_items: List[Dict[str, Any]] = []

        curr_coord_idx = 0  # 0 is always the start origin coords

        for stop in stops:
            # Handle remote non-visit activities (Calls, Admin Desk)
            if stop.get("activity_type") in ("PHONE_CALL", "ADMIN_DESK"):
                dur_m = int(stop.get("estimated_duration_minutes", 10))
                arr_t = current_dt.time()
                current_dt += timedelta(minutes=dur_m)
                dep_t = current_dt.time()

                item_copy = dict(stop)
                item_copy["planned_arrival_time"] = arr_t
                item_copy["planned_departure_time"] = dep_t
                item_copy["transit_distance_m"] = 0.0
                item_copy["transit_duration_s"] = 0
                scheduled_items.append(item_copy)
                continue

            # Check lunch break insertion window (13:00 - 14:15)
            if not lunch_inserted and current_dt >= lunch_start_limit:
                lunch_item = {
                    "id": "LUNCH_BREAK_SYSTEM",
                    "activity_type": "LUNCH_BREAK",
                    "stop_type": "LUNCH_BREAK",
                    "planned_arrival_time": current_dt.time(),
                    "planned_departure_time": (current_dt + timedelta(minutes=self.lunch_duration_minutes)).time(),
                    "estimated_duration_minutes": int(self.lunch_duration_minutes),
                    "transit_distance_m": 0.0,
                    "transit_duration_s": 0,
                }
                scheduled_items.append(lunch_item)
                current_dt += timedelta(minutes=self.lunch_duration_minutes)
                lunch_inserted = True

            # Travel to next physical stop
            stop_id = str(stop.get("id"))
            next_idx = coord_index_map.get(stop_id)
            if next_idx is None:
                return False, [], 0.0, 0

            transit_s = dur_matrix[curr_coord_idx][next_idx]
            transit_m = dist_matrix[curr_coord_idx][next_idx]

            total_distance_m += transit_m
            current_dt += timedelta(seconds=transit_s)

            # Fixed appointment window evaluation
            w_start = stop.get("window_start")
            w_end = stop.get("window_end")

            if w_start:
                w_start_dt = datetime.combine(date.today(), w_start)
                if current_dt < w_start_dt:
                    # Early arrival: wait at location until window opens
                    current_dt = w_start_dt

            if w_end:
                w_end_dt = datetime.combine(date.today(), w_end)
                if current_dt > w_end_dt:
                    # Late arrival: Window violated! Discard this route.
                    return False, [], 0.0, 0

            arr_time = current_dt.time()
            meeting_m = int(stop.get("estimated_duration_minutes", 20))
            current_dt += timedelta(minutes=meeting_m)
            dep_time = current_dt.time()

            # Shift boundary check: Must not exceed 510 gross minutes
            if current_dt > shift_end_limit:
                return False, [], 0.0, 0

            item_copy = dict(stop)
            item_copy["planned_arrival_time"] = arr_time
            item_copy["planned_departure_time"] = dep_time
            item_copy["transit_distance_m"] = round(transit_m, 2)
            item_copy["transit_duration_s"] = int(transit_s)
            scheduled_items.append(item_copy)

            curr_coord_idx = next_idx

        # If shift finished before 13:00 but route is valid, lunch was not needed
        total_duration_s = int((current_dt - shift_start_dt).total_seconds())
        return True, scheduled_items, total_distance_m, total_duration_s

    # -------------------------------------------------------------------------
    # Route Sequencing: Nearest Neighbor + Constrained 2-Opt
    # -------------------------------------------------------------------------
    def optimize_route(
        self,
        start_coords: Tuple[float, float],
        start_time: time,
        candidate_stops: List[Dict[str, Any]],
        dist_matrix: List[List[float]],
        dur_matrix: List[List[float]],
        coord_index_map: Dict[str, int],
        coords_list: List[Tuple[float, float]],
        enable_two_opt: bool = True,
    ) -> Tuple[List[Dict[str, Any]], float, int]:
        """
        Executes Nearest Neighbor seeding followed by window-constrained 2-Opt.
        Ensures after EVERY swap that timeline constraints (windows, lunch, shift boundary) hold.
        """
        if not candidate_stops:
            return [], 0.0, 0

        # Partition non-visit remote blocks vs physical stops
        remote_blocks = [s for s in candidate_stops if s.get("activity_type") in ("PHONE_CALL", "ADMIN_DESK")]
        physical_stops = [s for s in candidate_stops if s.get("activity_type") not in ("PHONE_CALL", "ADMIN_DESK")]

        # Stage 1: Nearest Neighbor Seeding on Physical Stops
        unvisited = list(physical_stops)
        ordered_physical: List[Dict[str, Any]] = []
        curr_coord_idx = 0  # Start origin

        while unvisited:
            best_idx = -1
            best_time = float("inf")
            for i, cand in enumerate(unvisited):
                cand_idx = coord_index_map.get(str(cand.get("id")), 0)
                t_s = dur_matrix[curr_coord_idx][cand_idx]
                if t_s < best_time:
                    best_time = t_s
                    best_idx = i

            chosen = unvisited.pop(best_idx)
            ordered_physical.append(chosen)
            curr_coord_idx = coord_index_map.get(str(chosen.get("id")), 0)

        # Baseline combined route (Remote blocks first, then physical)
        best_stops = remote_blocks + ordered_physical
        valid, best_scheduled, best_dist, best_dur = self.validate_and_build_timeline(
            best_stops, start_coords, start_time, coords_list, dist_matrix, dur_matrix, coord_index_map
        )

        if not valid:
            # If initial order violated windows, attempt chronological sort on window_start
            ordered_physical.sort(key=lambda s: s.get("window_start") or time(23, 59))
            best_stops = remote_blocks + ordered_physical
            valid, best_scheduled, best_dist, best_dur = self.validate_and_build_timeline(
                best_stops, start_coords, start_time, coords_list, dist_matrix, dur_matrix, coord_index_map
            )
            if not valid:
                raise RouteOptimizationError("Unable to construct a feasible timeline satisfying all appointment windows.")

        # Stage 2: Constrained 2-Opt (Edge Exchanges)
        if enable_two_opt and len(ordered_physical) >= 4:
            improved = True
            iterations = 0
            max_iterations = 50

            while improved and iterations < max_iterations:
                improved = False
                iterations += 1

                for i in range(len(ordered_physical) - 1):
                    for j in range(i + 1, len(ordered_physical)):
                        # Proposed swap on physical stop slice
                        new_physical = (
                            ordered_physical[:i]
                            + ordered_physical[i : j + 1][::-1]
                            + ordered_physical[j + 1 :]
                        )
                        test_stops = remote_blocks + new_physical

                        # Validate complete timeline after swap
                        is_valid, test_scheduled, test_dist, test_dur = self.validate_and_build_timeline(
                            test_stops, start_coords, start_time, coords_list, dist_matrix, dur_matrix, coord_index_map
                        )

                        # Accept only if valid and travel distance decreased
                        if is_valid and test_dist < (best_dist - 10.0):
                            ordered_physical = new_physical
                            best_stops = test_stops
                            best_scheduled = test_scheduled
                            best_dist = test_dist
                            best_dur = test_dur
                            improved = True
                            break
                    if improved:
                        break

        return best_scheduled, best_dist, best_dur
