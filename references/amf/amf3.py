import base64, struct, json, sys

class R:
    def __init__(self, b):
        self.b = b
        self.i = 0
        self.strs = []
        self.objs = []
        self.traits = []

    def u8(self):
        v = self.b[self.i]
        self.i += 1
        return v

    def u16(self):
        v = struct.unpack_from(">H", self.b, self.i)[0]
        self.i += 2
        return v

    def u32(self):
        v = struct.unpack_from(">I", self.b, self.i)[0]
        self.i += 4
        return v

    def u29(self):
        v = 0
        for n in range(3):
            byte = self.u8()
            v = (v << 7) | (byte & 0x7F)
            if not byte & 0x80:
                return v
        byte = self.u8()
        return (v << 8) | byte

    def d64(self):
        v = struct.unpack_from(">d", self.b, self.i)[0]
        self.i += 8
        return v

    def s(self):
        h = self.u29()
        if h & 1 == 0:
            return self.strs[h >> 1]
        ln = h >> 1
        if ln == 0:
            return ""
        raw = self.b[self.i:self.i + ln]
        self.i += ln
        v = raw.decode("utf-8", "replace")
        self.strs.append(v)
        return v

    def val(self):
        m = self.u8()
        if m == 0x00:
            return None            # undefined
        if m == 0x01:
            return None            # null
        if m == 0x02:
            return False
        if m == 0x03:
            return True
        if m == 0x04:
            return self.u29()      # integer
        if m == 0x05:
            return self.d64()      # double
        if m == 0x06:
            return self.s()        # string
        if m == 0x08:              # date
            h = self.u29()
            if h & 1 == 0:
                return self.objs[h >> 1]
            v = {"__date_ms": self.d64()}
            self.objs.append(v)
            return v
        if m == 0x09:
            return self.array()
        if m == 0x0A:
            return self.obj()
        if m == 0x0C:              # byte array
            h = self.u29()
            ln = h >> 1
            raw = self.b[self.i:self.i + ln]
            self.i += ln
            return {"__bytes": ln}
        raise ValueError(f"marker 0x{m:02x} at {self.i - 1}")

    def array(self):
        h = self.u29()
        if h & 1 == 0:
            return self.objs[h >> 1]
        dense = h >> 1
        out = []
        self.objs.append(out)
        assoc = {}
        while True:
            k = self.s()
            if k == "":
                break
            assoc[k] = self.val()
        for _ in range(dense):
            out.append(self.val())
        if assoc:
            out.append({"__assoc": assoc})
        return out

    def obj(self):
        h = self.u29()
        if h & 1 == 0:
            return self.objs[h >> 1]
        h >>= 1
        if h & 1 == 0:             # trait reference
            tr = self.traits[h >> 1]
        else:
            h >>= 1
            ext = bool(h & 1)
            h >>= 1
            dyn = bool(h & 1)
            cnt = h >> 1
            cls = self.s()
            props = [self.s() for _ in range(cnt)]
            tr = {"cls": cls, "props": props, "dyn": dyn, "ext": ext}
            self.traits.append(tr)
        o = {"__class": tr["cls"] or "Object"}
        self.objs.append(o)
        if tr["ext"]:
            o["__externalizable"] = True
            o["__value"] = self.val()
            return o
        for p in tr["props"]:
            o[p] = self.val()
        if tr["dyn"]:
            while True:
                k = self.s()
                if k == "":
                    break
                o[k] = self.val()
        return o




def decode_packet(data):
    r = R(data)
    out = {"amf_version": r.u16(), "headers": r.u16(), "bodies": []}
    bcount = r.u16()
    for _ in range(bcount):
        tln = r.u16(); target = r.b[r.i:r.i+tln].decode("utf-8","replace"); r.i += tln
        rln = r.u16(); resp = r.b[r.i:r.i+rln].decode("utf-8","replace"); r.i += rln
        blen = r.u32()
        entry = {"target": target, "response": resp, "declared_len": blen}
        try:
            marker = r.u8()
            entry["marker"] = hex(marker)
            entry["value"] = r.val()
        except Exception as e:
            entry["error"] = f"{type(e).__name__}: {e} at offset {r.i}"
        out["bodies"].append(entry)
    return out
