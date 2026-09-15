#!/usr/bin/env python3
"""Read an SO-101 leader arm and expose its encoder positions to Kural.

This bridge only calls Feetech read instructions. It never enables torque,
changes settings, or sends a position command to any physical motor.
"""

from __future__ import annotations

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Final

from scservo_sdk import COMM_SUCCESS, PacketHandler, PortHandler

JOINT_IDS: Final = {
    "shoulder_pan": 1,
    "shoulder_lift": 2,
    "elbow_flex": 3,
    "wrist_flex": 4,
    "wrist_roll": 5,
    "gripper": 6,
}
PRESENT_POSITION_ADDRESS: Final = 56


class ReadOnlyLeader:
    def __init__(self, port_name: str):
        self.port_name = port_name
        self.port = PortHandler(port_name)
        self.packet = PacketHandler(0)
        self.sequence = 0

    def connect(self) -> None:
        if not self.port.openPort():
            raise OSError(f"Could not open {self.port_name}")
        if not self.port.setBaudRate(1_000_000):
            raise OSError(f"Could not set {self.port_name} to 1 Mbps")

    def close(self) -> None:
        if self.port.is_open:
            self.port.closePort()

    def sample(self) -> dict:
        joints: dict[str, int] = {}
        errors: list[str] = []
        for name, servo_id in JOINT_IDS.items():
            value, result, error = self.packet.read2ByteTxRx(
                self.port, servo_id, PRESENT_POSITION_ADDRESS
            )
            if result != COMM_SUCCESS:
                errors.append(f"{name}: {self.packet.getTxRxResult(result)}")
            elif error:
                errors.append(f"{name}: {self.packet.getRxPacketError(error)}")
            else:
                joints[name] = int(value)
        self.sequence += 1
        return {
            "connected": len(joints) == len(JOINT_IDS),
            "sequence": self.sequence,
            "timestampMs": round(time.time() * 1000),
            "joints": joints if len(joints) == len(JOINT_IDS) else None,
            "error": "; ".join(errors) if errors else None,
            "readOnly": True,
            "port": self.port_name,
        }


def make_handler(leader: ReadOnlyLeader):
    class Handler(BaseHTTPRequestHandler):
        def _send_json(self, status: int, payload: dict) -> None:
            body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/healthz":
                self._send_json(200, {"ok": True, "readOnly": True})
                return
            if self.path != "/v1/leader/state":
                self._send_json(404, {"error": "Not found"})
                return
            try:
                self._send_json(200, leader.sample())
            except Exception as error:
                self._send_json(503, {
                    "connected": False,
                    "sequence": leader.sequence,
                    "timestampMs": round(time.time() * 1000),
                    "joints": None,
                    "error": str(error),
                    "readOnly": True,
                })

        def log_message(self, _format: str, *_args: object) -> None:
            return

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only SO-101 leader bridge for Kural")
    parser.add_argument("--port", default="/dev/cu.usbmodem5AB90648781")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--listen-port", type=int, default=8767)
    args = parser.parse_args()

    leader = ReadOnlyLeader(args.port)
    leader.connect()
    server = ThreadingHTTPServer((args.host, args.listen_port), make_handler(leader))
    print(f"Kural leader bridge listening on http://{args.host}:{args.listen_port} (read-only)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        leader.close()


if __name__ == "__main__":
    main()
