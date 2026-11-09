// ************************************************************
// Bus del percorso dati
//
// I bus sono disegnati in un SVG sovrapposto (#bus_layer) con percorsi
// ortogonali calcolati a partire dalla posizione degli elementi.
// Le corsie dei bus stanno nei margini laterali di #datapath, quindi la
// forma dei collegamenti è la stessa su computer e su telefono.
//   Bus A, Bus B: dal registro selezionato (lato destro) agli ingressi dell'ALU
//   Bus C:        dall'uscita dell'ALU (lato sinistro) al registro selezionato
// Ogni bus ha le proprietà start/end e il metodo setOptions, come prima.
// ************************************************************
const SVG_NS = "http://www.w3.org/2000/svg";
// Computer (>= 1000px): rotelle accanto ai registri, corsie dei bus interne ai pannelli
const DESKTOP = window.matchMedia("(min-width: 1000px)");
var ARROW = 9; // lunghezza della punta di freccia (più grande sul computer)

function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
}

class Bus {
    constructor(name, start, end, route) {
        this.name = name;
        this._start = start;
        this._end = end;
        this.route = route;      // funzione che calcola il percorso
        this.value = null;       // valore mostrato durante l'animazione
        this.g = svgEl("g", {class: "bus"}, document.getElementById("bus_layer"));
        this.line = svgEl("path", {class: "bus-line"}, this.g);
        this.arrow = svgEl("path", {class: "bus-arrow"}, this.g);
        this.labelBg = svgEl("rect", {class: "bus-name-bg"}, this.g);
        this.label = svgEl("text", {class: "bus-name", "text-anchor": "middle", "dominant-baseline": "central"}, this.g);
        this.label.textContent = name;
        if (!name) { this.label.style.display = "none"; this.labelBg.style.display = "none"; }
        this.visible = true;
        this.switches = [];      // id degli interruttori su questo tratto (si colorano durante l'animazione)
        this.pill = svgEl("g", {class: "bus-value", visibility: "hidden"}, this.g);
        this.pillRect = svgEl("rect", {rx: 6, ry: 6}, this.pill);
        this.pillText = svgEl("text", {"text-anchor": "middle", "dominant-baseline": "central"}, this.pill);
    }

    get start() { return this._start; }
    set start(el) { this._start = el; this.position(); }
    get end() { return this._end; }
    set end(el) { this._end = el; this.position(); }

    // opts.active: true/false (bus evidenziato e animato)
    // opts.value:  testo da mostrare sul bus, oppure null per nasconderlo
    setOptions(opts) {
        if ("active" in opts) {
            this.g.classList.toggle("active", !!opts.active);
            const ids = typeof this.switches === "function" ? this.switches() : this.switches;
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle("active", !!opts.active);
            });
        }
        if ("value" in opts) this.value = opts.value;
        this.position();
    }

    setVisible(v) {
        this.visible = v;
        this.g.style.display = v ? "" : "none";
    }

    position() {
        if (!this.visible) return;
        const r = this.route(this._start, this._end, geometry());
        this.line.setAttribute("d", r.d);
        this.arrow.setAttribute("d", arrowHead(r.tip, r.dir));
        this.label.setAttribute("x", r.labelAt.x);
        this.label.setAttribute("y", r.labelAt.y);
        const rot = r.horizontal ? "" : "rotate(-90 " + r.labelAt.x + " " + r.labelAt.y + ")";
        this.label.setAttribute("transform", rot);
        // sfondo bianco dietro il nome, così la linea non attraversa la scritta
        const lb = this.label.getBBox();
        this.labelBg.setAttribute("x", lb.x - 2);
        this.labelBg.setAttribute("y", lb.y);
        this.labelBg.setAttribute("width", lb.width + 4);
        this.labelBg.setAttribute("height", lb.height);
        this.labelBg.setAttribute("transform", rot);
        this.placeValue(r.valueAt, r.geo);
    }

    placeValue(at, geo) {
        if (this.value === null || this.value === undefined || this.value === "") {
            this.pill.setAttribute("visibility", "hidden");
            return;
        }
        this.pillText.textContent = String(this.value);
        this.pill.setAttribute("visibility", "visible");
        const tb = this.pillText.getBBox();
        const w = tb.width + 14, h = tb.height + 6;
        // il valore resta dentro l'area del percorso dati
        const x = Math.min(Math.max(at.x, w / 2 + 2), geo.width - w / 2 - 2);
        this.pillText.setAttribute("x", x);
        this.pillText.setAttribute("y", at.y);
        this.pillRect.setAttribute("x", x - w / 2);
        this.pillRect.setAttribute("y", at.y - h / 2);
        this.pillRect.setAttribute("width", w);
        this.pillRect.setAttribute("height", h);
    }
}

// Rettangolo di un elemento in coordinate relative a #datapath
function rel(el, origin) {
    const r = el.getBoundingClientRect();
    return {left: r.left - origin.left, right: r.right - origin.left,
            top: r.top - origin.top, bottom: r.bottom - origin.top,
            cx: (r.left + r.right) / 2 - origin.left, cy: (r.top + r.bottom) / 2 - origin.top};
}

