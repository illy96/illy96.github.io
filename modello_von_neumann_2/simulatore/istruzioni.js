// ************************************************************
// Versione "Istruzioni"
//
// Lo studente scrive il programma nella memoria (32 celle da 16 bit), in
// assembly (LOAD R2 13) o in binario (1000 0001 0100 1101). Non ci sono
// comandi manuali: l'unità di controllo esegue il ciclo
//     prelievo (fetch) -> decodifica -> esecuzione
// e gira da sola rotelle e interruttori, così si vede quali segnali di
// controllo servono per ogni istruzione.
//
// Formato delle istruzioni (16 bit), come nel simulatore originale:
//   LOAD  R M      1 000 0001 0 RR MMMMM      R = M[M]
//   STORE M R      1 000 0010 0 RR MMMMM      M[M] = R
//   MOVE  R1 R2    1 001 0001 0000 RR RR      R1 = R2
//   ADD   R1 R2 R3 1 010 0001 00 RR RR RR     R1 = R2 + R3   (SUB 0010, AND 0011, OR 0100)
//   BRANCH M       0 000 0001 000 MMMMM       PC = M          (BZERO 0010, BNEG 0011)
//   NOP            0000 0000 0000 0000
//   HALT           1111 1111 1111 1111
// ************************************************************

const MEM_WORDS = 32;
const ALU_OPS = {ADD: 0, SUB: 1, AND: 2, OR: 3};          // posizioni della rotella dell'ALU
const ALU_CODES = {ADD: 0xA100, SUB: 0xA200, AND: 0xA300, OR: 0xA400};
const BR_CODES = {BRANCH: 0x0100, BZERO: 0x0200, BNEG: 0x0300};

// ---------- numeri a 16 bit ----------
function toSigned(n) { return ((n & 0xFFFF) ^ 0x8000) - 0x8000; }

function parseVal(str) {
    str = String(str).trim();
    if (prevNumberBase === 2) {
        if (!/^[01]+$/.test(str)) return 0;
        return toSigned(parseInt(str.slice(-16), 2));     // 16 bit in complemento a 2
    }
    const n = parseInt(str, 10);
    return isNaN(n) ? 0 : toSigned(n);
}

function formatVal(n) {
    n = toSigned(n);
    return prevNumberBase === 2 ? dec2bin(n) : String(n);
}

function binGroups(word) {
    const s = (word & 0xFFFF).toString(2).padStart(16, "0");
    return s.slice(0, 4) + " " + s.slice(4, 8) + " " + s.slice(8, 12) + " " + s.slice(12);
}

// ---------- assembler e disassembler ----------
function parseReg(t) {
    const m = /^R([0-3])$/.exec(t);
    return m ? +m[1] : null;
}

function parseAddr(t) {
    if (!/^\d+$/.test(t)) return null;
    const n = +t;
    return n < MEM_WORDS ? n : null;
}

// restituisce {word} oppure {error}
function assemble(text) {
    const tok = text.toUpperCase().replace(/,/g, " ").trim().split(/\s+/);
    const op = tok[0], a = tok.slice(1);
    const need = (k) => a.length === k ? null : `${op} vuole ${k} operand${k === 1 ? "o" : "i"}`;
    const regErr = (t) => `«${t}» non è un registro (R0-R3)`;
    const memErr = (t) => `«${t}» non è un indirizzo di memoria (0-${MEM_WORDS - 1})`;
    let e;
    switch (op) {
        case "LOAD": {
            if ((e = need(2))) return {error: e};
            const r = parseReg(a[0]), m = parseAddr(a[1]);
            if (r === null) return {error: regErr(a[0])};
            if (m === null) return {error: memErr(a[1])};
            return {word: 0x8100 | (r << 5) | m};
        }
        case "STORE": {
            if ((e = need(2))) return {error: e};
            const m = parseAddr(a[0]), r = parseReg(a[1]);
            if (m === null) return {error: memErr(a[0])};
            if (r === null) return {error: regErr(a[1])};
            return {word: 0x8200 | (r << 5) | m};
        }
        case "MOVE": {
            if ((e = need(2))) return {error: e};
            const d = parseReg(a[0]), s = parseReg(a[1]);
            if (d === null) return {error: regErr(a[0])};
            if (s === null) return {error: regErr(a[1])};
            return {word: 0x9100 | (d << 2) | s};
        }
        case "ADD": case "SUB": case "AND": case "OR": {
            if ((e = need(3))) return {error: e};
            const r = a.map(parseReg);
            for (let i = 0; i < 3; i++) if (r[i] === null) return {error: regErr(a[i])};
            return {word: ALU_CODES[op] | (r[0] << 4) | (r[1] << 2) | r[2]};
        }
        case "BRANCH": case "BZERO": case "BNEG": {
            if ((e = need(1))) return {error: e};
            const m = parseAddr(a[0]);
            if (m === null) return {error: memErr(a[0])};
            return {word: BR_CODES[op] | m};
        }
        case "NOP": return a.length ? {error: "NOP non ha operandi"} : {word: 0x0000};
        case "HALT": return a.length ? {error: "HALT non ha operandi"} : {word: 0xFFFF};
    }
    return {error: `«${tok[0]}» non è un'istruzione`};
}

