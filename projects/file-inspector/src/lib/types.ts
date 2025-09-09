export enum FileType {
  STL = 'stl',
  TMF = '3mf',
  GCODE = 'gcode',
  UNKNOWN = 'unknown'
}

export interface FileAnalysisResult {
  fileType: FileType;
  isSliced: boolean;
  printerInfo?: PrinterInfo[];
}

export interface PrinterInfo {
  name: string;
  brand: string;
  model?: string;
  nozzleDiameter?: number;
  buildVolume?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface SlicerInfo {
  name: string;
  version?: string;
  settings?: { [key: string]: any };
}

export interface DetailedFileAnalysis extends FileAnalysisResult {
  fileSize: number;
  slicerInfo?: SlicerInfo;
  printSettings?: {
    layerHeight?: number;
    infill?: number;
    printSpeed?: number;
    temperature?: number;
    bedTemperature?: number;
  };
}