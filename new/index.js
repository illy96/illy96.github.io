var bus_lines = [
    new LeaderLine(
        document.getElementById("R0_row"),
        document.getElementById("ALU_A"),
        {
            path: "fluid",
            startSocket: 'right',
            endSocket: 'top',
            color: "blue",
            middleLabel: LeaderLine.captionLabel("BUS A", {lineOffset : -50, fontWeight: "bold"})
        }
    ),
    new LeaderLine(
        document.getElementById("R0_row"),
        document.getElementById("ALU_B"),
        {
            path: "fluid",
            startSocket: 'right',
            endSocket: 'top',
            color: "blue",
            middleLabel: LeaderLine.captionLabel("BUS B", {lineOffset : -50, fontWeight: "bold"})
        }
    ),
    new LeaderLine(
        document.getElementById("ALU_C"),
        document.getElementById("R0_row"),
        {
            path: "fluid",
            startSocket: 'left',
            endSocket: 'left',
            color: "blue",
            middleLabel: LeaderLine.captionLabel("BUS C", {lineOffset : -50, fontWeight: "bold"})
        }
    )];

var change_enabled = true;
var dashing = {
    is_dashing: false,
    buses: []
}
var micro_inst = 0;
var with_memory = false; //completare!
var with_control = false; //completare!
var with_microprog = false; //completare!
var resume_here = null;

function executeCycle() {
    var run_btn = document.getElementById("runButton");
//  document.runLight.src = "runLightGreen.gif";

    if (run_btn.value === "Esegui") {
        run_btn.value = "Halt";

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

function registersAnimation(registers, execTime) {
    return new Promise((resolve, reject) => {
        let blinking_regs = setInterval(function () {
            for (let i = 0; i < registers.length; i++) {
                registers[i].style.visibility = (registers[i].style.visibility === "" ? "hidden" : "")
            }
        }, 500)
        setTimeout(function () {
            clearInterval(blinking_regs);
            resolve(execTime);
        }, execTime);
    });
}

function busesAnimation(buses, values, whendone, execTime) {
    for (let i = 0; i < buses.length; i++) {
        let bus_line = buses[i];
        bus_line.setOptions(
            {
                dash: {animation: true},
                color: 'red',
                endLabel: LeaderLine.pathLabel({text: String(values[i]), fontWeight: 900, fontSize: 40})
            })
    }

    dashing.is_dashing = true;
    dashing.buses = buses;
    setTimeout(stopBusesAnimation, execTime);
}

function stopBusesAnimation() {
    dashing.buses.forEach(function (bus_line, idx) {
        bus_line.setOptions({dash: false, color: 'blue', endLabel: ""})
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

    registersAnimation(regs, 3000)
        .then(time => {
            busesAnimation([bus_lines[0], bus_lines[1]], bus_values, stopBusesAnimation, time)
        })
}


function stopCycle() {
    if (dashing.is_dashing)
        stopBusesAnimation(dashing.buses);
    change_enabled = true;
    resume_here = null;
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
    document.getElementById(knobName).src = "../" + knobPrefix + "Dial" + knobPos + ".gif";
    let line_idx;

    if(knobName[0] === "C")
        bus_lines[2].end = document.getElementById("R"+knobPos+"_row");
    else{
        if(knobName[0] === "B")
            line_idx = 1;
        else line_idx = 0;
        bus_lines[line_idx].start = document.getElementById("R"+knobPos+"_row");
    }
}

function turnKnob(knobPrefix, knobName, knobInc) {
// Turn the indicated knob clockwise one increment.
    var knobPos;

    if (change_enabled) {
        knobPos = getKnobSetting(knobName) + knobInc;

        if (knobPos > 3)
            knobPos = 0;

        setKnob(knobPrefix, knobName, knobPos);

    }
}
