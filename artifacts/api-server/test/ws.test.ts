import { test, expect } from "vitest";
import http from "http";
import { initWebsocket, emitToDebtor } from "../src/lib/ws";
import { io as Client } from "socket.io-client";
import { signToken } from "../src/lib/auth";

test("emitToDebtor delivers events to joined clients", async () => {
  const srv = http.createServer();
  await new Promise((res) => srv.listen(0, res));
  const port = (srv.address() as any).port;

  const ioServer = initWebsocket(srv as any);

  const url = `http://localhost:${port}`;
  const token = signToken({ id: "test-user", email: "test@example.com", role: "user" });
  const client = Client(url, { transports: ["websocket"], forceNew: true, auth: { token } });

  await new Promise((res) => client.on("connect", res));

  const debtorId = "test-debtor-1";
  client.emit("joinDebtor", debtorId);

  const payload = { hello: "world" };

  const received = await new Promise((resolve, reject) => {
    client.on("whatsapp_inbound", (data: any) => resolve(data));
    setTimeout(() => reject(new Error("timeout waiting for ws message")), 2000);
    // emit after a small tick to ensure join processed
    setTimeout(() => {
      try {
        emitToDebtor(debtorId, "whatsapp_inbound", payload);
      } catch (e) {
        // ignore
      }
    }, 50);
  });

  expect(received).toEqual(payload);

  client.close();
  ioServer?.close();
  await new Promise((res) => srv.close(res));
});
