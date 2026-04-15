# Tiny MCP HTTP Server (Cloud Agents Friendly)

这是一个最小可运行的 **MCP HTTP 服务**，暴露 `POST /mcp`，并注册了一个工具：

- `get_order_detail(order_id)`

该工具会在服务端请求业务接口：

`https://youxuer8.test.xdf.cn/api/order/rnInterface/test/getOrderDetail?orderId=...`

---

## 1) 安装与启动

```bash
npm install
npm start
```

默认监听：`http://0.0.0.0:3000/mcp`

可选环境变量：

- `PORT`：MCP 服务端口（默认 `3000`）
- `REQUEST_TIMEOUT_MS`：上游请求超时毫秒数（默认 `10000`）
- `ORDER_DETAIL_API_BASE`：上游订单接口地址（默认就是上面的 youxuer8 URL）

---

## 2) Cloud Agents 里应该填什么 URL

在 Cloud Agents 里配置 MCP 时，填的是 **你部署出来的 MCP 服务地址**，例如：

- `https://your-mcp-host/mcp`

不要填业务接口地址（`youxuer8...getOrderDetail`），因为那只是 MCP 工具内部调用的上游 API。

---

## 3) 工具行为

`get_order_detail(order_id)` 接收 `order_id`（字符串）并返回：

- `content.text`：上游响应的 JSON 文本（或文本内容）
- `structuredContent`：包含 `order_id`、请求 URL、请求方法、以及返回数据

实现上会优先用 `GET` 请求上游；如果上游返回 `405`，自动回退到 `POST` 再试一次。

当上游请求失败（超时 / 非 2xx / 网络错误）时，工具返回 `isError: true` 和错误信息。