// Misure comuni a tutti i bus: bordi dei pannelli e posizione delle corsie
function geometry() {
    const dp = document.getElementById("datapath");
    const o = dp.getBoundingClientRect();
    const reg = rel(document.getElementById("reg_panel"), o);
    const alu = rel(document.getElementById("alu_panel"), o);
    const gutterR = o.width - reg.right;
    const gutterL = reg.left;
    // sul computer la punta di freccia segue la grandezza della pagina (--u = 1% dell'altezza)
    ARROW = DESKTOP.matches ? Math.max(10, 1.6 * Math.min(window.innerHeight * 0.011, window.innerWidth * 0.0068)) : 9;
    let laneA = reg.right + gutterR * 0.30,
        laneB = reg.right + gutterR * 0.62,
        laneC = gutterL * 0.5;
    const lc = document.getElementById("lane_C"), lab = document.getElementById("lane_AB");
    if (lc && lc.offsetParent) {   // corsie interne visibili (layout computer)
        const c = rel(lc, o), ab = rel(lab, o);
        laneC = c.cx;
        laneA = ab.left + (ab.right - ab.left) * 0.30;
        laneB = ab.left + (ab.right - ab.left) * 0.70;
    }
    const gapY = (reg.bottom + alu.top) / 2;
    const gap = alu.top - reg.bottom;
    const yC = reg.bottom + gap * 0.22;
    const mem = with_memory ? memGeometry(o, reg, alu, gutterL, laneC, yC, gapY) : null;
    return {
        o, reg, alu, width: o.width, mem,
        desktop: DESKTOP.matches,
        gutterX: mem ? mem.gx : gutterL * 0.5,  // Bus C nel margine sinistro
        yC,                                     // tratti orizzontali tra i pannelli (computer)
        yA: reg.bottom + gap * 0.50,
        yB: reg.bottom + gap * 0.78,
        laneA, laneB, laneC,
        gapY,                                              // valori A, B e C: tra i due pannelli
        // nomi dei bus: tutti alla stessa altezza
        nameY: rel(document.getElementById("ALU_A_col"), o).top - 56
    };
}

function arrowHead(tip, dir) {
    if (!tip) return "";          // tratto di bus senza freccia
    const w = ARROW * 0.6;
    const {x, y} = tip;
    switch (dir) {
        case "down":  return `M${x},${y} L${x - w},${y - ARROW} L${x + w},${y - ARROW} Z`;
        case "up":    return `M${x},${y} L${x - w},${y + ARROW} L${x + w},${y + ARROW} Z`;
        case "left":  return `M${x},${y} L${x + ARROW},${y - w} L${x + ARROW},${y + w} Z`;
        default:      return `M${x},${y} L${x - ARROW},${y - w} L${x - ARROW},${y + w} Z`;
    }
}

// Bus A: registro (lato destro) -> corsia A -> scende fin sopra i campi dell'ALU ->
//        a sinistra fino al centro del campo A -> giù, sul bordo superiore del campo A.
// Il Bus A gira più in alto del Bus B, così i due bus non si incrociano nell'ALU.
function routeA(regRow, target, g) {
    const s = rel(regRow, g.o), t = rel(target, g.o);
    if (g.desktop) {
        // computer: corsia A nei registri -> tra i pannelli verso sinistra -> giù nel campo A
        return {
            geo: g, horizontal: true,
            d: `M${s.right},${s.cy} H${g.laneA} V${g.yA} H${t.cx} V${t.top - ARROW}`,
            tip: {x: t.cx, y: t.top}, dir: "down",
            labelAt: {x: (g.laneA + t.cx) / 2, y: g.yA},
            valueAt: {x: (g.laneA + t.cx) / 2, y: g.yA}
        };
    }
    const yTurn = t.top - 28;
    return {
        geo: g,
        d: `M${s.right},${s.cy} H${g.laneA} V${yTurn} H${t.cx} V${t.top - ARROW}`,
        tip: {x: t.cx, y: t.top}, dir: "down",
        labelAt: {x: g.laneA, y: g.nameY},
        valueAt: {x: (g.laneA + t.cx) / 2, y: yTurn}
    };
}

// Bus B: registro (lato destro) -> corsia B -> a sinistra fino al centro del campo B ->
//        giù, sul bordo superiore del campo B.
// Se incrocia la corsia del Bus A (vicino ai registri) disegna un piccolo "salto".
function routeB(regRow, target, g) {
    const s = rel(regRow, g.o), t = rel(target, g.o);
    const aRow = rel(bus_lines[0].start, g.o);
    const yTurn = t.top - 13;
    let first = `H${g.laneB}`;
    if (s.cy > aRow.cy + 1) {
        const r = 5;
        first = `H${g.laneA - r} a${r},${r} 0 0 1 ${2 * r},0 H${g.laneB}`;
    }
    if (g.desktop) {
        // computer: corsia B nei registri -> tra i pannelli fino sopra il campo B -> giù
        return {
            geo: g, horizontal: true,
            d: `M${s.right},${s.cy} ${first} V${g.yB} H${t.cx} V${t.top - ARROW}`,
            tip: {x: t.cx, y: t.top}, dir: "down",
            labelAt: {x: (g.laneB + t.cx) / 2, y: g.yB},
            valueAt: {x: (g.laneB + t.cx) / 2, y: g.yB}
        };
    }
    return {
        geo: g,
        d: `M${s.right},${s.cy} ${first} V${yTurn} H${t.cx} V${t.top - ARROW}`,
        tip: {x: t.cx, y: t.top}, dir: "down",
        labelAt: {x: g.laneB, y: g.nameY},
        valueAt: {x: g.laneB, y: g.gapY}
    };
}

// Bus C: uscita ALU (lato sinistro) -> corsia C -> entra nel registro da sinistra
function routeC(source, regRow, g) {
    const s = rel(source, g.o), t = rel(regRow, g.o);
    if (g.desktop) {
        // computer: margine sinistro -> tra i pannelli verso destra -> corsia C nei registri
        return {
            geo: g,
            d: `M${s.left},${s.cy} H${g.gutterX} V${g.yC} H${g.laneC} V${t.cy} H${t.left - ARROW}`,
            tip: {x: t.left, y: t.cy}, dir: "right",
            labelAt: {x: g.gutterX, y: (g.yC + s.cy) / 2},
            valueAt: {x: g.gutterX, y: (g.yC + s.cy) / 2}
        };
    }
    return {
        geo: g,
        d: `M${s.left},${s.cy} H${g.laneC} V${t.cy} H${t.left - ARROW}`,
        tip: {x: t.left, y: t.cy}, dir: "right",
        labelAt: {x: g.laneC, y: g.nameY},
        valueAt: {x: g.laneC, y: g.gapY}
    };
}

