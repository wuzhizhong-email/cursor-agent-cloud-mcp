import anyio
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamablehttp_client


async def main() -> None:
    async with streamablehttp_client("http://127.0.0.1:8765/mcp") as (
        read_stream,
        write_stream,
        _,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("tools:", [tool.name for tool in tools.tools])

            health = await session.call_tool("health_check", {})
            print("health_check:", health)

            result = await session.call_tool(
                "get_security_code_image", {"login_mode": "Front"}
            )
            text = result.content[0].text if result.content else ""
            print("get_security_code_image response length:", len(text))
            print(text[:200])


if __name__ == "__main__":
    anyio.run(main)
