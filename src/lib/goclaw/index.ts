import { GoclawWSClient } from "./ws-client";

const GOCLAW_URL = process.env.GOCLAW_URL;
const GOCLAW_TOKEN = process.env.GOCLAW_GATEWAY_TOKEN;

let client: GoclawWSClient | null = null;

export function getGoclawClient(): GoclawWSClient {
  if (!client && GOCLAW_URL && GOCLAW_TOKEN) {
    const wsUrl = GOCLAW_URL.replace(/^http/, "ws") + "/ws";
    client = new GoclawWSClient(wsUrl, GOCLAW_TOKEN);
  }
  if (!client) {
    throw new Error("GoClaw not configured: GOCLAW_URL or GOCLAW_GATEWAY_TOKEN missing");
  }
  return client;
}
