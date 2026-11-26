// Minimal, zero-dependency WebAssembly binary module assembler.
// Generates valid MVP WebAssembly bytecode directly from structured JS helpers.

export const VALTYPE = {
  i32: 0x7f,
  void: 0x40,
};

export const OP = {
  unreachable: 0x00,
  nop: 0x01,
  block: 0x02,
  loop: 0x03,
  if: 0x04,
  else: 0x05,
  end: 0x0b,
  br: 0x0c,
  br_if: 0x0d,
  return: 0x0f,
  call: 0x10,
  drop: 0x1a,
  select: 0x1b,
  local_get: 0x20,
  local_set: 0x21,
  local_tee: 0x22,
  i32_load: 0x28,
  i32_load8_u: 0x2d,
  i32_store: 0x36,
  i32_store8: 0x3a,
  i32_const: 0x41,
  i32_eqz: 0x45,
  i32_eq: 0x46,
  i32_ne: 0x47,
  i32_lt_s: 0x48,
  i32_lt_u: 0x49,
  i32_gt_s: 0x4a,
  i32_gt_u: 0x4b,
  i32_le_s: 0x4c,
  i32_ge_s: 0x4e,
  i32_add: 0x6a,
  i32_sub: 0x6b,
  i32_mul: 0x6c,
  i32_div_s: 0x6d,
  i32_rem_s: 0x6f,
  i32_rem_u: 0x70,
  i32_and: 0x71,
  i32_or: 0x72,
  i32_xor: 0x73,
  i32_shl: 0x74,
  i32_shr_s: 0x75,
  i32_shr_u: 0x76,
};

export function uleb128(value) {
  let v = value >>> 0;
  const out = [];
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return out;
}

export function sleb128(value) {
  let v = value | 0;
  const out = [];
  let more = true;
  while (more) {
    let byte = v & 0x7f;
    v >>= 7;
    if ((v === 0 && (byte & 0x40) === 0) || (v === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    out.push(byte);
  }
  return out;
}

function encodeString(str) {
  const bytes = Array.from(new TextEncoder().encode(str));
  return [...uleb128(bytes.length), ...bytes];
}

function encodeVec(items) {
  const flat = [];
  for (const item of items) {
    for (const b of item) flat.push(b);
  }
  return [...uleb128(items.length), ...flat];
}

function encodeSection(id, payload) {
  return [id, ...uleb128(payload.length), ...payload];
}

// Instruction builders for clean, readable WebAssembly assembly in JS
export const i32 = {
  const: (n) => [OP.i32_const, ...sleb128(n)],
  load: (offset = 0, align = 2) => [OP.i32_load, ...uleb128(align), ...uleb128(offset)],
  load8_u: (offset = 0, align = 0) => [OP.i32_load8_u, ...uleb128(align), ...uleb128(offset)],
  store: (offset = 0, align = 2) => [OP.i32_store, ...uleb128(align), ...uleb128(offset)],
  store8: (offset = 0, align = 0) => [OP.i32_store8, ...uleb128(align), ...uleb128(offset)],
  eqz: () => [OP.i32_eqz],
  eq: () => [OP.i32_eq],
  ne: () => [OP.i32_ne],
  lt_s: () => [OP.i32_lt_s],
  lt_u: () => [OP.i32_lt_u],
  gt_s: () => [OP.i32_gt_s],
  gt_u: () => [OP.i32_gt_u],
  le_s: () => [OP.i32_le_s],
  ge_s: () => [OP.i32_ge_s],
  add: () => [OP.i32_add],
  sub: () => [OP.i32_sub],
  mul: () => [OP.i32_mul],
  div_s: () => [OP.i32_div_s],
  rem_s: () => [OP.i32_rem_s],
  rem_u: () => [OP.i32_rem_u],
  and: () => [OP.i32_and],
  or: () => [OP.i32_or],
  xor: () => [OP.i32_xor],
  shl: () => [OP.i32_shl],
  shr_s: () => [OP.i32_shr_s],
  shr_u: () => [OP.i32_shr_u],
};

export const local = {
  get: (idx) => [OP.local_get, ...uleb128(idx)],
  set: (idx) => [OP.local_set, ...uleb128(idx)],
  tee: (idx) => [OP.local_tee, ...uleb128(idx)],
};

export const ctrl = {
  block: (body, type = VALTYPE.void) => [OP.block, type, ...flatten(body), OP.end],
  loop: (body, type = VALTYPE.void) => [OP.loop, type, ...flatten(body), OP.end],
  if: (cond, thenBody, elseBody = null, type = VALTYPE.void) => [
    ...flatten(cond),
    OP.if,
    type,
    ...flatten(thenBody),
    ...(elseBody ? [OP.else, ...flatten(elseBody)] : []),
    OP.end,
  ],
  br: (depth) => [OP.br, ...uleb128(depth)],
  br_if: (depth) => [OP.br_if, ...uleb128(depth)],
  return: () => [OP.return],
  call: (fnIdx) => [OP.call, ...uleb128(fnIdx)],
  drop: () => [OP.drop],
};

export function flatten(tree) {
  const out = [];
  const stack = [tree];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      for (let i = cur.length - 1; i >= 0; i--) {
        stack.push(cur[i]);
      }
    } else if (typeof cur === "number") {
      out.push(cur & 0xff);
    }
  }
  return out;
}

