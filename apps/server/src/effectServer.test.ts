import assert from "node:assert/strict";
import http from "node:http";
import { Socket } from "node:net";

import { describe, it } from "vitest";

import { trackUpgradedSocketsForShutdown } from "./effectServer";

describe("trackUpgradedSocketsForShutdown", () => {
  it("destroys active upgraded sockets during shutdown", () => {
    const server = http.createServer();
    const stopTracking = trackUpgradedSocketsForShutdown(server);
    const socket = new Socket();

    server.emit("upgrade", new http.IncomingMessage(socket), socket, Buffer.alloc(0));
    stopTracking();

    assert.equal(socket.destroyed, true);
  });

  it("destroys active upgraded sockets before server close waits", async () => {
    const server = http.createServer();
    const stopTracking = trackUpgradedSocketsForShutdown(server);
    const socket = new Socket();

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    server.emit("upgrade", new http.IncomingMessage(socket), socket, Buffer.alloc(0));
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    stopTracking();

    assert.equal(socket.destroyed, true);
  });

  it("stops tracking sockets that already closed", () => {
    const server = http.createServer();
    const stopTracking = trackUpgradedSocketsForShutdown(server);
    const socket = new Socket();

    server.emit("upgrade", new http.IncomingMessage(socket), socket, Buffer.alloc(0));
    socket.destroy();
    stopTracking();

    assert.equal(socket.destroyed, true);
  });

  it("removes shutdown signal listeners when tracking stops", () => {
    const server = http.createServer();
    const sigintListenersBefore = process.listenerCount("SIGINT");
    const sigtermListenersBefore = process.listenerCount("SIGTERM");
    const stopTracking = trackUpgradedSocketsForShutdown(server);

    stopTracking();

    assert.equal(process.listenerCount("SIGINT"), sigintListenersBefore);
    assert.equal(process.listenerCount("SIGTERM"), sigtermListenersBefore);
  });

  it("does not install process signal listeners", () => {
    const server = http.createServer();
    const sigintListenersBefore = process.listenerCount("SIGINT");
    const sigtermListenersBefore = process.listenerCount("SIGTERM");
    const stopTracking = trackUpgradedSocketsForShutdown(server);

    try {
      assert.equal(process.listenerCount("SIGINT"), sigintListenersBefore);
      assert.equal(process.listenerCount("SIGTERM"), sigtermListenersBefore);
    } finally {
      stopTracking();
    }
  });
});
