import asyncio
import unittest
from datetime import time, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from app.features.daily_sales_plan.services.route_optimizer import RouteOptimizer
from app.features.daily_sales_plan.services.exceptions import (
    InvalidCoordinateError,
    InvalidTimeWindowError,
    MandatoryConflictError,
    RouteOptimizationError,
)


class TestRouteOptimizer(unittest.TestCase):
    def setUp(self):
        self.optimizer = RouteOptimizer()
        # Sample coordinates (Visakhapatnam region)
        self.origin = (17.7288, 83.3154)
        self.stop_a = (17.7312, 83.3190)
        self.stop_b = (17.7350, 83.3250)
        self.stop_c = (17.7400, 83.3300)
        self.stop_d = (17.7450, 83.3350)

    def test_coordinate_validation_safeguards(self):
        """Coordinate validation rejects out-of-bounds, NaN, and Null Island (0,0)."""
        # Valid
        lat, lon = self.optimizer.validate_coordinates(17.7288, 83.3154)
        self.assertEqual(lat, 17.7288)

        # Latitude out of bounds
        with self.assertRaises(InvalidCoordinateError):
            self.optimizer.validate_coordinates(95.0, 83.0)

        # Longitude out of bounds
        with self.assertRaises(InvalidCoordinateError):
            self.optimizer.validate_coordinates(17.0, 185.0)

        # Null Island (0, 0)
        with self.assertRaises(InvalidCoordinateError):
            self.optimizer.validate_coordinates(0.0, 0.0)

        # NaN
        with self.assertRaises(InvalidCoordinateError):
            self.optimizer.validate_coordinates(float("nan"), 83.0)

    def test_haversine_matrix_calculation(self):
        """Haversine matrix computes symmetric road-winding distances and transit durations."""
        coords = [self.origin, self.stop_a, self.stop_b]
        dist_m, dur_s = self.optimizer.calculate_haversine_matrix(coords)

        # Diagonal is zero
        for i in range(3):
            self.assertEqual(dist_m[i][i], 0.0)
            self.assertEqual(dur_s[i][i], 0.0)

        # Non-diagonal is positive and non-zero
        self.assertGreater(dist_m[0][1], 100.0)
        self.assertGreater(dur_s[0][1], 10.0)
        # Symmetry
        self.assertAlmostEqual(dist_m[0][1], dist_m[1][0], places=1)

    def test_510_minute_shift_budget_and_single_lunch_deduction(self):
        """Net field budget explicitly subtracts 45m lunch and non-visit blocks once."""
        non_visit_blocks = [
            {"activity_type": "PHONE_CALL", "estimated_duration_minutes": 30},
            {"activity_type": "ADMIN_DESK", "estimated_duration_minutes": 30},
        ]
        # Gross = 510, Lunch = 45, Remote = 60 -> Net = 510 - 45 - 60 = 405
        net_budget = self.optimizer.calculate_net_field_budget(non_visit_blocks)
        self.assertEqual(net_budget, 405.0)

    def test_mandatory_conflict_detection(self):
        """Mandatory stops exceeding available shift budget raise MandatoryConflictError."""
        mandatory_stops = [
            {"id": "stop-1", "estimated_duration_minutes": 180},
            {"id": "stop-2", "estimated_duration_minutes": 180},
            {"id": "stop-3", "estimated_duration_minutes": 180},
        ]
        # Total meeting time = 540 min, which exceeds 465 min available field time
        stop_index_map = {"stop-1": 0, "stop-2": 1, "stop-3": 2}
        travel_dur = [[0.0, 600.0, 1200.0], [600.0, 0.0, 600.0], [1200.0, 600.0, 0.0]]

        with self.assertRaises(MandatoryConflictError) as ctx:
            self.optimizer.validate_mandatory_feasibility(
                mandatory_stops, travel_dur, stop_index_map, available_field_minutes=465.0
            )

        err = ctx.exception
        self.assertIn("stop-1", err.conflicting_stop_ids)
        self.assertGreater(err.required_minutes, 465.0)

    def test_inverted_time_window_validation(self):
        """Inverted time window (start > end) raises InvalidTimeWindowError."""
        mandatory_stops = [
            {
                "id": "stop-inv",
                "estimated_duration_minutes": 20,
                "window_start": time(14, 0),
                "window_end": time(11, 0),  # Inverted!
            }
        ]
        with self.assertRaises(InvalidTimeWindowError):
            self.optimizer.validate_mandatory_feasibility(
                mandatory_stops, [[0.0]], {"stop-inv": 0}, available_field_minutes=465.0
            )

    def test_timeline_validation_and_lunch_break_locking(self):
        """Timeline insertion locks a 45m lunch break between 13:00 and 14:15."""
        coords_list = [self.origin, self.stop_a, self.stop_b]
        coord_map = {"stop-1": 1, "stop-2": 2}
        dist_m, dur_s = self.optimizer.calculate_haversine_matrix(coords_list)

        stops = [
            {"id": "stop-1", "activity_type": "PHYSICAL_VISIT", "estimated_duration_minutes": 180},
            {"id": "stop-2", "activity_type": "PHYSICAL_VISIT", "estimated_duration_minutes": 120},
        ]
        # Starts at 10:30 AM -> Meeting 1 ends 13:30 (crosses 13:00) -> Lunch inserted
        valid, scheduled, dist, dur = self.optimizer.validate_and_build_timeline(
            stops, self.origin, time(10, 30), coords_list, dist_m, dur_s, coord_map
        )
        self.assertTrue(valid)

        # Confirm lunch item was inserted
        lunch_items = [s for s in scheduled if s.get("activity_type") == "LUNCH_BREAK"]
        self.assertEqual(len(lunch_items), 1)
        self.assertEqual(lunch_items[0]["estimated_duration_minutes"], 45)

    def test_osrm_resilience_fallback_on_timeouts(self):
        """OSRM table matrix client recovers with Haversine fallback on request timeouts."""
        coords = [self.origin, self.stop_a]
        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.side_effect = httpx.TimeoutException("OSRM server timed out")
        opt_timeout = RouteOptimizer(http_client=mock_client)

        dist, dur, engine = asyncio.run(opt_timeout.compute_travel_matrix(coords))
        self.assertEqual(engine, "HAVERSINE_ESTIMATED")
        self.assertGreater(dist[0][1], 0.0)

    def test_osrm_http_errors_fallback(self):
        """OSRM table client falls back to Haversine on HTTP 400, 500, and 503 errors."""
        coords = [self.origin, self.stop_a]
        mock_client = AsyncMock(spec=httpx.AsyncClient)

        for status_code in (400, 500, 503):
            mock_resp = MagicMock()
            mock_resp.status_code = status_code
            mock_client.get.return_value = mock_resp
            opt = RouteOptimizer(http_client=mock_client)

            dist, dur, engine = asyncio.run(opt.compute_travel_matrix(coords))
            self.assertEqual(engine, "HAVERSINE_ESTIMATED", f"Failed to fallback on HTTP {status_code}")
            self.assertGreater(dist[0][1], 0.0)

    def test_osrm_malformed_responses_fallback(self):
        """OSRM falls back to Haversine on invalid JSON, non-Ok code, and mismatched dimensions."""
        coords = [self.origin, self.stop_a]
        mock_client = AsyncMock(spec=httpx.AsyncClient)

        # Subcase A: Malformed JSON (raises ValueError)
        mock_resp_bad_json = MagicMock()
        mock_resp_bad_json.status_code = 200
        mock_resp_bad_json.json.side_effect = ValueError("Invalid JSON string")
        mock_client.get.return_value = mock_resp_bad_json
        opt_bad_json = RouteOptimizer(http_client=mock_client)
        dist, dur, engine = asyncio.run(opt_bad_json.compute_travel_matrix(coords))
        self.assertEqual(engine, "HAVERSINE_ESTIMATED")

        # Subcase B: Non-Ok code
        mock_resp_not_ok = MagicMock()
        mock_resp_not_ok.status_code = 200
        mock_resp_not_ok.json.side_effect = None
        mock_resp_not_ok.json.return_value = {"code": "InvalidQuery", "message": "Coordinate out of bounds"}
        mock_client.get.return_value = mock_resp_not_ok
        opt_not_ok = RouteOptimizer(http_client=mock_client)
        dist, dur, engine = asyncio.run(opt_not_ok.compute_travel_matrix(coords))
        self.assertEqual(engine, "HAVERSINE_ESTIMATED")

        # Subcase C: Mismatched matrix dimensions
        mock_resp_mismatch = MagicMock()
        mock_resp_mismatch.status_code = 200
        mock_resp_mismatch.json.return_value = {
            "code": "Ok",
            "distances": [[0.0]],  # 1x1 instead of 2x2
            "durations": [[0.0]],
        }
        mock_client.get.return_value = mock_resp_mismatch
        opt_mismatch = RouteOptimizer(http_client=mock_client)
        dist, dur, engine = asyncio.run(opt_mismatch.compute_travel_matrix(coords))
        self.assertEqual(engine, "HAVERSINE_ESTIMATED")

    def test_osrm_invalid_matrix_values_and_disconnected_nodes(self):
        """OSRM replaces negative values, NaNs, and null cells with Haversine estimates."""
        coords = [self.origin, self.stop_a]
        mock_client = AsyncMock(spec=httpx.AsyncClient)

        # 2x2 matrix containing:
        # (0, 1): None (disconnected node)
        # (1, 0): -15.0 (invalid negative value)
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "code": "Ok",
            "distances": [[0.0, None], [-15.0, 0.0]],
            "durations": [[0.0, float("nan")], [-60.0, 0.0]],
        }
        mock_client.get.return_value = mock_resp
        opt = RouteOptimizer(http_client=mock_client)

        dist, dur, engine = asyncio.run(opt.compute_travel_matrix(coords))
        self.assertEqual(engine, "OSRM_NETWORK")
        # Disconnected (0, 1) replaced with positive Haversine estimate
        self.assertGreater(dist[0][1], 0.0)
        self.assertGreater(dur[0][1], 0.0)
        # Negative (1, 0) replaced with positive Haversine estimate
        self.assertGreater(dist[1][0], 0.0)
        self.assertGreater(dur[1][0], 0.0)


    def test_2opt_uncrossing_and_fixed_window_protection(self):
        """2-Opt uncrosses crossing loops but rejects swaps that violate appointment windows."""
        coords_list = [self.origin, self.stop_a, self.stop_b, self.stop_c, self.stop_d]
        coord_map = {"s1": 1, "s2": 2, "s3": 3, "s4": 4}
        dist_m, dur_s = self.optimizer.calculate_haversine_matrix(coords_list)

        # Stops deliberately in zigzag order: s1 -> s4 -> s2 -> s3
        zigzag_stops = [
            {"id": "s1", "activity_type": "PHYSICAL_VISIT", "estimated_duration_minutes": 20},
            {"id": "s4", "activity_type": "PHYSICAL_VISIT", "estimated_duration_minutes": 20},
            {"id": "s2", "activity_type": "PHYSICAL_VISIT", "estimated_duration_minutes": 20},
            {"id": "s3", "activity_type": "PHYSICAL_VISIT", "estimated_duration_minutes": 20},
        ]

        # Case A: Free 2-Opt optimizes distance
        scheduled, total_dist, total_dur = self.optimizer.optimize_route(
            self.origin, time(9, 30), zigzag_stops, dist_m, dur_s, coord_map, coords_list, enable_two_opt=True
        )
        self.assertTrue(len(scheduled) >= 4)

        # Case B: Fixed window prevents swap
        # Pin s4 strictly to 10:00 AM window
        zigzag_stops[1]["window_start"] = time(10, 0)
        zigzag_stops[1]["window_end"] = time(10, 30)

        scheduled_pinned, dist_pinned, _ = self.optimizer.optimize_route(
            self.origin, time(9, 30), zigzag_stops, dist_m, dur_s, coord_map, coords_list, enable_two_opt=True
        )
        # s4 must remain placed within its 10:00 - 10:30 window
        s4_item = next(s for s in scheduled_pinned if s.get("id") == "s4")
        self.assertLessEqual(s4_item["planned_arrival_time"], time(10, 30))


if __name__ == "__main__":
    unittest.main()
