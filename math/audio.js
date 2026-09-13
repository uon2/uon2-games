/* Tiny, original game sounds: no downloads, no autoplay, no background loop. */
(() => {
  let context, bus, enabled = true;
  try { enabled = localStorage.getItem('mongle-sound') !== 'off'; } catch {}
  const melodies = {
    tap: [[740, 0, .06]],
    plant: [[330, 0, .10], [440, .07, .13]],
    harvest: [[523, 0, .13], [659, .075, .13], [784, .15, .20], [1047, .23, .22]],
    pack: [[660, 0, .07], [880, .055, .10]],
    coin: [[1319, 0, .09], [1760, .06, .15]],
    hello: [[523, 0, .12], [659, .10, .12], [784, .20, .18]],
    ready: [[659, 0, .12], [784, .09, .12], [988, .18, .20]],
    sale: [[523, 0, .16], [659, .10, .16], [784, .20, .17], [1047, .33, .38]],
    decorate: [[784, 0, .14], [988, .10, .14], [1175, .20, .18], [1568, .32, .30]],
    retry: [[392, 0, .12], [440, .13, .18]],
  };
  function unlock() {
    if (!enabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!context) {
        context = new Audio(); bus = context.createGain(); bus.gain.value = .16;
        bus.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* Sound is optional on browsers without audio support. */ }
  }
  function play(name) {
    if (!enabled) return;
    unlock();
    if (!context || context.state !== 'running') return;
    for (const [frequency, delay, length] of melodies[name] || melodies.tap) {
      const oscillator = context.createOscillator(), envelope = context.createGain();
      const t = context.currentTime + delay;
      oscillator.type = name === 'plant' || name === 'retry' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, t);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .97, t + length);
      envelope.gain.setValueAtTime(0, t);
      envelope.gain.linearRampToValueAtTime(.45, t + .008);
      envelope.gain.exponentialRampToValueAtTime(.001, t + length);
      oscillator.connect(envelope); envelope.connect(bus);
      oscillator.start(t); oscillator.stop(t + length + .02);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    }
  }
  window.FarmSound = {
    unlock, play, get enabled() { return enabled; },
    toggle() { enabled = !enabled; if (bus) bus.gain.value = enabled ? .16 : 0;
      try { localStorage.setItem('mongle-sound', enabled ? 'on' : 'off'); } catch {}
      if (enabled) { unlock(); play('hello'); } return enabled;
    }
  };
})();
