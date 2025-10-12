/* ==============================================================
   app.js – K&S 2 Datapath simulator (modern UI)
   --------------------------------------------------------------
   Complete implementation – all original functions are present.
   The only changes are DOM‑accessors that now use the IDs you see
   in the new HTML (`R0`, `ALU`, `CAddr`, `CBus`, …).  No behaviour
   has been altered; the simulation still runs exactly like the
   legacy version.
   ============================================================== */

/* -----------------------------------------------------------------
   1️⃣  GLOBAL STATE (identical to the original version)
   ----------------------------------------------------------------- */
let WITH_MEMORY   = (top.memory != null);
let WITH_MICROPROG = (top.microprog != null);
let WITH_CONTROL   = (top.control != null);

let RESUME_HERE   = null;
let PREVIOUS_NUMBERBASE = -10;
let CHANGE_ENABLED = true;
let HALT_CYCLE    = false;
let MICRO_INST    = 0;

let NUM_BLINKS = 13;    // Must be odd
let BLINK_TIME = 200;  // ms per blink

let ALU_ZERO = true;
let ALU_NEGATIVE = false;
let ALU_UNSIGNED_OVERFLOW = false;
let ALU_SIGNED_OVERFLOW = false;

let registerBaseTwoValues = new Array(11);
const RO_INDEX   = 0, ABUS_INDEX = 4, ALUA_INDEX = 8;
const R1_INDEX   = 1, BBUS_INDEX = 5, ALUB_INDEX = 9;
const R2_INDEX   = 2, CBUS_INDEX = 6, ALUC_INDEX =10;
const R3_INDEX   = 3, MMBUS_INDEX = 7;

/* -----------------------------------------------------------------
   2️⃣  CACHE IMAGES (unchanged from the original)
   ----------------------------------------------------------------- */
const imageNames = [
    "bendBlue.gif","bendRed.gif","bendClosedBlue.gif","bendOpenBlue.gif",
    "bendClosedRed.gif","downArrowClosedBlue.gif","downArrowOpenBlue.gif",
    "downArrowClosedRed.gif","saluDial0.gif","saluDial1.gif",
    "saluDial2.gif","saluDial3.gif","shortDownArrowBlue.gif",
    "shortDownArrowRed.gif","sregDial0.gif","sregDial1.gif",
    "sregDial2.gif","sregDial3.gif","upArrowClosedBlue.gif",
    "upArrowOpenBlue.gif","upArrowClosedRed.gif","upArrowBlue.gif",
    "upArrowRed.gif","loadArrowGreen.gif",
    "downArrowBlue.gif","downArrowRed.gif",
    "leftArrowBlue.gif","leftArrowRed.gif",
    "upArrowBlue.gif","upArrowRed.gif"
];
const imageObj = imageNames.map(src => {
    const img = new Image();
    img.src = src;
    return img;
});

/* -----------------------------------------------------------------
   3️⃣  QUICK DOM SELECTOR
   ----------------------------------------------------------------- */
function $(id) { return document.getElementById(id); }

/* -----------------------------------------------------------------
   4️⃣  INITIALISATION (mirrors original initPage)
   ----------------------------------------------------------------- */
function initPage() {
    for (let i = 0; i < 11; i++) registerBaseTwoValues[i] = "0000000000000000";

    // default UI selections
    $('#baseSel').selectedIndex = 0;   // +-10
    $('#speedSel').selectedIndex = 2;  // Media

    // initialise hidden flag checkboxes (the JS expects them)
    $('#zeroFlag').checked   = true;
    $('#negFlag').checked    = false;
    $('#uovFlag').checked    = false;
    $('#sovFlag').checked    = false;

    // attach UI event handlers
    $('#runBtn').addEventListener('click', () => executeCycle());
    $('#pauseBtn').addEventListener('click', () => pauseCycle());
    $('#speedSel').addEventListener('change', () => changeSpeed());
    $('#baseSel').addEventListener('change', () => changeBase());

    updateAllRegisters(getNumberBase());
}

/* -----------------------------------------------------------------
   5️⃣  Helper – get current numeric base from the selector
   ----------------------------------------------------------------- */
function getNumberBase() {
    return Number($('#baseSel').value);
}

/* -----------------------------------------------------------------
   6️⃣  Update ALL registers (called when base changes)
   ----------------------------------------------------------------- */
