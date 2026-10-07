// Web MIDI input: held notes, sustain pedal, settle window, hot-plug.

export interface MidiPort { id: string; name: string }

export interface MidiCallbacks {
  /** Every note change, immediately (for lighting keys and monitoring). */
  onNotes(held: number[]): void;
  /** Note on / off for monitoring through the app's piano. */
  onNoteOn?(note: number, velocity: number): void;
  onNoteOff?(note: number): void;
  /** The held notes after they stopped changing for `settleMs`, only when a new note was added. */
  onSettled(held: number[]): void;
  onPorts(ports: MidiPort[], selected: string | null, connected: boolean): void;
}

export class MidiInput {
  private access: MIDIAccess | null = null;
  private input: MIDIInput | null = null;
  private wanted: string | null = null;
  private wantedName: string | null = null;
  private pressed = new Set<number>();
  private sustained = new Set<number>();
  private pedal = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private addedSinceCommit = false;
  settleMs = 80;

  private cb: MidiCallbacks;
  constructor(cb: MidiCallbacks) { this.cb = cb; }

  get supported() { return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator; }

  async start(preferred: string | null) {
    if (!this.supported) return false;
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      return false;
    }
    this.wanted = preferred;
    this.access.onstatechange = () => this.refresh();
    this.refresh();
    return true;
  }

  ports(): MidiPort[] {
    if (!this.access) return [];
    return [...this.access.inputs.values()].filter((i) => i.state !== 'disconnected').map((i) => ({ id: i.id, name: i.name ?? i.id }));
  }

  select(id: string | null) {
    this.wanted = id;
    this.wantedName = this.ports().find((p) => p.id === id)?.name ?? null;
    this.refresh();
  }

  held(): number[] {
    const s = new Set(this.pressed);
    if (this.pedal) for (const n of this.sustained) s.add(n);
    return [...s].sort((a, b) => a - b);
  }

  /**
   * Re-attach on every plug / unplug. The chosen port is matched by id, then by
   * name (a replugged keyboard can come back with a new id), else the first port.
   */
  private refresh() {
    const ports = this.ports();
    const pick =
      ports.find((p) => p.id === this.wanted) ??
      ports.find((p) => p.name === this.wantedName) ??
      ports[0] ?? null;
    const next = pick ? this.access!.inputs.get(pick.id) ?? null : null;
    if (next !== this.input) {
      if (this.input) this.input.onmidimessage = null;
      this.input = next;
      if (this.input) this.input.onmidimessage = (e) => this.message(e.data);
      this.clearNotes();
    }
    // Remember the match (a replug may change the id), but never swap the user's choice for a fallback.
    if (pick && (!this.wanted || pick.id === this.wanted || pick.name === this.wantedName)) {
      this.wanted = pick.id;
      this.wantedName = pick.name;
    }
    this.cb.onPorts(ports, pick?.id ?? null, !!this.input);
  }

  private clearNotes() {
    this.pressed.clear();
    this.sustained.clear();
    this.pedal = false;
    this.cb.onNotes([]);
  }

  /** Exposed for tests and the on-screen keyboard. */
  message(data: Uint8Array | null | undefined) {
    if (!data || data.length < 2) return;
    const status = data[0] & 0xf0;
    const d1 = data[1];
    const d2 = data[2] ?? 0;
    if (status === 0x90 && d2 > 0) {
      this.pressed.add(d1);
      this.sustained.delete(d1);
      this.addedSinceCommit = true;
      this.cb.onNoteOn?.(d1, d2);
    } else if (status === 0x80 || (status === 0x90 && d2 === 0)) {
      this.pressed.delete(d1);
      if (this.pedal) this.sustained.add(d1);
      else this.cb.onNoteOff?.(d1);
    } else if (status === 0xb0 && d1 === 64) {
      const down = d2 >= 64;
      if (this.pedal && !down) {
        for (const n of this.sustained) if (!this.pressed.has(n)) this.cb.onNoteOff?.(n);
        this.sustained.clear();
      }
      this.pedal = down;
    } else return;
    this.changed();
  }

  private changed() {
    this.cb.onNotes(this.held());
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      const held = this.held();
      if (held.length && this.addedSinceCommit) {
        this.addedSinceCommit = false;
        this.cb.onSettled(held);
      }
    }, this.settleMs);
  }
}
