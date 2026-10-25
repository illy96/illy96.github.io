// ************************************************************
// Modello di von Neumann con foto di componenti reali.
//
// Il diagramma originale (coordinate del suo viewBox: 0 6 660 280) viene
// disegnato in un "palco" più grande. Le foto sono schede HTML posizionate
// in percentuale sul palco; le linee partono dai riquadri del diagramma.
// Ci sono due disposizioni: "larga" (computer, proiettore) e "alta" (telefono).
//
// Foto: ogni scheda prova prima il file locale img/<nome>.jpg; se manca,
// usa la foto da Wikimedia Commons; se anche quella manca, mostra un riquadro
// con il nome del dispositivo.
// ************************************************************

const COMMONS = "https://commons.wikimedia.org/wiki/";

// id: nome del file locale (img/<id>.jpg); file: nome del file su Wikimedia Commons
const PHOTOS = {
    cpu:        {caption: "Processore (CPU)",    file: "AMD_Ryzen_5_7600_top_IMGP6773_smial_wp.jpg", group: "cpu"},
    ram:        {caption: "Memoria RAM (DDR5)",  file: "DDR5_SDRAM_IMGP6304_smial_wp.jpg",           group: "ram"},
    bus:        {caption: "Bus: piste sulla scheda madre", file: "Motherboard_Traces_(5065965053).jpg", group: "bus"},
    tastiera:   {caption: "Tastiera",            file: "Keychron_K8_Non-Backlight_Wireless_Mechanical_Keyboard.jpg", group: "io"},
    mouse:      {caption: "Mouse",               file: "2017_Mysz_komputerowa_Logitech_MX_Master.jpg", group: "io"},
    microfono:  {caption: "Microfono",           file: "Yeti-USB-Microphone.jpg",                    group: "io"},
    webcam:     {caption: "Webcam",              file: "Webcam_(Logitech_c922).jpg",                 group: "io"},
    monitor:    {caption: "Monitor",             file: "Monitor_ultrawide_21_9.jpg",                 group: "io"},
    stampante:  {caption: "Stampante",           file: "HP_LaserJet_Managed_E50145_Printer.jpg",     group: "io"},
    altoparlanti: {caption: "Altoparlanti",      file: "Logitech-usb-speakers.jpg",                  group: "io"},
    cuffie:     {caption: "Cuffie",              file: "Bose_QuietComfort_35_II_Wireless_Headphones.jpg", group: "io"}
};

// Colori delle linee e dei bordi: gli stessi dei riquadri del diagramma
const COLORS = {cpu: "#e0742a", ram: "#c9962a", bus: "#2E9E4F", io: "#4F8FBF"};

// Punti del diagramma (coordinate originali) da cui partono le linee
const ANCHORS = {
    input:  {box: [100, 18, 195, 62]},     // riquadro "dispositivo di input"
    output: {box: [460, 18, 555, 62]},     // riquadro "dispositivo di output"
    ramTop: [326, 18],
    cpuBottom: [327, 265],
    busRight: [342, 80],                   // freccia RAM <-> CPU
    busLeft: [212, 40]                     // freccia input -> RAM
};
const CPU_RECT = [237, 115, 417, 265];

// ------------------------------------------------------------------
// Disposizioni. Per ogni foto: centro (x, y), larghezza, altezza della
// scheda e punto di partenza della linea sul diagramma (coordinate originali).
// ------------------------------------------------------------------
const LAYOUTS = {
    wide: {
        W: 1500, H: 870,
        diagram: {x: 288, y: 250, s: 1.4},
        cards: [
            {id: "ram",       x: 744,  y: 112, w: 210, h: 140, from: ANCHORS.ramTop},
            {id: "tastiera",  x: 560,  y: 105, w: 145, h: 125, from: [175, 18]},
            {id: "mouse",     x: 400,  y: 100, w: 145, h: 125, from: [150, 18]},
            {id: "microfono", x: 240,  y: 105, w: 145, h: 125, from: [128, 18]},
            {id: "webcam",    x: 90,   y: 178, w: 145, h: 125, from: [106, 18]},
            {id: "monitor",   x: 932,  y: 105, w: 145, h: 125, from: [480, 18]},
            {id: "stampante", x: 1092, y: 100, w: 145, h: 125, from: [505, 18]},
            {id: "altoparlanti", x: 1252, y: 105, w: 145, h: 125, from: [527, 18]},
            {id: "cuffie",    x: 1405, y: 178, w: 145, h: 125, from: [549, 18]},
            {id: "cpu",       x: 746,  y: 765, w: 230, h: 200, from: ANCHORS.cpuBottom, link: true},
            {id: "bus",       x: 1325, y: 545, w: 175, h: 140, from: ANCHORS.busRight}
        ]
    },
    tall: {
        W: 700, H: 880,
        diagram: {x: 20, y: 390, s: 1},
        cards: [
            {id: "ram",       x: 348, y: 250, w: 168, h: 122, from: ANCHORS.ramTop},
            {id: "tastiera",  x: 195, y: 250, w: 118, h: 122, from: [150, 18]},
            {id: "mouse",     x: 65,  y: 250, w: 118, h: 122, from: [102, 18]},
            {id: "microfono", x: 125, y: 70, w: 118, h: 122, from: [115, 18]},
            {id: "monitor",   x: 499, y: 250, w: 118, h: 122, from: [504, 18]},
            {id: "stampante", x: 629, y: 250, w: 118, h: 122, from: [552, 18]},
            {id: "altoparlanti", x: 569, y: 70, w: 118, h: 122, from: [539, 18]},
            {id: "cpu",       x: 347, y: 780, w: 180, h: 175, from: ANCHORS.cpuBottom, link: true},
            {id: "bus",       x: 110, y: 780, w: 150, h: 130, from: ANCHORS.busLeft}
        ]
    }
};

