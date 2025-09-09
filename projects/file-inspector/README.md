# @polar/ng-3d-file-inspector

An Angular library for analyzing 3D printing files (STL, 3MF, GCODE) and detecting file properties, slicing status, and printer information.

## Features

- ✅ Detect file type (STL, 3MF, GCODE)
- ✅ Identify if 3MF files are sliced or not
- ✅ Extract printer information from sliced files
- ✅ Detect slicer information (PrusaSlicer, Cura, OrcaSlicer, etc.)
- ✅ Extract print settings (layer height, infill, temperatures, etc.)
- ✅ Support for popular 3D printers (Prusa, Bambu Lab, Creality, etc.)

## Installation

```bash
npm install @polar/ng-3d-file-inspector
```

## Usage

### Basic Usage

```typescript
import { Component } from '@angular/core';
import { FileInspectorService, FileType } from '@polar/ng-3d-file-inspector';

@Component({
  selector: 'app-file-upload',
  template: `
    <input type="file" (change)="onFileSelected($event)" accept=".stl,.3mf,.gcode,.g">
    <div *ngIf="analysis">
      <p>File Type: {{ analysis.fileType }}</p>
      <p>Is Sliced: {{ analysis.isSliced }}</p>
      <p *ngIf="analysis.printerInfo">
        Printer: {{ analysis.printerInfo.brand }} {{ analysis.printerInfo.name }}
      </p>
    </div>
  `
})
export class FileUploadComponent {
  analysis: any = null;

  constructor(private fileInspector: FileInspectorService) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      this.fileInspector.analyzeFile(file).subscribe(result => {
        this.analysis = result;
        console.log('File analysis:', result);
      });
    }
  }
}
```

### Detailed Analysis

```typescript
import { FileInspectorService } from '@polar/ng-3d-file-inspector';

// Get detailed analysis including slicer info and print settings
this.fileInspector.analyzeFileDetailed(file).subscribe(result => {
  console.log('Detailed analysis:', result);
  // Result includes: fileType, isSliced, printerInfo, fileSize, slicerInfo, printSettings
});
```

## API Reference

### FileInspectorService

#### Methods

- `analyzeFile(file: File): Observable<FileAnalysisResult>`
  - Basic file analysis returning file type, slicing status, and printer info
  
- `analyzeFileDetailed(file: File): Observable<DetailedFileAnalysis>`
  - Comprehensive analysis including slicer info and print settings

### Types

```typescript
export enum FileType {
  STL = 'stl',
  TMF = '3mf',
  GCODE = 'gcode',
  UNKNOWN = 'unknown'
}

export interface FileAnalysisResult {
  fileType: FileType;
  isSliced: boolean;
  printerInfo?: PrinterInfo;
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
```

## Supported File Types

- **STL**: Stereolithography files (unsliced 3D models)
- **3MF**: 3D Manufacturing Format (can be sliced or unsliced)
- **GCODE**: G-code files (always sliced, ready for printing)

## Supported Printers

The library can detect information for popular 3D printer brands:

- **Prusa Research**: i3 MK3S+, MK4, MINI+, XL
- **Bambu Lab**: X1 Carbon, A1 mini
- **Creality**: Ender series
- **Ultimaker**: Various models
- **Generic**: Unknown or other brands

## Supported Slicers

- PrusaSlicer
- SuperSlicer  
- OrcaSlicer
- Ultimaker Cura

## Building and Publishing

```bash
# Build the library
ng build file-inspector

# Navigate to dist folder and publish
cd dist/file-inspector
npm publish
```

## License

MIT License
