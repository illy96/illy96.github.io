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
        if ("active" in opts) this.g.classList.toggle("active", !!opts.active);
        if ("value" in opts) this.value = opts.value;
        this.position();
    }

    position() {
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
    return {
        o, reg, alu, width: o.width,
        desktop: DESKTOP.matches,
        gutterX: gutterL * 0.5,                 // Bus C nel margine sinistro
        yC: reg.bottom + gap * 0.22,            // tratti orizzontali tra i pannelli (computer)
        yA: reg.bottom + gap * 0.50,
        yB: reg.bottom + gap * 0.78,
        laneA, laneB, laneC,
        gapY,                                              // valori A, B e C: tra i due pannelli
        // nomi dei bus: tutti alla stessa altezza
        nameY: rel(document.getElementById("ALU_A_col"), o).top - 56
    };
}

function arrowHead(tip, dir) {
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

function redrawBuses() {
    bus_lines.forEach(b => b.position());
}
redrawBuses();
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
var with_memory = false; //completare!
var with_control = false; //completare!
var with_microprog = false; //completare!
var resume_here = null;

function executeCycle() {
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

function dec2bin(num){
    let neg = false;
    if (num < 0){
        num = -num;
        neg = true;
    }
    let n_bits = 8;
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
                registers[i].value = conversion_fun(registers[i].value);
            }
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
        if(knobName[0] === "C")
            bus_lines[2].end = document.getElementById("R"+knobPos+"_row");
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

    if (change_enabled) {
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
