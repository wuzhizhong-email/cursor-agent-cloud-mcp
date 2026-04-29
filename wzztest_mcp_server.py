import base64
import os

import httpx
from mcp.server.fastmcp import FastMCP

UPSTREAM_URL = (
    "https://youxuer8.test.xdf.cn/api/sysmanage/securityCode/getSecurityCode"
)

mcp = FastMCP(
    name="wzzTest",
    instructions="Return security code image as base64.",
    host=os.getenv("MCP_HOST", "0.0.0.0"),
    port=int(os.getenv("MCP_PORT", "8765")),
    streamable_http_path=os.getenv("MCP_PATH", "/mcp"),
)


@mcp.tool(description="Simple health check for MCP deployment validation.")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "wzzTest"}


@mcp.tool(
    description="Call upstream security code API and return image in base64 format."
)
def get_security_code_image(login_mode: str = "Front") -> dict[str, str | int]:
    try:
        response = httpx.get(
            UPSTREAM_URL,
            params={"loginMode": login_mode},
            timeout=20.0,
            headers={"accept": "image/*,*/*"},
            follow_redirects=True,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Upstream request failed: {exc}") from exc

    if not response.content:
        raise RuntimeError("Upstream request succeeded but returned empty body")

    mime_type = response.headers.get("content-type", "application/octet-stream")
    base64_image = base64.b64encode(response.content).decode("ascii")

    return {
        "login_mode": login_mode,
        "mime_type": mime_type.split(";")[0].strip(),
        "image_base64": base64_image,
        "byte_size": len(response.content),
    }


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