var bus_lines = [];
bus_lines.push(new Bus("BUS A", document.getElementById("R0_row"), document.getElementById("ALU_A"), routeA));
bus_lines.push(new Bus("BUS B", document.getElementById("R0_row"), document.getElementById("ALU_B"), routeB));
bus_lines.push(new Bus("BUS C", document.getElementById("ALU_C_row"), document.getElementById("R0_row"), routeC));

// ************************************************************
// Versione "Con memoria RAM"
//
// La memoria ha 16 celle; ognuna è collegata al bus della memoria da un
// interruttore: lo studente fa da decoder e chiude quello della cella giusta.
// Il bus della memoria si collega al Bus C con due interruttori:
//   «leggi»  memoria -> Bus C        «scrivi»  Bus C -> memoria
// Altri due interruttori decidono chi usa il Bus C:
//   «ALU»    uscita dell'ALU -> Bus C
//   «registri»  Bus C -> registro scelto dalla rotella C
// Il Bus C è diviso in tratti (Bus) che si accendono solo dove passa il dato.
// ************************************************************
var with_memory = false;
const RAM_SIZE = 32;          // 16 celle nella versione "Con memoria RAM", 32 nella versione "Istruzioni"
var with_instr = false;       // versione "Istruzioni": niente comandi manuali, decide l'unità di controllo
function ramCells() { return with_instr ? 32 : 16; }
var busCAlu = null, busCLow = null, busCUp = null, busRead = null, busWrite = null, busMem = null;
var ram_buses = [];
var memReading = false;     // durante una lettura il bus della memoria arriva solo al ramo «leggi»
var memWriting = false;     // durante una scrittura il Bus C scende solo fino al ramo «scrivi»
// La RAM è molto più lenta dei registri: ogni passo che usa la memoria dura MEM_SLOWDOWN volte
// un passo normale (nei computer veri la differenza è ancora più grande: decine o centinaia di cicli).
const MEM_SLOWDOWN = 3;

// interruttore: due contatti e una lama (aperta = inclinata, chiusa = dritta e verde)
function makeSwitch(id, label, title, pressed) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw";
    b.id = id;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    b.innerHTML = '<svg viewBox="0 0 30 16" aria-hidden="true">' +
        '<line class="blade-open" x1="3" y1="8" x2="23" y2="0.5"/>' +
        '<line class="blade-closed" x1="3" y1="8" x2="27" y2="8"/>' +
        '<circle cx="3" cy="8" r="2.6"/><circle cx="27" cy="8" r="2.6"/></svg>' +
        (label ? '<span class="sw-label">' + label + '</span>' : "");
    b.addEventListener("click", () => {
        if (!change_enabled || with_instr) return;   // durante l'esecuzione (o nella versione Istruzioni) non si cambia
        const on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", on ? "true" : "false");
        const row = b.closest(".ram-row");
        if (row) row.classList.toggle("connected", on);
        showMessage("");
    });
    return b;
}

function swOn(id) {
    return document.getElementById(id).getAttribute("aria-pressed") === "true";
}

function closedCells() {
    const r = [];
    for (let i = 0; i < ramCells(); i++) if (swOn("SW_M" + i)) r.push(i);
    return r;
}

function showMessage(text, kind) {
    const el = document.getElementById("dp_message");
    el.textContent = text || "";
    el.className = text ? kind : "";
}

// righe della RAM: indirizzo, valore, interruttore verso il bus della memoria
(function buildRam() {
    const box = document.getElementById("ram_cells");
    for (let i = 0; i < RAM_SIZE; i++) {
        const row = document.createElement("div");
        row.className = "ram-row" + (i >= 16 ? " ram-hi" : "");
        row.id = "M" + i + "_row";
        row.innerHTML = '<label for="M' + i + '">' + i + ':</label>' +
            '<input class="form-control" id="M' + i + '" type="text" value="0">';
        row.appendChild(makeSwitch("SW_M" + i, "", "Collega la cella " + i + " al bus della memoria", false));
        box.appendChild(row);
    }
    const sws = document.getElementById("dp_switches");
    sws.appendChild(makeSwitch("sw_alu", "ALU", "Uscita dell'ALU sul Bus C", true));
    sws.appendChild(makeSwitch("sw_reg", "registri", "Dal Bus C al registro scelto dalla rotella C", true));
    sws.appendChild(makeSwitch("sw_read", "leggi", "Leggi: dalla memoria al Bus C", false));
    sws.appendChild(makeSwitch("sw_write", "scrivi", "Scrivi: dal Bus C alla memoria", false));
})();

