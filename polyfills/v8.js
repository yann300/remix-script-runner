import * as msgpack from "@msgpack/msgpack";
const { Buffer } = require("buffer");

export let serialize = (v) =>
  Buffer.from(msgpack.encode(v, { extensionCodec }));
export let deserialize = (v) => msgpack.decode(v, { extensionCodec });

// Derived fromƒ
// https://github.com/msgpack/msgpack-javascript#extension-types
const extensionCodec = new msgpack.ExtensionCodec();
extensionCodec.register({
  type: 0,
  decode(value) {
    return new Set(msgpack.decode(value, { extensionCodec }));
  },
  encode(value) {
    return value instanceof Set
      ? msgpack.encode([...value], { extensionCodec })
      : null;
  },
});
extensionCodec.register({
  type: 1,
  decode(value) {
    return new Map(msgpack.decode(value, { extensionCodec }));
  },
  encode(value) {
    return value instanceof Map
      ? msgpack.encode([...value], { extensionCodec })
      : null;
  },
});
