from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class FSMException(Exception):
    """
    Standard domain exception conforming to FSM error format:
    { "error": { "code": string, "message": string, "details": object or null } }
    """
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def unauthenticated(message: str = "Missing or invalid authorization token") -> FSMException:
    return FSMException(status.HTTP_401_UNAUTHORIZED, "unauthenticated", message)


def outside_scope(message: str = "Access forbidden: Outside your organizational reporting hierarchy") -> FSMException:
    return FSMException(status.HTTP_403_FORBIDDEN, "outside_scope", message)


def not_found(message: str = "Resource not found") -> FSMException:
    return FSMException(status.HTTP_404_NOT_FOUND, "not_found", message)


def overlapping_target(message: str = "An active target for this representative and metric already exists within overlapping dates") -> FSMException:
    return FSMException(status.HTTP_409_CONFLICT, "overlapping_target", message)


def version_conflict(current_version: int, message: str = "Target was modified by another user") -> FSMException:
    return FSMException(status.HTTP_409_CONFLICT, "version_conflict", message, details={"current_version": current_version})


def validation_error(message: str, details: Optional[Dict[str, Any]] = None) -> FSMException:
    return FSMException(status.HTTP_422_UNPROCESSABLE_ENTITY, "validation_error", message, details)


def not_supported(message: str = "Customer and product targets are currently disabled") -> FSMException:
    return FSMException(status.HTTP_422_UNPROCESSABLE_ENTITY, "not_supported", message)


def target_archived(message: str = "Target is archived and cannot be modified") -> FSMException:
    return FSMException(status.HTTP_409_CONFLICT, "target_archived", message)


def forbidden_role(message: str = "Role not permitted to perform this action") -> FSMException:
    return FSMException(status.HTTP_403_FORBIDDEN, "forbidden_role", message)


def alert_closed(message: str = "The alert is already resolved or dismissed") -> FSMException:
    return FSMException(status.HTTP_409_CONFLICT, "alert_closed", message)


def register_error_handlers(app: FastAPI) -> None:
    """Register uniform FSM error format handlers on FastAPI application."""

    @app.exception_handler(FSMException)
    async def fsm_exception_handler(request: Request, exc: FSMException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Request validation failed",
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        code_map = {
            401: "unauthenticated",
            403: "outside_scope",
            404: "not_found",
            409: "conflict",
            422: "validation_error",
        }
        code = code_map.get(exc.status_code, "http_error")
        message = exc.detail if isinstance(exc.detail, str) else "HTTP request error"
        details = exc.detail if isinstance(exc.detail, dict) else None
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": code,
                    "message": message,
                    "details": details,
                }
            },
        )
