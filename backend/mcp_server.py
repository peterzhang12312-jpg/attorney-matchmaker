"""
Attorney Matchmaker MCP Server

Exposes 4 tools to Claude Desktop / Claude Code:
  - intake_case
  - match_attorneys
  - get_roster
  - get_leaderboard

Each tool requires an `api_key` parameter. Keys are generated via
POST /api/attorney/mcp-keys (requires attorney JWT).

Usage in claude_desktop_config.json:
  {
    "mcpServers": {
      "attorney-matchmaker": {
        "command": "python",
        "args": ["/absolute/path/to/backend/mcp_server.py"],
        "env": {
          "ATTORNEY_API_URL": "https://attorney-matchmaker.onrender.com"
        }
      }
    }
  }
"""

from __future__ import annotations

import asyncio
import json
import os

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

API_URL = os.getenv("ATTORNEY_API_URL", "https://attorney-matchmaker.onrender.com")

server = Server("attorney-matchmaker")


def _auth_headers(api_key: str) -> dict:
    return {"X-MCP-API-Key": api_key}


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="intake_case",
            description=(
                "Submit a legal case description to Attorney Matchmaker. "
                "Returns a case_id that must be passed to match_attorneys. "
                "Call this first whenever a user wants to find an attorney."
            ),
            inputSchema={
                "type": "object",
                "required": ["api_key", "description", "urgency"],
                "properties": {
                    "api_key": {"type": "string", "description": "Your MCP API key from the attorney portal"},
                    "description": {"type": "string", "description": "Full description of the legal situation"},
                    "urgency": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "emergency"],
                        "description": "How urgent is the matter",
                    },
                    "budget_goals": {
                        "type": "object",
                        "description": "Optional budget constraints",
                        "properties": {
                            "max_hourly": {"type": "number"},
                            "total_budget": {"type": "number"},
                        },
                    },
                },
            },
        ),
        types.Tool(
            name="match_attorneys",
            description=(
                "Get AI-ranked attorney matches for a case. "
                "Returns attorneys with match scores, practice area analysis, "
                "venue recommendation, and Claude Opus audit reasoning. "
                "Requires a case_id from intake_case."
            ),
            inputSchema={
                "type": "object",
                "required": ["api_key", "case_id"],
                "properties": {
                    "api_key": {"type": "string", "description": "Your MCP API key"},
                    "case_id": {"type": "string", "description": "case_id returned by intake_case"},
                },
            },
        ),
        types.Tool(
            name="get_roster",
            description=(
                "Browse registered attorneys. "
                "Filter by jurisdiction (e.g. 'New York') or practice_area (e.g. 'real estate'). "
                "Use this to explore available attorneys without submitting a case."
            ),
            inputSchema={
                "type": "object",
                "required": ["api_key"],
                "properties": {
                    "api_key": {"type": "string", "description": "Your MCP API key"},
                    "jurisdiction": {"type": "string", "description": "State or federal jurisdiction"},
                    "practice_area": {"type": "string", "description": "Practice area filter"},
                },
            },
        ),
        types.Tool(
            name="get_leaderboard",
            description=(
                "Get top-ranked attorneys by domain and/or jurisdiction, "
                "ranked using CourtListener docket data and AI audit scores."
            ),
            inputSchema={
                "type": "object",
                "required": ["api_key"],
                "properties": {
                    "api_key": {"type": "string", "description": "Your MCP API key"},
                    "domain": {
                        "type": "string",
                        "description": "Practice domain (e.g. 'real_estate', 'ip', 'immigration', 'family')",
                    },
                    "jurisdiction": {"type": "string", "description": "Jurisdiction filter"},
                    "top_n": {"type": "integer", "default": 5, "description": "Number of results"},
                },
            },
        ),
    ]


async def _validate_key(api_key: str) -> bool:
    """Validate API key against the live API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{API_URL}/api/mcp-validate",
            headers={"X-MCP-API-Key": api_key},
        )
        return resp.status_code == 200


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    api_key = arguments.get("api_key", "")
    if not api_key:
        return [types.TextContent(type="text", text='{"error": "api_key is required"}')]

    # Validate key
    if not await _validate_key(api_key):
        return [types.TextContent(type="text", text='{"error": "Invalid API key. Generate one at /app (Attorney tab > API Keys)."}')]

    headers = _auth_headers(api_key)

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if name == "intake_case":
                payload = {
                    "description": arguments["description"],
                    "urgency": arguments["urgency"],
                }
                if "budget_goals" in arguments:
                    payload["budget_goals"] = arguments["budget_goals"]
                resp = await client.post(f"{API_URL}/api/intake", json=payload, headers=headers)

            elif name == "match_attorneys":
                resp = await client.post(
                    f"{API_URL}/api/match",
                    json={"case_id": arguments["case_id"]},
                    headers=headers,
                )

            elif name == "get_roster":
                params = {}
                if "jurisdiction" in arguments:
                    params["jurisdiction"] = arguments["jurisdiction"]
                if "practice_area" in arguments:
                    params["practice_area"] = arguments["practice_area"]
                resp = await client.get(f"{API_URL}/api/attorneys", params=params, headers=headers)

            elif name == "get_leaderboard":
                params = {}
                if "domain" in arguments:
                    params["domain"] = arguments["domain"]
                if "jurisdiction" in arguments:
                    params["jurisdiction"] = arguments["jurisdiction"]
                if "top_n" in arguments:
                    params["top_n"] = arguments["top_n"]
                resp = await client.get(f"{API_URL}/api/leaderboard", params=params, headers=headers)

            else:
                return [types.TextContent(type="text", text=f'{{"error": "Unknown tool: {name}"}}"')]

            resp.raise_for_status()
            return [types.TextContent(type="text", text=json.dumps(resp.json(), indent=2))]

        except httpx.HTTPStatusError as e:
            return [types.TextContent(type="text", text=f'{{"error": "API error {e.response.status_code}", "detail": "{e.response.text[:200]}"}}')]
        except Exception as e:
            return [types.TextContent(type="text", text=f'{{"error": "{str(e)}"}}')]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