// parola di 16 bit -> istruzione decodificata, oppure null se non è un'istruzione valida
function decode(w) {
    w &= 0xFFFF;
    const R = (x) => "R" + x;
    if (w === 0x0000) return {op: "NOP", text: "NOP"};
    if (w === 0xFFFF) return {op: "HALT", text: "HALT"};
    if ((w & 0xFF80) === 0x8100) { const r = (w >> 5) & 3, m = w & 31; return {op: "LOAD", r, m, text: `LOAD ${R(r)} ${m}`}; }
    if ((w & 0xFF80) === 0x8200) { const r = (w >> 5) & 3, m = w & 31; return {op: "STORE", r, m, text: `STORE ${m} ${R(r)}`}; }
    if ((w & 0xFFF0) === 0x9100) { const d = (w >> 2) & 3, s = w & 3; return {op: "MOVE", d, s, text: `MOVE ${R(d)} ${R(s)}`}; }
    for (const op in ALU_CODES) {
        if ((w & 0xFFC0) === ALU_CODES[op]) {
            const d = (w >> 4) & 3, x = (w >> 2) & 3, y = w & 3;
            return {op, d, x, y, text: `${op} ${R(d)} ${R(x)} ${R(y)}`};
        }
    }
    for (const op in BR_CODES) {
        if ((w & 0xFFE0) === BR_CODES[op]) { const m = w & 31; return {op, m, text: `${op} ${m}`}; }
    }
    return null;
}

// ---------- celle di memoria ----------
// Ogni cella ricorda la parola (data-word) e il tipo (data-kind):
//   asm / bin: scritta come istruzione (assembly o binario)   num: dato   err: testo non valido
function cellEl(i) { return document.getElementById("M" + i); }

function setCellText(el, text) {
    const t = String(text).trim();
    const plain = t.replace(/\s+/g, "");
    let kind, word = 0, error = null;
    if (t === "") {
        kind = "num";
    } else if (/^[01]{16}$/.test(plain)) {
        kind = "bin"; word = parseInt(plain, 2);
    } else if (prevNumberBase === 10 && /^[+-]?\d+$/.test(plain)) {
        const n = parseInt(plain, 10);
        if (n < -32768 || n > 32767) { kind = "err"; error = "Un dato deve stare tra -32768 e 32767"; }
        else { kind = "num"; word = n & 0xFFFF; }
    } else if (prevNumberBase === 2 && /^[01]{1,15}$/.test(plain)) {
        kind = "num"; word = parseInt(plain, 2);
    } else {
        const r = assemble(t);
        if (r.error) { kind = "err"; error = r.error; }
        else { kind = "asm"; word = r.word; }
    }
    el.dataset.kind = kind;
    el.dataset.word = String(word);
    el.dataset.error = error || "";
    renderCell(el, kind === "err" ? t : null);
}

function setCellValue(el, n) {           // scrittura di un dato (STORE)
    el.dataset.kind = "num";
    el.dataset.word = String(n & 0xFFFF);
    el.dataset.error = "";
    renderCell(el);
}

function cellWord(el) { return parseInt(el.dataset.word || "0", 10) & 0xFFFF; }