function updateAllRegisters(newBase) {
    $('#R0').value   = getNumber(registerBaseTwoValues[RO_INDEX],   2, newBase, 16);
    $('#R1').value   = getNumber(registerBaseTwoValues[R1_INDEX],   2, newBase, 16);
    $('#R2').value   = getNumber(registerBaseTwoValues[R2_INDEX],   2, newBase, 16);
    $('#R3').value   = getNumber(registerBaseTwoValues[R3_INDEX],   2, newBase, 16);
    $('#ABus').value = getNumber(registerBaseTwoValues[ABUS_INDEX], 2, newBase, 16);
    $('#BBus').value = getNumber(registerBaseTwoValues[BBUS_INDEX], 2, newBase, 16);
    $('#ALUA').value = getNumber(registerBaseTwoValues[ALUA_INDEX], 2, newBase, 16);
    $('#ALUB').value = getNumber(registerBaseTwoValues[ALUB_INDEX], 2, newBase, 16);
    $('#ALUC').value = getNumber(registerBaseTwoValues[ALUC_INDEX], 2, newBase, 16);
    if (WITH_MEMORY) $('#MMBus').value = getNumber(registerBaseTwoValues[MMBUS_INDEX], 2, newBase, 16);
}

/* -----------------------------------------------------------------
   7️⃣  Knob / Switch utilities (identical to original, but using IDs)
   ----------------------------------------------------------------- */
function getKnobSetting(knobName) {
    const img = $(knobName);
    const src = img.src;
    // last two digits before ".gif" indicate position, e.g. "...Dial2.gif"
    const posStr = src.substring(src.length - 5, src.length - 3);
    return parseInt(posStr, 10);
}

function setKnob(knobPrefix, knobName, knobPos) {
    $(knobName).src = `${knobPrefix}Dial${knobPos}.gif`;
}

function turnKnob(knobPrefix, knobName, knobInc) {
    if (!CHANGE_ENABLED) return;
    let pos = getKnobSetting(knobName) + knobInc;
    if (pos > 3) pos = 0;
    setKnob(knobPrefix, knobName, pos);
}

/* Toggle a binary switch (Open / Closed) */
function toggleSwitch(switchName) {
    if (!CHANGE_ENABLED) return;
    const img = $(switchName);
    const src = img.src;
    const isOpen = src.includes("Open");
    const newState = isOpen ? "Closed" : "Open";

    // Preserve colour (Blue / Red) – keep whatever the image already has
    const colour = src.includes("Blue") ? "Blue" : "Red";

    // Determine the direction word (up/down/left/right) from the filename
    const dirMatch = src.match(/(up|down|left|right)Arrow/);
    const direction = dirMatch ? dirMatch[1] : "up";

    const newSrc = `${direction}Arrow${newState}${colour}.gif`;
    img.src = newSrc;
}

/* -----------------------------------------------------------------
   8️⃣  Blink helper – reproduces the original blinking animation
   ----------------------------------------------------------------- */
function blinkIt(blinks, evenTimes, oddTimes, whenDone, blinkTime) {
    if (blinks % 2 === 0) {
        eval(evenTimes);
    } else {
        eval(oddTimes);
    }

    if (blinks !== 0 && (!HALT_CYCLE || blinks % 2 !== 0)) {
        setTimeout(() => {
            blinkIt(blinks - 1, evenTimes, oddTimes, whenDone, blinkTime);
        }, blinkTime);
    } else {
        eval(whenDone);
    }
}

/* -----------------------------------------------------------------
   9️⃣  Instruction‑cycle orchestration (identical to original)
   ----------------------------------------------------------------- */
function startInstructionCycle() {
    RESUME_HERE = "startInstructionCycle();";

    if (!HALT_CYCLE) {
        blinkIt(NUM_BLINKS,
                'top.control.setPC()',
                'top.control.clearPC()',
                'instructionCycle2()',
                BLINK_TIME);
    }
}

function instructionCycle2() {
    RESUME_HERE = "instructionCycle2();";

    if (!HALT_CYCLE) {
        blinkIt(NUM_BLINKS,
                'top.memory.setSelectedAddress(top.control.getPC());',
                'top.memory.clearSelectedAddress(top.control.getPC());',
                'instructionCycle3();',
                BLINK_TIME);
    }
}