export class WasmModuleBuilder {
  constructor(memoryPages = 1) {
    this.memoryPages = memoryPages;
    this.types = [];
    this.funcs = [];
    this.exports = [];
    this.funcIndexByName = new Map();
  }

  _internType(params, results) {
    const key = `${params.join(",")}->${results.join(",")}`;
    const existing = this.types.findIndex((t) => t.key === key);
    if (existing !== -1) return existing;
    const idx = this.types.length;
    this.types.push({ key, params, results });
    return idx;
  }

  // Reserve a function index before emitting body (allows forward calls)
  declareFunction(name, params, results, exportName = null) {
    const typeIdx = this._internType(params, results);
    const funcIdx = this.funcs.length;
    this.funcs.push({ name, typeIdx, params, results, locals: [], body: null });
    this.funcIndexByName.set(name, funcIdx);
    if (exportName) {
      this.exports.push({ name: exportName, kind: 0x00, idx: funcIdx });
    }
    return funcIdx;
  }

  defineFunction(name, localCount, bodyBuilder) {
    const funcIdx = this.funcIndexByName.get(name);
    if (funcIdx === undefined) {
      throw new Error(`Undeclared WASM function: ${name}`);
    }
    const fn = this.funcs[funcIdx];
    fn.locals = localCount > 0 ? [[...uleb128(localCount), VALTYPE.i32]] : [];
    const bodyBytes = flatten(bodyBuilder(this.funcIndexByName));
    bodyBytes.push(OP.end);
    fn.body = bodyBytes;
  }

  build() {
    // Verify all declared functions are defined
    for (const fn of this.funcs) {
      if (!fn.body) throw new Error(`Missing body for WASM function: ${fn.name}`);
    }

    const typeEntries = this.types.map((t) => [
      0x60,
      ...uleb128(t.params.length),
      ...t.params,
      ...uleb128(t.results.length),
      ...t.results,
    ]);
    const typeSection = encodeSection(1, encodeVec(typeEntries));

    const funcEntries = this.funcs.map((f) => uleb128(f.typeIdx));
    const funcSection = encodeSection(3, encodeVec(funcEntries));

    // Memory section: 1 memory, min pages = this.memoryPages
    const memSection = encodeSection(5, encodeVec([[0x00, ...uleb128(this.memoryPages)]]));

    // Exports: always export "memory" plus exported functions
    const allExports = [
      { name: "memory", kind: 0x02, idx: 0 },
      ...this.exports,
    ];
    const exportEntries = allExports.map((e) => [
      ...encodeString(e.name),
      e.kind,
      ...uleb128(e.idx),
    ]);
    const exportSection = encodeSection(7, encodeVec(exportEntries));

    const codeEntries = this.funcs.map((f) => {
      const localsEncoded = encodeVec(f.locals);
      const fullBody = [...localsEncoded, ...f.body];
      return [...uleb128(fullBody.length), ...fullBody];
    });
    const codeSection = encodeSection(10, encodeVec(codeEntries));

    return new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // \0asm
      0x01, 0x00, 0x00, 0x00, // version 1
      ...typeSection,
      ...funcSection,
      ...memSection,
      ...exportSection,
      ...codeSection,
    ]);
  }
}
