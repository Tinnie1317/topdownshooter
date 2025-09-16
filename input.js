// input.js
// Provides unified keyboard + touch input mapping. Exposes `input` object used by game.js

window.input = (function(){
  const state = {
    keys: {},
    touches: {},
    pointer: {x:0,y:0}
  };

  // Keyboard events -> codes like "ArrowUp", "Space", "KeyX", "Enter"
  window.addEventListener("keydown", e => {
    state.keys[e.code] = true;
    // Prevent arrow keys from scrolling
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
  }, {passive:false});

  window.addEventListener("keyup", e => {
    state.keys[e.code] = false;
  });

  // Map on-screen buttons
  function bindButtons(){
    const buttons = document.querySelectorAll("button[data-key]");
    buttons.forEach(btn => {
      const code = btn.dataset.key;
      // Touch start
      btn.addEventListener("touchstart", ev => {
        ev.preventDefault();
        state.keys[code] = true;
        state.touches[code] = true;
      }, {passive:false});
      // Touch end / cancel
      const end = ev => {
        ev.preventDefault();
        state.keys[code] = false;
        state.touches[code] = false;
      };
      btn.addEventListener("touchend", end, {passive:false});
      btn.addEventListener("touchcancel", end, {passive:false});
      // Also support mouse down/up for desktop click
      btn.addEventListener("mousedown", ev => {
        ev.preventDefault();
        state.keys[code] = true;
      });
      window.addEventListener("mouseup", ev => {
        state.keys[code] = false;
      });
    });
  }

  // Virtual joystick drag (optional future improvement)
  function bindCanvasPointer(canvas){
    canvas.addEventListener("pointerdown", e => {
      state.pointer.x = e.clientX; state.pointer.y = e.clientY;
    });
    canvas.addEventListener("pointermove", e => {
      state.pointer.x = e.clientX; state.pointer.y = e.clientY;
    });
  }

  // Public
  return {
    init(canvas){
      bindButtons();
      bindCanvasPointer(canvas);
    },
    isDown(code){ return !!state.keys[code]; },
    // convenience mapping for common actions
    getInputState(){
      return {
        up: state.keys["ArrowUp"] || state.keys["KeyW"],
        down: state.keys["ArrowDown"] || state.keys["KeyS"],
        left: state.keys["ArrowLeft"] || state.keys["KeyA"],
        right: state.keys["ArrowRight"] || state.keys["KeyD"],
        shoot: state.keys["Space"] || state.keys["KeyZ"] || state.keys["KeyX"],
        alt: state.keys["KeyX"] || state.keys["KeyZ"],
        start: state.keys["Enter"],
        select: state.keys["ShiftRight"]
      };
    }
  };
})();
