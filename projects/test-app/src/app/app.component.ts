import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileInspectorService } from 'file-inspector';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'File Inspector Test App';
  analysis: any = null;
  detailedAnalysis: any = null;
  isLoading = false;
  error: string | null = null;

  constructor(private fileInspector: FileInspectorService) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.isLoading = true;
      this.error = null;
      this.analysis = null;
      this.detailedAnalysis = null;

      this.fileInspector.analyzeFile(file).subscribe({
        next: (result: any) => {
          this.analysis = result;
          console.log('Basic Analysis:', result);
          this.getDetailedAnalysis(file);
        },
        error: (error: any) => {
          this.error = error.message;
          this.isLoading = false;
        }
      });
    }
  }

  private getDetailedAnalysis(file: File) {
    this.fileInspector.analyzeFileDetailed(file).subscribe({
      next: (result:any) => {
        this.detailedAnalysis = result;
        console.log('Detailed Analysis:', result);
        this.isLoading = false;
      },
      error: (error:any) => {
        this.error = error.message;
        this.isLoading = false;
      }
    });
  }

  hasKeys(obj: any): boolean {
    return obj && Object.keys(obj).length > 0;
  }
}
