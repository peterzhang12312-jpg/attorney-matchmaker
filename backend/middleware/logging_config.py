"""
Structured logging configuration using structlog.

Call `setup_logging()` once at application startup (in main.py lifespan).
All modules should use `structlog.get_logger()` instead of `logging.getLogger()`.

Set LOG_FORMAT=json in .env for JSON output (production).
Defaults to human-readable console output (development).
"""

from __future__ import annotations

import logging
import os
import sys

import structlog


def setup_logging() -> None:
    """Configure structlog processors and stdlib integration."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = os.getenv("LOG_FORMAT", "console").lower()

    # Configure stdlib logging as the backend for structlog
    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        stream=sys.stdout,
    )

    renderer: structlog.types.Processor
    if log_format == "json":
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