// Posizioni usate dai tratti della versione con RAM
//   gx: linea verticale del Bus C       Q: giunzione lato memoria
//   Mx: linea verticale del bus della memoria (dentro il pannello RAM)
//   yw / yr: rami «scrivi» / «leggi»    ym: tratto orizzontale del bus della memoria
//   J: punto in cui l'uscita dell'ALU arriva sul Bus C
function memGeometry(o, reg, alu, gutterL, laneC, yC, gapY) {
    const ramEl = document.getElementById("ram_panel");
    if (!ramEl.offsetParent) return null;
    const desktop = DESKTOP.matches;
    const ram = rel(ramEl, o);
    const cellSw = rel(document.getElementById("SW_M0"), o);
    const sw = document.getElementById("sw_read");
    const swW = sw.offsetWidth || 34, swH = sw.offsetHeight || 18;
    const L = swW * 0.8;                                  // distanza tra i due contatti
    const cRow = rel(document.getElementById("ALU_C_row"), o);
    const cLab = rel(document.getElementById("ALU_C_lab"), o);
    const n = ramCells();
    // versione Istruzioni sul computer: 32 celle in due colonne (0-15 e 16-31)
    const twoCols = with_instr && desktop;
    const rightSw = twoCols ? rel(document.getElementById("SW_M16"), o) : cellSw;
    const Mx = rightSw.right + (ram.right - rightSw.right) * 0.45;
    let Mx1 = Mx, yJoin = 0;
    const rowN = rel(document.getElementById("M" + (n - 1) + "_row"), o);
    if (twoCols) {
        const lab16 = rel(document.querySelector("#M16_row > label"), o);
        Mx1 = cellSw.right + (lab16.left - cellSw.right) * 0.5;
        yJoin = rowN.bottom + (ram.bottom - rowN.bottom) * 0.45;
    }
    let gx, Q, yw, yr, ym;
    if (desktop) {
        const zone = reg.left - ram.right;
        gx = reg.left - zone * 0.32;
        Q = ram.right + zone * 0.24;
        const d = Math.max(swH * 2.6, 24);
        yr = alu.top + (alu.bottom - alu.top) * 0.30;   // «leggi» sopra, «scrivi» sotto
        yw = yr + d;
        ym = yw + d;
    } else {
        gx = gutterL * 0.5;
        Q = gx + Math.max(84, swW * 2.6);
        const g2 = ram.top - alu.bottom;
        yr = alu.bottom + g2 * 0.24;                    // «leggi» sopra, «scrivi» sotto
        yw = alu.bottom + g2 * 0.48;
        ym = alu.bottom + g2 * 0.86;
    }
    return {
        ram, Mx, Mx1, twoCols, yJoin, n, gx, Q, yw, yr, ym, L, swW, swH,
        swX: (gx + Q) / 2,
        J: cRow.cy,
        row0: rel(document.getElementById("M0_row"), o).cy,
        rowN: rowN.cy,
        aluSw: {x: (alu.left + cLab.left) / 2, y: cRow.cy},
        regSw: desktop ? {x: (gx + laneC) / 2, y: yC} : {x: gx, y: gapY, vertical: true}
    };
}

// fili fissi della RAM: da ogni cella al suo interruttore e poi al bus della memoria
function drawRamWires(g) {
    const layer = document.getElementById("bus_layer");
    let w = document.getElementById("ram_wires");
    if (!w) {
        w = svgEl("path", {id: "ram_wires", class: "bus-line"});
        layer.insertBefore(w, layer.firstChild);
    }
    const m = g.mem;
    if (!m) { w.setAttribute("d", ""); return; }
    let d = "";
    for (let i = 0; i < m.n; i++) {
        const f = rel(document.getElementById("M" + i), g.o);
        const s = rel(document.getElementById("SW_M" + i), g.o);
        const sw = s.right - s.left;
        const bx = (m.twoCols && i < 16) ? m.Mx1 : m.Mx;
        d += `M${f.right},${s.cy} H${s.left + sw * 0.1} M${s.left + sw * 0.9},${s.cy} H${bx} `;
    }
    if (m.twoCols) {
        d += `M${m.Mx1},${m.row0} V${m.yJoin} H${m.Mx} `;
        d += `M${m.Mx},${Math.min(m.row0, m.ym)} V${Math.max(m.yJoin, m.ym)}`;
    } else {
        d += `M${m.Mx},${Math.min(m.row0, m.ym)} V${Math.max(m.rowN, m.ym)}`;
    }
    d += ` M${m.Mx},${m.ym} H${m.Q} V${m.yr}`;          // fino ai rami «scrivi» e «leggi»
    drawBoundary(g);
    w.setAttribute("d", d);
}

// Linea di separazione tra CPU e RAM (il bus della memoria la attraversa)
function drawBoundary(g) {
    const layer = document.getElementById("bus_layer");
    let line = document.getElementById("cpu_ram_line");
    if (!line) {
        line = svgEl("path", {id: "cpu_ram_line", class: "cpu-ram-line"});
        layer.insertBefore(line, layer.firstChild);
        svgEl("text", {id: "lbl_cpu", class: "cpu-ram-label"}, layer).textContent = "CPU";
        svgEl("text", {id: "lbl_ram", class: "cpu-ram-label"}, layer).textContent = "RAM";
    }
    const m = g.mem, cpu = document.getElementById("lbl_cpu"), ram = document.getElementById("lbl_ram");
    const set = (el, attrs) => { for (const k in attrs) el.setAttribute(k, attrs[k]); };
    let cpu2 = document.getElementById("lbl_cpu2");
    if (!cpu2) {
        cpu2 = svgEl("text", {id: "lbl_cpu2", class: "cpu-ram-label"}, layer);
        cpu2.textContent = "CPU";
    }
    set(cpu2, {visibility: "hidden"});
    const cu = with_instr ? rel(document.getElementById("cu_panel"), g.o) : null;
    if (g.desktop) {
        const x = m.ram.right + (m.Q - m.ram.right) * 0.5;
        if (cu) {
            // versione Istruzioni: l'unità di controllo (CPU) sta sopra la RAM
            const y = cu.bottom + (m.ram.top - cu.bottom) * 0.25;
            line.setAttribute("d", `M0,${y} H${x} V${g.o.height}`);
            set(cpu, {x: 4, y: y - 4, "text-anchor": "start", "dominant-baseline": "auto", visibility: "visible"});
            set(ram, {x: 4, y: y + 4, "text-anchor": "start", "dominant-baseline": "hanging", visibility: "visible"});
        } else {
            line.setAttribute("d", `M${x},0 V${g.o.height}`);
            // "Memoria RAM" è già scritto sul pannello: qui basta indicare il lato della CPU
            set(ram, {x: x - 8, y: 4, "text-anchor": "end", "dominant-baseline": "hanging", visibility: "hidden"});
            set(cpu, {x: x + 8, y: 4, "text-anchor": "start", "dominant-baseline": "hanging", visibility: "visible"});
        }
    } else {
        const y = (m.yw + m.ym) / 2;
        let d = `M0,${y} H${g.o.width}`;
        set(cpu, {x: g.o.width - 4, y: y - 4, "text-anchor": "end", "dominant-baseline": "auto", visibility: "visible"});
        set(ram, {x: g.o.width - 4, y: y + 4, "text-anchor": "end", "dominant-baseline": "hanging", visibility: "visible"});
        if (cu) {
            // versione Istruzioni: l'unità di controllo (CPU) sta sotto la RAM
            const y2 = m.ram.bottom + (cu.top - m.ram.bottom) * 0.28;
            d += ` M0,${y2} H${g.o.width}`;
            set(cpu2, {x: g.o.width - 4, y: y2 + 4, "text-anchor": "end", "dominant-baseline": "hanging", visibility: "visible"});
        }
        line.setAttribute("d", d);
    }
}

