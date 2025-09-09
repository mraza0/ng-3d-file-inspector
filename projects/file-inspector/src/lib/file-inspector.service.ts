import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { FileType, FileAnalysisResult, DetailedFileAnalysis, PrinterInfo, SlicerInfo } from './types';
import * as JSZip from 'jszip';

@Injectable({
  providedIn: 'root'
})
export class FileInspectorService {

  constructor() { }

  analyzeFile(file: File): Observable<FileAnalysisResult> {
    return from(this.performFileAnalysis(file));
  }

  analyzeFileDetailed(file: File): Observable<DetailedFileAnalysis> {
    return from(this.performDetailedFileAnalysis(file));
  }

  private async performFileAnalysis(file: File): Promise<FileAnalysisResult> {
    const fileType = this.detectFileType(file);
    
    if (fileType === FileType.TMF) {
      const isSliced = await this.is3mfSliced(file);
      const printerInfo = isSliced ? await this.extractPrinterInfo(file) : undefined;
      
      return {
        fileType,
        isSliced,
        printerInfo
      };
    }

    if (fileType === FileType.GCODE) {
      const printerInfo = await this.extractGcodePrinterInfo(file);
      return {
        fileType,
        isSliced: true,
        printerInfo
      };
    }

    return {
      fileType,
      isSliced: false
    };
  }

  private async performDetailedFileAnalysis(file: File): Promise<DetailedFileAnalysis> {
    const basicAnalysis = await this.performFileAnalysis(file);
    
    const detailedAnalysis: DetailedFileAnalysis = {
      ...basicAnalysis,
      fileSize: file.size
    };

    if (basicAnalysis.fileType === FileType.TMF && basicAnalysis.isSliced) {
      const slicerInfo = await this.extract3mfSlicerInfo(file);
      const printSettings = await this.extract3mfPrintSettings(file);
      detailedAnalysis.slicerInfo = slicerInfo;
      detailedAnalysis.printSettings = printSettings;
    }

    if (basicAnalysis.fileType === FileType.GCODE) {
      const slicerInfo = await this.extractGcodeSlicerInfo(file);
      const printSettings = await this.extractGcodePrintSettings(file);
      detailedAnalysis.slicerInfo = slicerInfo;
      detailedAnalysis.printSettings = printSettings;
    }

    return detailedAnalysis;
  }

