const buttons = document.querySelectorAll(".btn");
let activeKeys = {};

buttons.forEach(btn => {
  btn.addEventListener("touchstart", e => {
    e.preventDefault();
    const key = btn.dataset.key;
    activeKeys[key] = true;
    document.dispatchEvent(new KeyboardEvent("keydown", {code: key}));
  });
  btn.addEventListener("touchend", e => {
    e.preventDefault();
    const key = btn.dataset.key;
    activeKeys[key] = false;
    document.dispatchEvent(new KeyboardEvent("keyup", {code: key}));
  });
});
