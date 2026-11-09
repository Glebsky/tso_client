#!/usr/bin/env python3
"""Decode a captured TSO AMF packet.

Usage:
    python3 decode.py amf/call03_response.bin
    python3 decode.py amf/call03_response.b64 --schema
    python3 decode.py amf/call03_response.bin --path body.data.data.timedProductions_vector

No third-party dependencies. Requires amf3.py next to this file.
"""
import base64, json, sys
import amf3


def derefed(o, seen=None, path="$"):
    """Repeated object references become {'__ref': first_path} (cycle safe)."""
    if seen is None:
        seen = {}
    if isinstance(o, (dict, list)):
        if id(o) in seen:
            return {"__ref": seen[id(o)]}
        seen[id(o)] = path
    if isinstance(o, dict):
        return {k: derefed(v, seen, path + "." + k) for k, v in o.items()}
    if isinstance(o, list):
        return [derefed(v, seen, "%s[%d]" % (path, i)) for i, v in enumerate(o)]
    return o


def schema(o, depth=0, maxdepth=6):
    """Structural outline: class names, field types, collection sizes."""
    if isinstance(o, dict):
        if o.get("__externalizable"):
            inner = o.get("__value")
            n = len(inner) if isinstance(inner, list) else 0
            s = {"__type": o.get("__class"), "__len": n}
            if n and depth < maxdepth:
                s["__item"] = schema(inner[0], depth + 1, maxdepth)
            return s
        cls = o.get("__class")
        if depth >= maxdepth:
            return "<%s>" % cls
        out = {"__type": cls}
        for k, v in o.items():
            if k != "__class":
                out[k] = schema(v, depth + 1, maxdepth)
        return out
    if isinstance(o, list):
        if depth >= maxdepth:
            return "<list[%d]>" % len(o)
        return {"__list_len": len(o),
                "__item": schema(o[0], depth + 1, maxdepth) if o else None}
    if o is None:
        return "null"
    if isinstance(o, bool):
        return "bool=%s" % o
    if isinstance(o, float):
        return "double=%s" % o
    if isinstance(o, int):
        return "int=%s" % o
    if isinstance(o, str):
        return "string=%r" % o[:60]
    return type(o).__name__


def load(path):
    raw = open(path, "rb").read()
    stripped = bytes(c for c in raw if c not in b" \r\n\t")
    if stripped[:1] not in (b"\x00", b"\x03"):
        try:
            return base64.b64decode(stripped, validate=True)
        except Exception:
            pass
    return raw


def main():
    argv = sys.argv[1:]
    files = [a for a in argv if not a.startswith("--")]
    if not files:
        print(__doc__)
        return 1
    path = None
    if "--path" in argv:
        i = argv.index("--path")
        path = argv[i + 1] if i + 1 < len(argv) else None
        if path in files:
            files.remove(path)

    pkt = amf3.decode_packet(load(files[0]))
    body = pkt["bodies"][0]
    sys.stderr.write("# target=%r declared_len=%s amf_version=%s\n" % (
        body.get("target"), body.get("declared_len"), pkt.get("amf_version")))

    value = body.get("value")
    if path:
        for part in path.split("."):
            if isinstance(value, dict) and value.get("__externalizable"):
                value = value.get("__value")
            value = value[int(part)] if isinstance(value, list) else value[part]

    out = schema(value) if "--schema" in argv else derefed(value)
    print(json.dumps(out, indent=2, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
