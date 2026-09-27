export type Tab = 'read' | 'settings';

export interface AccessibilitySettings {
  dyslexiaOn: boolean;
  tintOn: boolean;
  bionicOn: boolean;
  alternateLinesOn: boolean;
  speechRate: number;
  darkMode: boolean;
  selectedVoiceName: string;
  apiKey?: string;
  micPermissionGranted?: boolean;
}

export interface DocumentData {
  title: string;
  text: string;
  totalPages?: number;
  isPdf?: boolean;
  images?: string[];
}