const SVG_NS = "http://www.w3.org/2000/svg";
const stage = document.getElementById("stage");
const svg = document.getElementById("stage_svg");
const links = document.getElementById("links");
const cardsBox = document.getElementById("cards");
let current = null;

function photoUrl(file) {
    return COMMONS + "Special:FilePath/" + encodeURIComponent(file) + "?width=480";
}

// Scheda con foto: prova img locale -> Wikimedia Commons -> riquadro con il nome
function makeCard(c, L) {
    const p = PHOTOS[c.id];
    const el = document.createElement(c.link ? "a" : "figure");
    el.className = "card card-" + p.group + (c.link ? " card-link" : "");
    if (c.link) {
        el.href = "simulatore/index.html";
        el.title = "Apri il simulatore del processore";
    }
    el.style.left = ((c.x - c.w / 2) / L.W * 100) + "%";
    el.style.top = ((c.y - c.h / 2) / L.H * 100) + "%";
    el.style.width = (c.w / L.W * 100) + "%";
    el.style.height = (c.h / L.H * 100) + "%";

    const box = document.createElement("div");
    box.className = "photo";
    const img = document.createElement("img");
    img.alt = p.caption;
    img.loading = "eager";
    let attempt = 0;
    img.onerror = function () {
        attempt++;
        if (attempt === 1) img.src = photoUrl(p.file);
        else {
            img.remove();
            box.classList.add("missing");
            box.textContent = "foto non disponibile";
        }
    };
    img.src = "img/" + c.id + ".jpg";
    box.appendChild(img);

    const cap = document.createElement(c.link ? "span" : "figcaption");
    cap.className = "caption";
    cap.textContent = p.caption;
    el.appendChild(box);
    el.appendChild(cap);
    if (c.link) {
        const hint = document.createElement("span");
        hint.className = "open-hint";
        hint.textContent = "Apri il simulatore →";
        el.appendChild(hint);
    }
    return el;
}

// Dal centro della scheda verso il punto di partenza: punto sul bordo della scheda
function edgePoint(c, from) {
    const dx = from[0] - c.x, dy = from[1] - c.y;
    const sx = (c.w / 2) / Math.abs(dx || 1e-9), sy = (c.h / 2) / Math.abs(dy || 1e-9);
    const t = Math.min(sx, sy);
    return [c.x + dx * t, c.y + dy * t];
}

function layout(name) {
    const L = LAYOUTS[name];
    current = name;
    stage.style.aspectRatio = L.W + " / " + L.H;
    svg.setAttribute("viewBox", `0 0 ${L.W} ${L.H}`);

    const d = L.diagram;
    const tr = (pt) => [d.x + pt[0] * d.s, d.y + (pt[1] - 6) * d.s];
    document.getElementById("diagram_use").setAttribute("transform",
        `translate(${d.x} ${d.y - 6 * d.s}) scale(${d.s})`);

    // zona cliccabile sulla CPU
    const a = tr([CPU_RECT[0], CPU_RECT[1]]), b = tr([CPU_RECT[2], CPU_RECT[3]]);
    const hit = document.getElementById("cpu_hit");
    hit.setAttribute("x", a[0] - 4); hit.setAttribute("y", a[1] - 4);
    hit.setAttribute("width", b[0] - a[0] + 13); hit.setAttribute("height", b[1] - a[1] + 13);

    // linee e schede
    links.innerHTML = "";
    cardsBox.innerHTML = "";
    L.cards.forEach(c => {
        const p = PHOTOS[c.id];
        const color = COLORS[p.group];
        const from = tr(c.from);
        const to = edgePoint(c, from);
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", from[0]); line.setAttribute("y1", from[1]);
        line.setAttribute("x2", to[0]);   line.setAttribute("y2", to[1]);
        line.setAttribute("stroke", color);
        line.setAttribute("class", "link");
        links.appendChild(line);
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", from[0]); dot.setAttribute("cy", from[1]);
        dot.setAttribute("r", 5); dot.setAttribute("fill", color);
        links.appendChild(dot);
        cardsBox.appendChild(makeCard(c, L));
    });
}

function chooseLayout() {
    const name = stage.clientWidth < 820 ? "tall" : "wide";
    if (name !== current) layout(name);
}

// crediti delle foto
document.getElementById("credits").innerHTML = Object.values(PHOTOS).map(p =>
    `<a href="${COMMONS}File:${encodeURIComponent(p.file)}" target="_blank" rel="noopener">${p.caption}</a>`
).join(" · ");

chooseLayout();
window.addEventListener("resize", chooseLayout);
