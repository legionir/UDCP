export type ModuleType = 'joystick' | 'slider' | 'button' | 'color_picker' | 'piano';

export interface VirtualModule {
  id: string;
  type: ModuleType;
  name: string;
  position: { x: number; y: number; width?: number; height?: number };
  config: {
    autoSend: boolean;
    rate: number; // Hz
    transport: ('udp'|'ws'|'http')[];
    qos: 0 | 1 | 2;
    streamName: string; // e.g., 'stick', 'slider', 'button', 'color_picker', 'midi'
  };
  state?: any; // current value/state (x/y, value, color, pressed, note)
}

export type AIModuleType = 'face_detect' | 'hand_track' | 'pose' | 'object_detect' | 'qr_barcode' | 'ocr' | 'color_track';

export interface AIModule {
  id: string;
  type: AIModuleType;
  name: string;
  enabled: boolean;
  config: {
    modelAssetPath?: string;
    confidenceThreshold: number;
    maxDetections: number;
    resolution: '360p' | '480p' | '720p';
    fpsTarget: number; // max output FPS to UDCP
    transport: ('ws'|'http')[];
    qos: 0 | 1 | 2;
  };
  stats?: {
    frames: number;
    detections: number;
    lastInferenceMs?: number;
    error?: string;
  };
}

