export interface MidiNoteEvent {
  channel: number; // 1..16
  note: number;    // 0..127
  velocity: number; // 1..127
}

export interface MidiCcEvent {
  channel: number;
  cc: number;
  value: number; // 0..127
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

class MidiManager {
  private access: MIDIAccess | null = null;
  private onNoteCallback: ((evt: MidiNoteEvent) => void) | null = null;
  private onCcCallback: ((evt: MidiCcEvent) => void) | null = null;
  private onDevicesCallback: ((devices: MidiDeviceInfo[]) => void) | null = null;

  public async init(): Promise<MidiDeviceInfo[]> {
    if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
      return [];
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.bindInputs();
      this.access.onstatechange = () => {
        this.bindInputs();
      };
      return this.getDevices();
    } catch {
      return [];
    }
  }

  public getDevices(): MidiDeviceInfo[] {
    if (!this.access) return [];
    const list: MidiDeviceInfo[] = [];
    this.access.inputs.forEach((input) => {
      list.push({
        id: input.id,
        name: input.name || 'MIDI Input',
        manufacturer: input.manufacturer || 'Generic',
      });
    });
    return list;
  }

  public setCallbacks(
    onNote: (evt: MidiNoteEvent) => void,
    onCc: (evt: MidiCcEvent) => void,
    onDevices: (devices: MidiDeviceInfo[]) => void
  ): void {
    this.onNoteCallback = onNote;
    this.onCcCallback = onCc;
    this.onDevicesCallback = onDevices;
  }

  private bindInputs(): void {
    if (!this.access) return;
    this.access.inputs.forEach((input) => {
      input.onmidimessage = (msg: MIDIMessageEvent) => {
        const data = msg.data;
        if (!data || data.length < 3) return;
        const status = data[0] & 0xf0;
        const channel = (data[0] & 0x0f) + 1;
        const d1 = data[1];
        const d2 = data[2];

        // Note On with velocity > 0
        if (status === 0x90 && d2 > 0) {
          this.onNoteCallback?.({ channel, note: d1, velocity: d2 });
        } else if (status === 0xb0) {
          this.onCcCallback?.({ channel, cc: d1, value: d2 });
        }
      };
    });
    this.onDevicesCallback?.(this.getDevices());
  }
}

export const midiManager = new MidiManager();