// RAM occupata: il pannello lo segnala e i tratti della memoria si animano più lentamente
function setMemBusy(on, buses) {
    document.getElementById("ram_panel").classList.toggle("busy", on);
    (buses || [busMem, busRead, busWrite]).forEach(b => b.g.classList.toggle("slow", on));
}

function placeSwitches(g) {
    const m = g.mem;
    if (!m) return;
    const put = (id, p, vertical, below) => {
        const el = document.getElementById(id);
        el.style.left = p.x + "px";
        el.style.top = p.y + "px";
        el.classList.toggle("vertical", !!vertical);
        el.classList.toggle("label-below", !!below);
    };
    put("sw_alu", m.aluSw);
    put("sw_reg", m.regSw, m.regSw.vertical, g.desktop);
    put("sw_read", {x: m.swX, y: m.yr});
    put("sw_write", {x: m.swX, y: m.yw});
}

const NO_LABEL = {x: 0, y: 0};

// uscita dell'ALU -> interruttore «ALU» -> Bus C
function routeCAlu(src, _e, g) {
    const m = g.mem, s = rel(src, g.o), a = m.aluSw, L = m.L;
    return {
        geo: g, horizontal: true, tip: null, labelAt: NO_LABEL,
        d: `M${s.left},${s.cy} H${a.x + L / 2} M${a.x - L / 2},${s.cy} H${m.gx}`,
        valueAt: {x: (s.left + a.x + L / 2) / 2, y: s.cy}
    };
}

// tratto del Bus C tra l'uscita dell'ALU e i rami della memoria
function routeCLow(_s, _e, g) {
    const m = g.mem, yEnd = memWriting ? m.yw : m.yr;
    return {
        geo: g, horizontal: true, tip: null, labelAt: NO_LABEL,
        d: `M${m.gx},${m.J} V${yEnd}`,
        valueAt: {x: m.gx, y: (m.J + yEnd) / 2}
    };
}

// Bus C verso i registri, attraverso l'interruttore «registri»
function routeCUp(_s, regRow, g) {
    const m = g.mem, t = rel(regRow, g.o), L = m.L, r = m.regSw;
    if (g.desktop) {
        return {
            geo: g, tip: {x: t.left, y: t.cy}, dir: "right",
            d: `M${m.gx},${m.yr} V${g.yC} H${r.x - L / 2} M${r.x + L / 2},${g.yC} H${g.laneC} V${t.cy} H${t.left - ARROW}`,
            labelAt: {x: m.gx, y: (g.yC + m.yw) / 2},
            valueAt: {x: m.gx, y: (g.yC + m.yw) / 2}
        };
    }
    return {
        geo: g, tip: {x: t.left, y: t.cy}, dir: "right",
        d: `M${m.gx},${m.J} V${r.y + L / 2} M${m.gx},${r.y - L / 2} V${t.cy} H${t.left - ARROW}`,
        labelAt: {x: m.gx, y: g.nameY},
        valueAt: {x: m.gx, y: (m.J + r.y) / 2}
    };
}

// ramo «leggi»: dal bus della memoria al Bus C
// (sul computer la memoria sta a sinistra del Bus C, sul telefono a destra)
function routeRead(_s, _e, g) {
    const m = g.mem, L = m.L, s = m.Q < m.gx ? 1 : -1;
    return {
        geo: g, horizontal: true, tip: {x: m.gx, y: m.yr}, dir: s > 0 ? "right" : "left", labelAt: NO_LABEL,
        d: `M${m.Q},${m.yr} H${m.swX - s * L / 2} M${m.swX + s * L / 2},${m.yr} H${m.gx - s * ARROW}`,
        valueAt: {x: m.swX, y: m.yr}
    };
}

// ramo «scrivi»: dal Bus C al bus della memoria
function routeWrite(_s, _e, g) {
    const m = g.mem, L = m.L, s = m.Q < m.gx ? 1 : -1;
    return {
        geo: g, horizontal: true, tip: {x: m.Q, y: m.yw}, dir: s > 0 ? "left" : "right", labelAt: NO_LABEL,
        d: `M${m.gx},${m.yw} H${m.swX + s * L / 2} M${m.swX - s * L / 2},${m.yw} H${m.Q + s * ARROW}`,
        valueAt: {x: m.swX, y: m.yw}
    };
}

// bus della memoria: dalla cella collegata (se c'è) fino alla giunzione con i rami
function routeMem(row, _e, g) {
    const m = g.mem;
    let d = `M${m.Mx},${m.ym}`;
    if (row) {
        const i = row.id.slice(1, -4);
        const f = rel(document.getElementById("M" + i), g.o);
        const s = rel(document.getElementById("SW_M" + i), g.o);
        const sw = s.right - s.left;
        d = (m.twoCols && +i < 16)
            ? `M${f.right},${s.cy} H${s.left + sw * 0.1} M${s.left + sw * 0.9},${s.cy} H${m.Mx1} V${m.yJoin} H${m.Mx} V${m.ym}`
            : `M${f.right},${s.cy} H${s.left + sw * 0.1} M${s.left + sw * 0.9},${s.cy} H${m.Mx} V${m.ym}`;
    }
    d += ` H${m.Q} V${memReading ? m.yr : m.yw}`;   // fino al ramo usato
    return {
        geo: g, horizontal: true, tip: null, labelAt: NO_LABEL, d,
        valueAt: g.desktop ? {x: (m.Q + m.gx) / 2, y: m.ym + m.swH * 1.8} : {x: (m.Mx + m.Q) / 2, y: m.ym}
    };
}