function renderCell(el, rawText) {
    const kind = el.dataset.kind || "num";
    const w = cellWord(el);
    el.classList.toggle("cell-invalid", kind === "err");
    if (kind === "err") {
        if (rawText !== null && rawText !== undefined) el.value = rawText;
        el.title = el.dataset.error;
        return;
    }
    const ins = decode(w);
    if (kind === "num") el.value = formatVal(w);
    else if (document.getElementById("memView").value === "bin") el.value = binGroups(w);
    else el.value = ins ? ins.text : binGroups(w);
    el.title = binGroups(w) + (ins ? "  =  " + ins.text : "") + "  (dato: " + toSigned(w) + ")";
}

function renderAllCells() {
    if (!with_instr) return;
    for (let i = 0; i < MEM_WORDS; i++) renderCell(cellEl(i));
    const ir = document.getElementById("IR");
    if (ir.dataset.word !== undefined && ir.value !== "") showIR(parseInt(ir.dataset.word, 10));
}

for (let i = 0; i < MEM_WORDS; i++) {
    const el = cellEl(i);
    el.dataset.kind = "num";
    el.dataset.word = "0";
    el.addEventListener("change", () => { if (with_instr) setCellText(el, el.value); });
}

// ---------- bus della versione Istruzioni ----------
//   indirizzi: dal PC (prelievo) o dall'IR (LOAD/STORE) al registro "Indirizzo" della RAM
//   istruzioni: dalla cella letta, lungo il bus della memoria, fino all'IR
function cuRects(g) {
    return {
        cu: rel(document.getElementById("cu_panel"), g.o),
        ram: rel(document.getElementById("ram_panel"), g.o),
        mar: rel(document.getElementById("MAR"), g.o),
        pc: rel(document.getElementById("PC"), g.o),
        ir: rel(document.getElementById("IR"), g.o)
    };
}

function addrY(g, c) {
    return g.desktop ? c.cu.bottom + (c.ram.top - c.cu.bottom) * 0.62
                     : c.ram.bottom + (c.cu.top - c.ram.bottom) * 0.62;
}

function routeAddr(srcId) {
    return function (_s, _e, g) {
        const c = cuRects(g), y = addrY(g, c);
        // dall'IR l'indirizzo esce dalla parte finale dell'istruzione (i bit MMMMM)
        const s = srcId === "ir" ? {cx: c.ir.right - (c.ir.right - c.ir.left) * 0.15, top: c.ir.top, bottom: c.ir.bottom} : c[srcId];
        if (g.desktop) {
            return {
                geo: g, horizontal: true, tip: {x: c.mar.cx, y: c.mar.top}, dir: "down", labelAt: NO_LABEL,
                d: `M${s.cx},${s.bottom} V${y} H${c.mar.cx} V${c.mar.top - ARROW}`,
                valueAt: {x: (s.cx + c.mar.cx) / 2, y}
            };
        }
        return {
            geo: g, horizontal: true, tip: {x: c.mar.cx, y: c.mar.bottom}, dir: "up", labelAt: NO_LABEL,
            d: `M${s.cx},${s.top} V${y} H${c.mar.cx} V${c.mar.bottom + ARROW}`,
            valueAt: {x: (s.cx + c.mar.cx) / 2, y}
        };
    };
}

// percorso nella RAM: dalla cella fino al bus verticale (Mx)
function cellToBus(row, g) {
    const m = g.mem, i = +row.id.slice(1, -4);
    const f = rel(document.getElementById("M" + i), g.o);
    const s = rel(document.getElementById("SW_M" + i), g.o);
    const sw = s.right - s.left;
    let d = `M${f.right},${s.cy} H${s.left + sw * 0.1} M${s.left + sw * 0.9},${s.cy} `;
    d += (m.twoCols && i < 16) ? `H${m.Mx1} V${m.yJoin} H${m.Mx}` : `H${m.Mx}`;
    return d;
}

function routeIR(row, _e, g) {
    const m = g.mem, c = cuRects(g);
    if (!m) return {geo: g, d: "", tip: null, labelAt: NO_LABEL, valueAt: NO_LABEL};
    let d;
    if (g.desktop) {
        d = (row ? cellToBus(row, g) + ` V${m.ym}` : `M${m.Mx},${m.ym}`) + ` H${m.Q} V${c.ir.cy} H${c.ir.right + ARROW}`;
    } else {
        d = (row ? cellToBus(row, g) : `M${m.Mx},${m.rowN}`) + ` V${c.ir.cy} H${c.ir.right + ARROW}`;
    }
    return {
        geo: g, horizontal: true, tip: {x: c.ir.right, y: c.ir.cy}, dir: "left", labelAt: NO_LABEL, d,
        valueAt: g.desktop ? {x: m.Q, y: (c.cu.bottom + c.ram.top) / 2} : {x: m.Mx, y: c.ram.bottom + (c.cu.top - c.ram.bottom) * 0.45}
    };
}