  private detectFileType(file: File): FileType {
    const extension = file.name.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'stl':
        return FileType.STL;
      case '3mf':
        return FileType.TMF;
      case 'gcode':
      case 'g':
        return FileType.GCODE;
      default:
        return FileType.UNKNOWN;
    }
  }

  private async is3mfSliced(file: File): Promise<boolean> {
    try {
      const zip = await JSZip.loadAsync(file);
      
      // Check for slicing-specific files and metadata
      const fileNames = Object.keys(zip.files);
      
      // Check for Bambu Studio/OrcaSlicer specific files
      if (fileNames.some(name => name.includes('Metadata/') || name.includes('auxiliary'))) {
        return true;
      }
      
      // Check content of 3D model file for slicing metadata
      const modelFile = zip.file('3D/3dmodel.model');
      if (modelFile) {
        const modelContent = await modelFile.async('string');
        console.log('3MF Model Content:', modelContent.substring(0, 1000));
        
        const slicingIndicators = [
          // Slicer names
          'PrusaSlicer', 'SuperSlicer', 'OrcaSlicer', 'Cura', 'BambuStudio', 
          'Slic3r', 'ideaMaker', 'Simplify3D',
          
          // Slicing-specific metadata
          'print_settings', 'printer_settings', 'material_settings',
          'slice_parameter', 'slicing_info', 'slicer_version',
          
          // Print job information
          'print_time', 'material_usage', 'layer_count',
          
          // Specific 3MF slicing tags and namespaces
          'slice:', 'config:', 'slic3r:', 'prusaslicer:', 'bambustudio:',
          'xmlns:config', 'xmlns:slic3r', 'xmlns:slice'
        ];
        
        if (slicingIndicators.some(indicator => 
          modelContent.toLowerCase().includes(indicator.toLowerCase())
        )) {
          return true;
        }
      }
      
      // Check auxiliary files for slicer metadata
      for (const fileName of fileNames) {
        if (fileName.startsWith('Metadata/') || fileName.includes('auxiliary') || fileName.includes('config')) {
          const file = zip.file(fileName);
          if (file) {
            const content = await file.async('string');
            if (content.includes('slic') || content.includes('print') || content.includes('layer')) {
              return true;
            }
          }
        }
      }
      
      return false;
    } catch (error) {
      console.warn('Error detecting 3MF slicing status:', error);
      return false;
    }
  }

  private async extractPrinterInfo(file: File): Promise<PrinterInfo | undefined> {
    try {
      const zip = await JSZip.loadAsync(file);
      let allContent = '';
      
      // Extract and combine content from all relevant files
      const relevantFiles = ['3D/3dmodel.model', '[Content_Types].xml'];
      const metadataFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('Metadata/') || name.includes('auxiliary') || name.includes('config')
      );
      
      for (const fileName of [...relevantFiles, ...metadataFiles]) {
        const file = zip.file(fileName);
        if (file) {
          try {
            const content = await file.async('string');
            allContent += content + ' ';
          } catch (e) {
            // Skip files that can't be read as text
          }
        }
      }
      
      console.log('3MF Combined Content for Printer Info:', allContent.substring(0, 1000));

      const printerPatterns = [
        // XML-style printer information (common in 3MF)
        { pattern: /<metadata.*name=["']printer_model["'].*>([^<]+)</i, brand: 'Generic' },
        { pattern: /<metadata.*name=["']printer_variant["'].*>([^<]+)</i, brand: 'Generic' },
        { pattern: /printer_model="([^"]+)"/i, brand: 'Generic' },
        { pattern: /printer_variant="([^"]+)"/i, brand: 'Generic' },
        
        // Prusa patterns
        { pattern: /Prusa.*i3.*MK([0-9S]+)/i, brand: 'Prusa Research' },
        { pattern: /Original Prusa i3 MK([0-9S]+)/i, brand: 'Prusa Research' },
        { pattern: /Prusa.*MINI/i, brand: 'Prusa Research', name: 'MINI+' },
        { pattern: /Prusa.*XL/i, brand: 'Prusa Research', name: 'XL' },
        { pattern: /MK3S/i, brand: 'Prusa Research', name: 'i3 MK3S+' },
        { pattern: /MK4/i, brand: 'Prusa Research', name: 'MK4' },
        
        // Bambu Lab patterns
        { pattern: /Bambu.*X1.*Carbon/i, brand: 'Bambu Lab', name: 'X1 Carbon' },
        { pattern: /Bambu.*A1.*mini/i, brand: 'Bambu Lab', name: 'A1 mini' },
        { pattern: /X1C/i, brand: 'Bambu Lab', name: 'X1 Carbon' },
        { pattern: /A1M/i, brand: 'Bambu Lab', name: 'A1 mini' },
        
        // Creality patterns  
        { pattern: /Ender.*(\d+)/i, brand: 'Creality' },
        { pattern: /CR-(\d+)/i, brand: 'Creality' },
        
        // Ultimaker patterns
        { pattern: /Ultimaker.*([A-Z0-9\s]+)/i, brand: 'Ultimaker' },
        
        // Generic patterns
        { pattern: /printer.*name.*[:=]["']([^"']+)["']/i, brand: 'Generic' },
        { pattern: /machine.*type.*[:=]["']([^"']+)["']/i, brand: 'Generic' }
      ];

      for (const { pattern, brand, name } of printerPatterns) {
        const match = allContent.match(pattern);
        if (match) {
          const printerName = name || match[1];
          return {
            name: printerName.trim(),
            brand,
            model: match[1] ? match[1].trim() : printerName.trim()
          };
        }
      }

      // Fallback: look for any printer-related metadata
      const fallbackPatterns = [
        /printer.*[:=]\s*([^\n\r;,]+)/i,
        /machine.*[:=]\s*([^\n\r;,]+)/i
      ];

      for (const pattern of fallbackPatterns) {
        const match = allContent.match(pattern);
        if (match && match[1].trim().length > 0) {
          const printerName = match[1].trim();
          return this.parsePrinterName(printerName);
        }
      }

      return undefined;
    } catch (error) {
      console.warn('Error extracting printer info from 3MF:', error);
      return undefined;
    }
  }

  private async extractGcodePrinterInfo(file: File): Promise<PrinterInfo | undefined> {
    try {
      const text = await file.text();
      const lines = text.split('\n').slice(0, 50);

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith(';') && trimmedLine.includes('printer')) {
          const printerMatch = trimmedLine.match(/printer[:\s]+([^\n\r;]+)/i);
          if (printerMatch) {
            const printerName = printerMatch[1].trim();
            return this.parsePrinterName(printerName);
          }
        }

        if (trimmedLine.includes('Generated by')) {
          const generatedMatch = trimmedLine.match(/Generated by ([^,\n\r;]+)/i);
          if (generatedMatch) {
            const slicerInfo = generatedMatch[1].trim();
            if (slicerInfo.includes('Prusa')) {
              return { name: 'Prusa Printer', brand: 'Prusa Research' };
            }
            if (slicerInfo.includes('Cura')) {
              return { name: 'Generic Printer', brand: 'Generic' };
            }
          }
        }
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  private parsePrinterName(name: string): PrinterInfo {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('prusa')) {
      if (lowerName.includes('mk3')) return { name: 'i3 MK3S+', brand: 'Prusa Research' };
      if (lowerName.includes('mk4')) return { name: 'MK4', brand: 'Prusa Research' };
      if (lowerName.includes('mini')) return { name: 'MINI+', brand: 'Prusa Research' };
      if (lowerName.includes('xl')) return { name: 'XL', brand: 'Prusa Research' };
      return { name: name, brand: 'Prusa Research' };
    }
    
    if (lowerName.includes('bambu')) {
      if (lowerName.includes('x1')) return { name: 'X1 Carbon', brand: 'Bambu Lab' };
      if (lowerName.includes('a1')) return { name: 'A1 mini', brand: 'Bambu Lab' };
      return { name: name, brand: 'Bambu Lab' };
    }
    
    if (lowerName.includes('ender')) {
      return { name: name, brand: 'Creality' };
    }
    
    return { name: name, brand: 'Generic' };
  }

  private async extract3mfSlicerInfo(file: File): Promise<SlicerInfo | undefined> {
    try {
      const zip = await JSZip.loadAsync(file);
      let allContent = '';
      
      // Extract and combine content from all relevant files
      const relevantFiles = ['3D/3dmodel.model', '[Content_Types].xml'];
      const metadataFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('Metadata/') || name.includes('auxiliary') || name.includes('config')
      );
      
      for (const fileName of [...relevantFiles, ...metadataFiles]) {
        const file = zip.file(fileName);
        if (file) {
          try {
            const content = await file.async('string');
            allContent += content + ' ';
          } catch (e) {
            // Skip files that can't be read as text
          }
        }
      }
      
      console.log('3MF Content for Slicer Info:', allContent.substring(0, 1000));
      console.log('All file names in 3MF:', Object.keys(zip.files));
      
      const slicerPatterns = [
        // Direct slicer name patterns with versions
        { pattern: /PrusaSlicer\s+([\d.]+)/i, name: 'PrusaSlicer' },
        { pattern: /SuperSlicer\s+([\d.]+)/i, name: 'SuperSlicer' },
        { pattern: /OrcaSlicer\s+([\d.]+)/i, name: 'OrcaSlicer' },
        { pattern: /BambuStudio\s+([\d.]+)/i, name: 'Bambu Studio' },
        { pattern: /Cura\s+([\d.]+)/i, name: 'Ultimaker Cura' },
        { pattern: /Slic3r\s+([\d.]+)/i, name: 'Slic3r' },
        
        // Without version numbers (fallback)
        { pattern: /PrusaSlicer/i, name: 'PrusaSlicer' },
        { pattern: /SuperSlicer/i, name: 'SuperSlicer' },
        { pattern: /OrcaSlicer/i, name: 'OrcaSlicer' },
        { pattern: /BambuStudio/i, name: 'Bambu Studio' },
        { pattern: /Cura/i, name: 'Ultimaker Cura' },
        { pattern: /Slic3r/i, name: 'Slic3r' },
        
        // XML metadata patterns
        { pattern: /<metadata.*name=["']slicer["'].*?value=["']([^"']+)["']/i, name: 'Slicer' },
        { pattern: /<metadata.*name=["']application["'].*?value=["']([^"']+)["']/i, name: 'Application' },
        { pattern: /<metadata.*name=["']slicer["'].*?>([^<]+)</i, name: 'Slicer' },
        { pattern: /<metadata.*name=["']application["'].*?>([^<]+)</i, name: 'Application' },
        
        // Generator patterns
        { pattern: /generator.*["']([^"']*slic[^"']*)["']/i, name: 'Slicer' },
        { pattern: /application.*name.*["']([^"']*slic[^"']*)["']/i, name: 'Slicer' },
        
        // Content-based detection for common slicers
        { pattern: /createdBy.*["']([^"']*slic[^"']*)["']/i, name: 'Slicer' },
        { pattern: /tool.*["']([^"']*slic[^"']*)["']/i, name: 'Slicer' }
      ];

      for (const { pattern, name } of slicerPatterns) {
        const match = allContent.match(pattern);
        if (match) {
          if (match[2]) {
            // Pattern with separate name and version groups
            return {
              name: match[1].trim(),
              version: match[2].trim()
            };
          } else if (match[1]) {
            // Try to extract version from the matched string
            const versionMatch = match[1].match(/([\d.]+)/);
            return {
              name: name === 'Slicer' || name === 'Application' ? match[1].replace(/[\d.\s]+$/, '').trim() : name,
              version: versionMatch ? versionMatch[1] : undefined
            };
          }
        }
      }

      return undefined;
    } catch (error) {
      console.warn('Error extracting slicer info from 3MF:', error);
      return undefined;
    }
  }

  private async extractGcodeSlicerInfo(file: File): Promise<SlicerInfo | undefined> {
    try {
      const text = await file.text();
      const lines = text.split('\n').slice(0, 30);

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.includes('Generated by')) {
          const match = trimmedLine.match(/Generated by ([^\n\r;]+)/i);
          if (match) {
            const slicerText = match[1].trim();
            const versionMatch = slicerText.match(/([^0-9]+)\s*([\d.]+)/);
            
            if (versionMatch) {
              return {
                name: versionMatch[1].trim(),
                version: versionMatch[2]
              };
            } else {
              return {
                name: slicerText
              };
            }
          }
        }
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async extract3mfPrintSettings(file: File): Promise<any> {
    return {};
  }

  private async extractGcodePrintSettings(file: File): Promise<any> {
    try {
      const text = await file.text();
      const lines = text.split('\n').slice(0, 100);
      const settings: any = {};

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.includes('layer_height')) {
          const match = trimmedLine.match(/layer_height\s*[:=]\s*([\d.]+)/i);
          if (match) settings.layerHeight = parseFloat(match[1]);
        }
        
        if (trimmedLine.includes('fill_density')) {
          const match = trimmedLine.match(/fill_density\s*[:=]\s*([\d.]+)/i);
          if (match) settings.infill = parseFloat(match[1]);
        }
        
        if (trimmedLine.includes('temperature')) {
          const match = trimmedLine.match(/temperature\s*[:=]\s*([\d.]+)/i);
          if (match) settings.temperature = parseFloat(match[1]);
        }
        
        if (trimmedLine.includes('bed_temperature')) {
          const match = trimmedLine.match(/bed_temperature\s*[:=]\s*([\d.]+)/i);
          if (match) settings.bedTemperature = parseFloat(match[1]);
        }
      }

      return Object.keys(settings).length > 0 ? settings : undefined;
    } catch (error) {
      return undefined;
    }
  }
}