busCAlu = new Bus("", document.getElementById("ALU_C_row"), null, routeCAlu);
busCLow = new Bus("", null, null, routeCLow);
busCUp = new Bus("BUS C", null, document.getElementById("R0_row"), routeCUp);
busRead = new Bus("", null, null, routeRead);
busWrite = new Bus("", null, null, routeWrite);
busMem = new Bus("", null, null, routeMem);
busCAlu.switches = ["sw_alu"];
busCUp.switches = ["sw_reg"];
busRead.switches = ["sw_read"];
busWrite.switches = ["sw_write"];
busMem.switches = () => busMem.start ? ["SW_M" + busMem.start.id.slice(1, -4)] : [];
ram_buses = [busCAlu, busCLow, busCUp, busRead, busWrite, busMem];
ram_buses.forEach(b => b.setVisible(false));

// Cambio di versione (menu "Versione"); la scelta viene ricordata nel browser
function setVersion(v) {
    if (!["dp", "ram", "instr"].includes(v)) v = "dp";
    with_memory = v !== "dp";
    with_instr = v === "instr";
    document.body.classList.toggle("with-ram", with_memory);
    document.body.classList.toggle("with-instr", with_instr);
    document.getElementById("version").value = v;
    try { localStorage.setItem("dp_version", v); } catch (e) { /* non disponibile */ }
    // la rotella dell'ALU ha 2 posizioni (+, −) o 4 (+, −, AND, OR) nella versione Istruzioni
    setKnob(with_instr ? "salu4" : "salu", "ALU", 0);
    bus_lines[2].setVisible(!with_memory);
    ram_buses.forEach(b => b.setVisible(with_memory));
    const wires = document.getElementById("ram_wires");
    if (wires) wires.style.display = with_memory ? "" : "none";
    showMessage("");
    if (typeof instrVersionChanged === "function") instrVersionChanged();
    redrawBuses();
}

function redrawBuses() {
    bus_lines.forEach(b => b.position());
    if (with_memory) {
        const g = geometry();
        drawRamWires(g);
        placeSwitches(g);
        ram_buses.forEach(b => b.position());
    }
}
(function initialVersion() {
    let v = new URLSearchParams(location.search).get("versione");
    if (!v) { try { v = localStorage.getItem("dp_version"); } catch (e) { v = null; } }
    setVersion(v);
})();
window.addEventListener("resize", redrawBuses);
window.addEventListener("load", redrawBuses);
if (window.ResizeObserver)
    new ResizeObserver(redrawBuses).observe(document.getElementById("datapath"));
if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(redrawBuses);

var change_enabled = true;
var dashing = {
    is_dashing: false,
    buses: []
}
var micro_inst = 0;
let prevNumberBase = 10;
// with_memory: versione "Con memoria RAM" (vedi setVersion, più in basso)
var with_control = false; //completare!
var with_microprog = false; //completare!
var resume_here = null;

function executeCycle() {
    if (with_instr) { runProgram(); return; }   // versione Istruzioni: istruzioni.js
    var run_btn = document.getElementById("runButton");
//  document.runLight.src = "runLightGreen.gif";

    if (run_btn.value === "Esegui") {
        // run_btn.value = "Halt";

        if (change_enabled) {
            change_enabled = false;
            halt_cycle = false;
            micro_inst = 0;

            if (with_control) {
                resume_here = "startInstructionCycle();";
                startInstructionCycle();
            } else if (with_microprog) {
                resume_here = "setControls();";
                setControls();
            } else if (with_instr) {
                change_enabled = true;
                runProgram();
            } else if (with_memory) {
                resume_here = "runRam();";
                runRam();
            } else {
                resume_here = "loadABBusReg();";
                loadABBusReg();
            }
        }
    } else {
        run_btn.value = "Esegui";
        stopCycle();
    }
}


function startInstructionCycle() {
    // completare!
}

function setControls() {
    // completare!
}

function registersAnimation(registers, values, execTime) {
    return new Promise((resolve, reject) => {
        if(values){
            for (let i = 0; i < registers.length; i++) {
                registers[i].value = values[i];
            }
        }
        let blinking_regs = setInterval(function () {
            for (let i = 0; i < registers.length; i++) {
                registers[i].style.visibility = (registers[i].style.visibility === "" ? "hidden" : "")
            }
        }, 500)
        setTimeout(function () {
            clearInterval(blinking_regs);
            resolve(values);
        }, execTime);
    });
}

function busesAnimation(buses, values, whendone, execTime) {
    return new Promise((resolve, reject) => {
        for (let i = 0; i < buses.length; i++) {
            let bus_line = buses[i];
            bus_line.setOptions({active: true, value: values[i]});
        }

        dashing.is_dashing = true;
        dashing.buses = buses;
        setTimeout(function (){
            stopBusesAnimation();
            resolve(values);
        }, execTime);
    });
}


function stopBusesAnimation() {
    dashing.buses.forEach(function (bus_line, idx) {
        bus_line.setOptions({active: false, value: null});
    });
}


