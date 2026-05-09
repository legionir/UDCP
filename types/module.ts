export type ModuleType =
  | 'joystick'
  | 'slider'
  | 'button'
  | 'color_picker'
  | 'piano';

export interface Module {
  id: string;
  type: ModuleType;
  name: string;
  rate: number;
  transport: ('udp'|'ws'|'http')[];
  autoSend: boolean;
}