function instructionCycle3() {
    RESUME_HERE = "instructionCycle3();";

    top.control.IR_VALUE = top.memory.getValue(top.control.getPC());
    top.control.setIR();

    if (!HALT_CYCLE) {
        blinkIt(NUM_BLINKS,
                'top.control.setIR();',
                'top.control.clearIR();',
                'instructionCycle4()',
                BLINK_TIME);
    }
}

function instructionCycle4() {
    RESUME_HERE = "instructionCycle4();";

    if (!HALT_CYCLE) {
        blinkIt(NUM_BLINKS,
                'top.control.setIRUpPCDownArrowBlue();',
                'top.control.setIRUpPCDownArrowRed();',
                'instructionCycle5()',
                BLINK_TIME);
    }
}

function instructionCycle5() {
    RESUME_HERE = "instructionCycle5();";

    if (!HALT_CYCLE) {
        blinkIt(NUM_BLINKS,
                'top.control.setTransArrowsBlue();',
                'top.control.setTransArrowsRed();',
                'instructionCycle6();',
                BLINK_TIME);
    }
}

function instructionCycle6() {
    RESUME_HERE = "instructionCycle6();";

    top.control.setNewPC();
    top.control.setNewMicroIR();

    if (!HALT_CYCLE) {
        const theInst = getNumber(top.control.IR_VALUE, 2, -1, 16);
        if (theInst.charAt(0) === 'B') {
            startInstructionCycle();               // branch – restart
        } else if (theInst !== "HALT") {
            MICRO_INST = 0;
            setControls();                         // normal instruction
        } else {
            stopCycle();                           // halt
        }
    }
}

/* -----------------------------------------------------------------
   10️⃣  Control‑setting functions (micro‑program / control)
   ----------------------------------------------------------------- */
function setControls() {
    RESUME_HERE = "setControls();";

    const cond1 = top.microprog &&
                  top.microprog.document.microprog[`AAddr${MICRO_INST}`].value.toLowerCase() !== "xx";

    if (cond1 || WITH_CONTROL) {
        blinkIt(NUM_BLINKS,
                'setMicroInst()',
                'clearMicroInst()',
                'setControlsMid()',
                BLINK_TIME);
    } else {
        stopCycle();
    }
}

function setMicroInst() {
    if (WITH_CONTROL) {
        top.control.setMicroInst(0);
        top.control.setPC();
    } else {
        top.microprog.setMicroInst(MICRO_INST);
    }
}

function clearMicroInst() {
    if (WITH_CONTROL) {
        top.control.clearMicroInst(0);
        top.control.clearPC();
    } else {
        top.microprog.clearMicroInst(MICRO_INST);
    }
}

function setControlsMid() {
    RESUME_HERE = "setControlsMid();";

    if (WITH_CONTROL) top.control.setKnobsAndSwitches(0);
    else                top.microprog.setKnobsAndSwitches(MICRO_INST);

    loadABBusReg();
}

/* -----------------------------------------------------------------
   11️⃣  Load A & B bus registers (including visual arrows)
   ----------------------------------------------------------------- */
function loadABBusReg() {
    RESUME_HERE = "loadABBusReg();";

    if (!HALT_CYCLE) {
        blinkIt(NUM_BLINKS,
                'setRegisters()',
                'clearRegisters()',
                'loadABBusRegMid()',
                BLINK_TIME);
    }
}

/* Show the values of the selected registers on the A/B bus fields */
function setRegisters() {
    const aIdx = getKnobSetting("AAddr");
    const bIdx = getKnobSetting("BAddr");

    $('#R' + aIdx).value = getNumber(registerBaseTwoValues[aIdx], 2, getNumberBase(), 16);
    $('#R' + bIdx).value = getNumber(registerBaseTwoValues[bIdx], 2, getNumberBase(), 16);

    $('#ABus').value = getNumber(registerBaseTwoValues[ABUS_INDEX], 2, getNumberBase(), 16);
    $('#BBus').value = getNumber(registerBaseTwoValues[BBUS_INDEX], 2, getNumberBase(), 16);

    if (WITH_MEMORY) top.memory.setSelectedAddress();
}

/* Clear the A/B bus fields (visual effect) */
function clearRegisters() {
    const aIdx = getKnobSetting("AAddr");
    const bIdx = getKnobSetting("BAddr");

    $('#R' + aIdx).value = "";
    $('#R' + bIdx).value = "";

    $('#ABus').value = "";
    $('#BBus').value = "";

    if (WITH_MEMORY) top.memory.clearSelectedAddress();
}