const busAddrPC = new Bus("", null, null, routeAddr("pc"));
const busAddrIR = new Bus("", null, null, routeAddr("ir"));
const busIR = new Bus("", null, null, routeIR);
busIR.switches = () => busIR.start ? ["SW_M" + busIR.start.id.slice(1, -4)] : [];
const instr_buses = [busAddrPC, busAddrIR, busIR];
instr_buses.forEach(b => { b.setVisible(false); ram_buses.push(b); });

// ---------- comandi automatici ----------
function setSw(id, on) { document.getElementById(id).setAttribute("aria-pressed", on ? "true" : "false"); }

function selectCell(i) {                 // il decoder (ora automatico) collega solo la cella i
    for (let k = 0; k < ramCells(); k++) {
        const on = k === i;
        setSw("SW_M" + k, on);
        document.getElementById("M" + k + "_row").classList.toggle("connected", on);
    }
}

function setControls(sw) {
    setSw("sw_alu", !!sw.alu);
    setSw("sw_reg", !!sw.reg);
    setSw("sw_read", !!sw.read);
    setSw("sw_write", !!sw.write);
}

function setPhase(text) { document.getElementById("cu_phase").textContent = text; }

function showIR(word) {
    const ir = document.getElementById("IR");
    const ins = decode(word);
    ir.dataset.word = String(word);
    ir.value = document.getElementById("memView").value === "bin" || !ins ? binGroups(word) : ins.text;
    ir.title = binGroups(word) + (ins ? "  =  " + ins.text : "");
}