function loadABBusReg() {

    resume_here = "loadABBusReg();";
    let A_knob_setting = getKnobSetting("AAddr");
    let B_knob_setting = getKnobSetting("BAddr");
    let A_reg = document.getElementById("R" + A_knob_setting);
    let bus_values = [A_reg.value]
    let regs = [A_reg];
    if (A_knob_setting !== B_knob_setting) {
        let B_reg = document.getElementById("R" + B_knob_setting);
        bus_values.push(B_reg.value);
        regs.push(B_reg)
    } else bus_values.push(A_reg.value);
    let C_reg = document.getElementById("R" + getKnobSetting("CAddr"));
    let speeds = [16000, 8000, 4000, 2000, 1000]
    let time = speeds[document.getElementById("speed").selectedIndex];
    registersAnimation(regs, null, time)
        .then(() => {
            busesAnimation([bus_lines[0], bus_lines[1]], bus_values, stopBusesAnimation, time)
                .then(values => {
                    registersAnimation([document.getElementById("ALU_A"), document.getElementById("ALU_B")], values, time)
                    .then(values => {registersAnimation([document.getElementById("ALU_C")], getKnobSetting("ALU") === 0 ? [operation(values[0], values[1], "+")] : [operation(values[0], values[1], "-")], time)
                        .then(values => busesAnimation([bus_lines[2]], values, stopBusesAnimation, time)
                            .then(values => registersAnimation([C_reg], values, time)).then(value=>change_enabled=true))})})
        })
}

// ************************************************************
// Esecuzione nella versione con RAM
//  1. controlli: niente conflitti sul Bus C e sul bus della memoria
//  2. registri -> Bus A, Bus B -> ALU (l'ALU calcola sempre, anche se il
//     suo risultato poi non passa sul Bus C)
//  3. la sorgente (ALU o memoria) mette il valore sul Bus C
//  4. il valore arriva al registro (se «registri» è chiuso) e/o alla cella (se «scrivi» è chiuso)
// ************************************************************
function runRam() {
    const alu = swOn("sw_alu"), toReg = swOn("sw_reg"), rd = swOn("sw_read"), wr = swOn("sw_write");
    const cells = closedCells();
    let err = null;
    if (rd && wr)
        err = "«leggi» e «scrivi» non possono essere chiusi insieme: in un ciclo la memoria o legge o scrive.";
    else if (alu && rd)
        err = "Conflitto sul Bus C: l'ALU e la memoria ci scrivono nello stesso momento. Apri «ALU» oppure «leggi».";
    else if ((rd || wr) && cells.length === 0)
        err = "Nessuna cella è collegata al bus della memoria: chiudi l'interruttore della cella da usare.";
    else if ((rd || wr) && cells.length > 1)
        err = "Più celle sono collegate al bus della memoria: come il decoder, devi sceglierne una sola.";
    else if (wr && !alu)
        err = "Il Bus C è vuoto: per scrivere in memoria il valore deve arrivare dall'ALU (chiudi «ALU»).";
    if (err) {
        showMessage(err, "err");
        change_enabled = true;
        return;
    }
    showMessage("");

    const speeds = [16000, 8000, 4000, 2000, 1000];
    const time = speeds[document.getElementById("speed").selectedIndex];
    const aKnob = getKnobSetting("AAddr"), bKnob = getKnobSetting("BAddr");
    const A_reg = document.getElementById("R" + aKnob), B_reg = document.getElementById("R" + bKnob);
    const C_reg = document.getElementById("R" + getKnobSetting("CAddr"));
    const regs = aKnob !== bKnob ? [A_reg, B_reg] : [A_reg];
    const cell = cells.length === 1 ? cells[0] : null;
    const cellInput = cell !== null ? document.getElementById("M" + cell) : null;
    busMem.start = (rd || wr) && cell !== null ? document.getElementById("M" + cell + "_row") : null;
    memReading = rd;
    memWriting = wr;
    const desktop = DESKTOP.matches;

    registersAnimation(regs, null, time)
        .then(() => busesAnimation([bus_lines[0], bus_lines[1]], [A_reg.value, B_reg.value], stopBusesAnimation, time))
        .then(values => registersAnimation([document.getElementById("ALU_A"), document.getElementById("ALU_B")], values, time))
        .then(values => registersAnimation([document.getElementById("ALU_C")],
            [operation(values[0], values[1], getKnobSetting("ALU") === 0 ? "+" : "-")], time))
        .then(values => {
            const c = values[0];
            if (rd) {
                if (!alu) showMessage("L'ALU ha calcolato comunque, ma il suo risultato non passa sul Bus C.", "info");
                setMemBusy(true, [busMem, busRead]);
                return registersAnimation([cellInput], null, time * MEM_SLOWDOWN).then(() => {
                    const v = cellInput.value;
                    const path = [busMem, busRead];
                    if (!desktop) path.push(busCLow);
                    if (toReg) path.push(busCUp);
                    const vals = path.map(b => (b === busMem || b === busCUp) ? v : null);
                    return busesAnimation(path, vals, stopBusesAnimation, time * MEM_SLOWDOWN).then(() => {
                        setMemBusy(false);
                        if (!toReg) {
                            showMessage("La memoria ha messo il valore sul Bus C, ma «registri» è aperto: non viene scritto in nessun registro.", "info");
                            return null;
                        }
                        return registersAnimation([C_reg], [v], time);
                    });
                });
            }
            if (alu) {
                const path = [busCAlu];
                if (desktop || wr) path.push(busCLow);
                if (toReg) path.push(busCUp);
                if (wr) path.push(busWrite, busMem);
                const shown = toReg ? busCUp : (wr ? busMem : busCAlu);
                const vals = path.map(b => (b === shown || (wr && b === busMem)) ? c : null);
                if (wr) setMemBusy(true, [busMem, busWrite]);
                return busesAnimation(path, vals, stopBusesAnimation, wr ? time * MEM_SLOWDOWN : time).then(() => {
                    const writes = [];
                    if (toReg) writes.push(registersAnimation([C_reg], [c], time));
                    if (wr) writes.push(registersAnimation([cellInput], [c], time * MEM_SLOWDOWN));
                    if (!writes.length)
                        showMessage("Il risultato dell'ALU è sul Bus C, ma nessun interruttore lo porta a un registro o alla memoria.", "info");
                    return Promise.all(writes);
                });
            }
            showMessage("Nessuna sorgente sul Bus C: l'ALU ha calcolato, ma il risultato non va da nessuna parte.", "info");
            return null;
        })
        .then(() => {
            busMem.start = null; memReading = false; memWriting = false;
            setMemBusy(false);
            change_enabled = true;
        });
}

