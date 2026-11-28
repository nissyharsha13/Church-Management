// Local stand-ins for Google/YouTube and OBS, so the streaming flow can be tested
// end-to-end without a real channel or OBS. Not used in production.
const http = require("node:http");
const { WebSocketServer } = require("ws");

function startMocks({ googlePort = 3201, obsPort = 3202 } = {}) {
  const state = {
    obsStreaming: false,
    obsStreamSettings: null,
    scene: "Screen + Pulpit",
    muted: { "Pulpit mic": false, "Choir mics": false },
    broadcast: null,
    description: "",
    calls: [],
  };

  // ---------------- Google / YouTube ----------------
  const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const ytErr = (res, code, reason, message) => json(res, code, { error: { code, message, errors: [{ reason }] } });
  const google = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${googlePort}`);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      state.calls.push(`${req.method} ${url.pathname}`);
      if (url.pathname === "/auth") {
        const back = new URL(url.searchParams.get("redirect_uri"));
        back.searchParams.set("code", "test-code");
        back.searchParams.set("state", url.searchParams.get("state"));
        res.writeHead(302, { location: back.toString() });
        return res.end();
      }
      if (url.pathname === "/token") {
        const p = new URLSearchParams(body);
        if (p.get("grant_type") === "authorization_code") return json(res, 200, { access_token: "at-1", expires_in: 3600, refresh_token: "rt-1" });
        return json(res, 200, { access_token: "at-2", expires_in: 3600 });
      }
      if (url.pathname === "/revoke") return json(res, 200, {});
      if (!url.pathname.startsWith("/youtube/v3/")) return json(res, 404, {});
      if (!/^Bearer at-/.test(req.headers.authorization || "")) return ytErr(res, 401, "authError", "no token");
      const path = url.pathname.slice("/youtube/v3/".length);
      const ingest = { ingestionAddress: "rtmp://a.rtmp.youtube.com/live2", rtmpsIngestionAddress: "rtmps://a.rtmps.youtube.com:443/live2", streamName: "test-stream-key-1234" };
      const streamItem = () => ({ id: "stream-1", cdn: { ingestionInfo: ingest }, status: { streamStatus: state.obsStreaming ? "active" : "inactive", healthStatus: { status: state.obsStreaming ? "good" : "noData" } } });
      if (path === "channels") return json(res, 200, { items: [{ id: "UC-test", snippet: { title: "Divine Church Test", customUrl: "@divinetest", thumbnails: { default: { url: "" } } } }] });
      if (path === "liveStreams" && req.method === "POST") return json(res, 200, streamItem());
      if (path === "liveStreams") return json(res, 200, { items: url.searchParams.get("id") === "stream-1" ? [streamItem()] : [] });
      if (path === "liveBroadcasts" && req.method === "POST") {
        const b = JSON.parse(body);
        state.broadcast = { id: "bc-1", snippet: { ...b.snippet }, status: { lifeCycleStatus: "ready", privacyStatus: b.status.privacyStatus }, contentDetails: { ...b.contentDetails, boundStreamId: "stream-1" } };
        state.description = b.snippet.description;
        return json(res, 200, { id: "bc-1" });
      }
      if (path === "liveBroadcasts/bind") return json(res, 200, { id: "bc-1" });
      if (path === "liveBroadcasts") return json(res, 200, { items: state.broadcast && url.searchParams.get("id") === "bc-1" ? [state.broadcast] : [] });
      if (path === "liveBroadcasts/transition") {
        const to = url.searchParams.get("broadcastStatus");
        if (to === "live" && !state.obsStreaming) return ytErr(res, 403, "invalidTransition", "stream inactive");
        if (state.broadcast.status.lifeCycleStatus === to) return ytErr(res, 403, "redundantTransition", "already");
        state.broadcast.status.lifeCycleStatus = to;
        if (to === "live") state.broadcast.snippet.actualStartTime = new Date().toISOString();
        if (to === "complete") state.broadcast.snippet.actualEndTime = new Date().toISOString();
        return json(res, 200, state.broadcast);
      }
      if (path === "videos" && req.method === "PUT") {
        state.description = JSON.parse(body).snippet.description;
        return json(res, 200, {});
      }
      if (path === "videos") {
        const part = url.searchParams.get("part");
        if (part === "liveStreamingDetails") return json(res, 200, { items: [{ liveStreamingDetails: { concurrentViewers: "7" } }] });
        return json(res, 200, { items: [{ snippet: { title: state.broadcast.snippet.title, description: state.description, categoryId: "29" } }] });
      }
      return json(res, 404, { error: { message: `mock: ${path}` } });
    });
  });
  google.listen(googlePort);

  // ---------------- OBS (obs-websocket v5, JSON) ----------------
  const wss = new WebSocketServer({ port: obsPort });
  const SCENES = ["Wide cam", "Pulpit cam", "Screen + Pulpit"]; // OBS order: bottom to top
  let bytes = 0;
  wss.on("connection", (ws) => {
    let meters = 0;
    const send = (op, d) => ws.send(JSON.stringify({ op, d }));
    const event = (eventType, eventData) => send(5, { eventType, eventIntent: 0, eventData });
    send(0, { obsWebSocketVersion: "5.5.0", rpcVersion: 1 });
    const timer = setInterval(() => {
      if (state.obsStreaming) bytes += 600_000;
      if (meters & (1 << 16)) event("InputVolumeMeters", { inputs: [{ inputName: "Pulpit mic", inputLevelsMul: [[0.3, 0.5, 0.5]] }, { inputName: "Choir mics", inputLevelsMul: [[0.05, 0.1, 0.1]] }] });
    }, 100);
    ws.on("close", () => clearInterval(timer));
    ws.on("message", (raw) => {
      const { op, d } = JSON.parse(raw);
      if (op === 1) { meters = d.eventSubscriptions ?? 0; return send(2, { negotiatedRpcVersion: 1 }); }
      if (op !== 6) return;
      const ok = (responseData) => send(7, { requestType: d.requestType, requestId: d.requestId, requestStatus: { result: true, code: 100 }, responseData });
      const fail = (code) => send(7, { requestType: d.requestType, requestId: d.requestId, requestStatus: { result: false, code, comment: "mock" } });
      const r = d.requestData || {};
      state.calls.push(`OBS ${d.requestType}`);
      switch (d.requestType) {
        case "GetSceneList": return ok({ currentProgramSceneName: state.scene, currentPreviewSceneName: null, scenes: SCENES.map((sceneName, sceneIndex) => ({ sceneName, sceneIndex })) });
        case "SetCurrentProgramScene": state.scene = r.sceneName; ok(); return event("CurrentProgramSceneChanged", { sceneName: r.sceneName });
        case "GetInputList": return ok({ inputs: [{ inputName: "Pulpit mic" }, { inputName: "Choir mics" }, { inputName: "Pulpit camera" }] });
        case "GetInputMute": return r.inputName in state.muted ? ok({ inputMuted: state.muted[r.inputName] }) : fail(604);
        case "ToggleInputMute": state.muted[r.inputName] = !state.muted[r.inputName]; ok({ inputMuted: state.muted[r.inputName] }); return event("InputMuteStateChanged", { inputName: r.inputName, inputMuted: state.muted[r.inputName] });
        case "GetStreamServiceSettings": return ok({ streamServiceType: state.obsStreamSettings ? "rtmp_custom" : "rtmp_common", streamServiceSettings: state.obsStreamSettings ?? {} });
        case "SetStreamServiceSettings": state.obsStreamSettings = r.streamServiceSettings; return ok();
        case "StartStream": state.obsStreaming = true; ok(); return event("StreamStateChanged", { outputActive: true, outputState: "OBS_WEBSOCKET_OUTPUT_STARTED" });
        case "StopStream": state.obsStreaming = false; ok(); return event("StreamStateChanged", { outputActive: false, outputState: "OBS_WEBSOCKET_OUTPUT_STOPPED" });
        case "GetSourceScreenshot": return ok({ imageData: "data:image/jpg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAkAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5/ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//Z" }); // black frame
        case "GetStreamStatus": return ok({ outputActive: state.obsStreaming, outputReconnecting: false, outputTimecode: "00:00:00.000", outputDuration: 0, outputCongestion: 0, outputBytes: bytes, outputSkippedFrames: 0, outputTotalFrames: 100 });
        default: return fail(204);
      }
    });
  });

  return { state, close: () => { google.close(); wss.close(); } };
}

module.exports = { startMocks };