function setFlags(result) {
    document.getElementById("flag_Z").checked = result === 0;
    document.getElementById("flag_N").checked = result < 0;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function stepTime() { return [16000, 8000, 4000, 2000, 1000][document.getElementById("speed").selectedIndex]; }
const blink = (els, vals, t) => registersAnimation(els, vals, t);
const flow = (buses, vals, t) => busesAnimation(buses, vals, stopBusesAnimation, t);

function aluCompute(a, b, op) {
    switch (op) {
        case 0: return toSigned(a + b);
        case 1: return toSigned(a - b);
        case 2: return toSigned(a & b);
        default: return toSigned(a | b);
    }
}

// indirizzo verso la RAM: dal PC (prelievo) o dal campo indirizzo dell'IR (LOAD/STORE)
async function sendAddress(bus, addr, t) {
    await flow([bus], [addr], t);
    const mar = document.getElementById("MAR");
    mar.value = String(addr);
    await blink([mar], null, t);
    selectCell(addr);
}

// registri -> Bus A, Bus B -> ALU: restituisce il risultato (e aggiorna i flag)
async function aluPart(x, y, op, t) {
    const rx = document.getElementById("R" + x), ry = document.getElementById("R" + y);
    await blink(x === y ? [rx] : [rx, ry], null, t);
    await flow([bus_lines[0], bus_lines[1]], [rx.value, ry.value], t);
    const a = parseVal(rx.value), b = parseVal(ry.value);
    await blink([document.getElementById("ALU_A"), document.getElementById("ALU_B")], [formatVal(a), formatVal(b)], t);
    const c = aluCompute(a, b, op);
    setFlags(c);
    await blink([document.getElementById("ALU_C")], [formatVal(c)], t);
    return c;
}

// ---------- ciclo di un'istruzione ----------
// restituisce "ok", "halt" oppure "error"
async function runInstruction() {
    const t = stepTime(), slow = t * MEM_SLOWDOWN, desktop = DESKTOP.matches;
    const pcEl = document.getElementById("PC");
    const pc = parseInt(pcEl.value, 10);
    showMessage("");
    if (isNaN(pc) || pc < 0 || pc >= MEM_WORDS) {
        showMessage(`Il PC vale «${pcEl.value}»: non è un indirizzo di memoria (0-${MEM_WORDS - 1}). Premi Reset.`, "err");
        return "error";
    }

    // 1. prelievo (fetch): PC -> indirizzo, cella -> IR, PC + 1
    setPhase("prelievo (fetch)");
    setControls({});
    await blink([pcEl], null, t);
    await sendAddress(busAddrPC, pc, t);
    const cell = cellEl(pc);
    if (cell.dataset.kind === "err") {
        showMessage(`La cella ${pc} contiene «${cell.value}»: ${cell.dataset.error}.`, "err");
        selectCell(-1);
        return "error";
    }
    setMemBusy(true, [busIR]);
    await blink([cell], null, slow);
    busIR.start = document.getElementById("M" + pc + "_row");
    const word = cellWord(cell);
    const ins = decode(word);
    await flow([busIR], [ins ? ins.text : binGroups(word)], slow);
    setMemBusy(false);
    busIR.start = null;
    selectCell(-1);
    showIR(word);
    await blink([document.getElementById("IR")], null, t);
    pcEl.value = String(pc + 1);
    await blink([pcEl], null, t);

    // 2. decodifica: l'unità di controllo gira rotelle e interruttori
    setPhase("decodifica");
    if (!ins) {
        showMessage(`La cella ${pc} contiene ${binGroups(word)}: non è un'istruzione valida.`, "err");
        return "error";
    }
    const knob = (name, r) => setKnob("sreg", name, r);
    switch (ins.op) {
        case "ADD": case "SUB": case "AND": case "OR":
            knob("AAddr", ins.x); knob("BAddr", ins.y); knob("CAddr", ins.d);
            setKnob("salu4", "ALU", ALU_OPS[ins.op]);
            setControls({alu: true, reg: true});
            break;
        case "MOVE":                       // R1 = R2 AND R2
            knob("AAddr", ins.s); knob("BAddr", ins.s); knob("CAddr", ins.d);
            setKnob("salu4", "ALU", ALU_OPS.AND);
            setControls({alu: true, reg: true});
            break;
        case "STORE":                      // il valore passa dall'ALU: R AND R
            knob("AAddr", ins.r); knob("BAddr", ins.r);
            setKnob("salu4", "ALU", ALU_OPS.AND);
            setControls({alu: true, write: true});
            break;
        case "LOAD":
            knob("CAddr", ins.r);
            setControls({read: true, reg: true});
            break;
        default:
            setControls({});
    }
    await sleep(t);

    // 3. esecuzione
    setPhase("esecuzione");
    const C_reg = () => document.getElementById("R" + getKnobSetting("CAddr"));
    switch (ins.op) {
        case "ADD": case "SUB": case "AND": case "OR": case "MOVE": {
            const x = ins.op === "MOVE" ? ins.s : ins.x, y = ins.op === "MOVE" ? ins.s : ins.y;
            const c = await aluPart(x, y, ins.op === "MOVE" ? ALU_OPS.AND : ALU_OPS[ins.op], t);
            const v = formatVal(c);
            memWriting = false;
            const path = desktop ? [busCAlu, busCLow, busCUp] : [busCAlu, busCUp];
            await flow(path, path.map(b => b === busCUp ? v : null), t);
            await blink([C_reg()], [v], t);
            break;
        }
        case "STORE": {
            const c = await aluPart(ins.r, ins.r, ALU_OPS.AND, t);
            await sendAddress(busAddrIR, ins.m, t);
            const target = cellEl(ins.m);
            memWriting = true;
            busMem.start = document.getElementById("M" + ins.m + "_row");
            setMemBusy(true, [busMem, busWrite]);
            const path = [busCAlu, busCLow, busWrite, busMem];
            await flow(path, path.map(b => b === busMem ? formatVal(c) : null), slow);
            setCellValue(target, c);
            await blink([target], null, slow);
            setMemBusy(false);
            busMem.start = null; memWriting = false;
            selectCell(-1);
            break;
        }
        case "LOAD": {
            await sendAddress(busAddrIR, ins.m, t);
            const src = cellEl(ins.m);
            if (src.dataset.kind === "err") {
                showMessage(`La cella ${ins.m} contiene un testo non valido: ${src.dataset.error}.`, "err");
                selectCell(-1);
                return "error";
            }
            memReading = true;
            busMem.start = document.getElementById("M" + ins.m + "_row");
            setMemBusy(true, [busMem, busRead]);
            await blink([src], null, slow);
            const v = formatVal(toSigned(cellWord(src)));
            const path = desktop ? [busMem, busRead, busCUp] : [busMem, busRead, busCLow, busCUp];
            await flow(path, path.map(b => (b === busMem || b === busCUp) ? v : null), slow);
            setMemBusy(false);
            busMem.start = null; memReading = false;
            selectCell(-1);
            await blink([C_reg()], [v], t);
            break;
        }
        case "BRANCH": case "BZERO": case "BNEG": {
            const z = document.getElementById("flag_Z").checked, n = document.getElementById("flag_N").checked;
            const take = ins.op === "BRANCH" || (ins.op === "BZERO" && z) || (ins.op === "BNEG" && n);
            if (take) {
                pcEl.value = String(ins.m);
                await blink([pcEl], null, t);
            } else {
                showMessage(ins.op === "BZERO" ? "Il risultato dell'ALU non era zero: nessun salto."
                                               : "Il risultato dell'ALU non era negativo: nessun salto.", "info");
                await sleep(t);
            }
            break;
        }
        case "NOP":
            await sleep(t);
            break;
        case "HALT":
            setPhase("fermo (HALT)");
            showMessage("Programma terminato (HALT).", "info");
            return "halt";
    }
    setControls({});
    return "ok";
}

// ---------- pulsanti ----------
var cpuRunning = false, stopRequested = false;

function setRunning(on) {
    cpuRunning = on;
    change_enabled = !on;
    document.body.classList.toggle("cpu-running", on);
    document.getElementById("runButton").value = on ? "Ferma" : "Esegui";
    document.getElementById("stepButton").disabled = on;
    document.getElementById("resetButton").disabled = on;
    document.getElementById("exampleButton").disabled = on;
}

async function runProgram() {
    if (cpuRunning) { stopRequested = true; setPhase("si ferma dopo questa istruzione…"); return; }
    stopRequested = false;
    setRunning(true);
    let r = "ok";
    while (r === "ok" && !stopRequested) r = await runInstruction();
    if (r === "ok") setPhase("in pausa");
    setRunning(false);
}

async function stepProgram() {
    if (cpuRunning) return;
    setRunning(true);
    const r = await runInstruction();
    if (r === "ok") setPhase("in pausa");
    setRunning(false);
}

function resetCPU() {
    if (cpuRunning) return;
    document.getElementById("PC").value = "0";
    const ir = document.getElementById("IR");
    ir.value = ""; ir.title = ""; delete ir.dataset.word;
    document.getElementById("MAR").value = "";
    document.getElementById("flag_Z").checked = false;
    document.getElementById("flag_N").checked = false;
    selectCell(-1);
    setControls({});
    ["AAddr", "BAddr", "CAddr"].forEach(k => setKnob("sreg", k, 0));
    setKnob("salu4", "ALU", 0);
    setPhase("pronta");
    showMessage("");
}

// programma di esempio: R3 = M[10] + M[11], poi M[12] = R3
const EXAMPLE = {0: "LOAD R1 10", 1: "LOAD R2 11", 2: "ADD R3 R1 R2", 3: "STORE 12 R3", 4: "HALT", 10: "120", 11: "10"};

function loadExample() {
    if (cpuRunning) return;
    for (let i = 0; i < MEM_WORDS; i++) {
        const v = EXAMPLE[i];
        const el = cellEl(i);
        if (v !== undefined && /^\d+$/.test(v)) setCellValue(el, +v);
        else setCellText(el, v || "0");
    }
    resetCPU();
}

var instrInitialized = false;

// chiamata da setVersion (index.js) a ogni cambio di versione
function instrVersionChanged() {
    instr_buses.forEach(b => b.setVisible(with_instr));
    if (with_instr) {
        if (!instrInitialized) { instrInitialized = true; loadExample(); }
        else { renderAllCells(); resetCPU(); }
    } else {
        // si torna ai comandi manuali: interruttori nella posizione iniziale
        selectCell(-1);
        setControls({alu: true, reg: true});
        ["AAddr", "BAddr", "CAddr"].forEach(k => setKnob("sreg", k, 0));
        for (let i = 0; i < MEM_WORDS; i++) {
            const el = cellEl(i);
            if (el.dataset.kind !== "num") setCellValue(el, 0);
            el.classList.remove("cell-invalid");
        }
    }
}

// la versione può essere già "Istruzioni" al caricamento (scelta ricordata o ?versione=instr)
if (with_instr) { instrVersionChanged(); redrawBuses(); }