function operation(a, b, op){
    if(prevNumberBase === 2){
        a = bin2dec(a);
        b = bin2dec(b);
    }
    let res;
    if(op === "+"){
        res = parseInt(a) + parseInt(b);
    }
    else res = parseInt(a) - parseInt(b);
    if (prevNumberBase === 2)
        return dec2bin(res);
    return res;
}


function stopCycle() {
    if (dashing.is_dashing)
        stopBusesAnimation(dashing.buses);
    change_enabled = true;
    resume_here = null;
}

function twosComp(binNum)
// Convert the base2Value to its two's complement format and
// return it in a new bitData object.  The original value is
// unchagned.
//
// NOTE:Taking the twos complement means flipping all of the bits
//      then adding one.  These two things can be done in sequence
//      or simultaneously.  The following solution does them
//      simultaneously.  The basic strategy is as follows:
//
//      Starting with the LSB of the number:
//              Scan each bit moving towards the MSB
//              Leave each bit unchanged upto and including the
//                      the first 1.
//              Flip all of the bits to the left of the first 1.
//
{
    var flipEM, i, twosCVal;

    twosCVal = "";
    flipEM = false;    // Flag that indicates if  the
                       // bits should be being flipped yet.
                       // I.e. Are we to the left of the first
                       // 1 yet?

    for (i=binNum.length-1; i>=0; i--)
    {
        if (flipEM)
            // The first one has been reached so this bit
            // needs to be flipped.
            twosCVal = ((parseInt(binNum.charAt(i)) + 1) % 2) +
                twosCVal;
        else
        {
            // If the first one hasn't been reached just
            // copy the bit.  If this is the first one
            // set the flipEM flag.
            twosCVal = binNum.charAt(i) + twosCVal;
            flipEM = (binNum.charAt(i) === '1')
        }
    }

    return twosCVal;
}

// numero di bit dei valori: 8 nelle versioni manuali, 16 nella versione Istruzioni (parole di memoria)
function wordBits() { return with_instr ? 16 : 8; }

function dec2bin(num){
    let neg = false;
    if (num < 0){
        num = -num;
        neg = true;
    }
    let n_bits = wordBits();
    let result = "";
    for (let i = 0; i < n_bits; i++) {
        let numNew = Math.floor(num / 2);
        let rem =  num - numNew*2
        result = rem + result;
        num = numNew;
    }
    if(neg)
        return twosComp(result);
    return result;
}

function bin2dec(num){
    let neg = false;
    if (num[0] === "1"){
        neg = true;
        num = twosComp(num);
    }
    let result = 0;
    let maxDigit = num.length - 1
    for (let i =  maxDigit; i >= 0; i--) {
        result += parseInt(num[i])*2**(maxDigit - i);
    }
    if(neg)
        return -result;
    return result;
}

function changeBase(){
    if (change_enabled){
        let base = parseInt(document.getElementById("numberBase").value);
        if (base !== prevNumberBase){
            let conversion_fun;
            if (prevNumberBase === 10){
                if (base === 2)
                    conversion_fun = dec2bin;
            }
            else if (prevNumberBase === 2){
                if (base === 10)
                    conversion_fun = bin2dec;
            }
            let registers = document.getElementsByClassName("form-control");
            for (let i = 0; i < registers.length; i++) {
                const el = registers[i];
                if (el.classList.contains("no-base")) continue;                  // PC, IR, indirizzo: sempre in base 10
                if (el.dataset.kind && el.dataset.kind !== "num") continue;      // celle con istruzioni
                el.value = conversion_fun(el.value);
            }
            prevNumberBase = base;
            if (typeof renderAllCells === "function") renderAllCells();
            prevNumberBase = base;
        }
    }
}

// ************************************************************
// Functions that handle Knobs and Switches
//
function getKnobSetting(knobName) {
// Return the current position of the knob in question.
    var kn = document.getElementById(knobName).src;
    return parseInt(kn.substring(kn.length - 5, kn.length - 3));
}

function setKnob(knobPrefix, knobName, knobPos) {
// Turn the knob to the given setting.
    document.getElementById(knobName).src =  knobPrefix + "Dial" + knobPos + ".svg";
    let line_idx;
    if(knobPrefix === "sreg"){
        if(knobName[0] === "C") {
            bus_lines[2].end = document.getElementById("R"+knobPos+"_row");
            if (busCUp) busCUp.end = document.getElementById("R"+knobPos+"_row");
        }
        else{
            if(knobName[0] === "B")
                line_idx = 1;
            else line_idx = 0;
            bus_lines[line_idx].start = document.getElementById("R"+knobPos+"_row");
        }
        redrawBuses(); // il Bus B dipende anche dalla posizione del Bus A (salto all'incrocio)
    }

}

function turnKnob(knobPrefix, knobName, knobInc) {
// Turn the indicated knob clockwise one increment.
    var knobPos;

    if (change_enabled && !with_instr) {   // nella versione Istruzioni le rotelle le gira l'unità di controllo
        knobPos = getKnobSetting(knobName) + knobInc;
        if(knobPrefix === "sreg"){
            if (knobPos > 3)
                knobPos = 0;
        }
        else {
            if (knobPos > 1)
                knobPos = 0;
        }

        setKnob(knobPrefix, knobName, knobPos);

    }
}
