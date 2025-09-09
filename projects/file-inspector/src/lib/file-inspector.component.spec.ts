import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileInspectorComponent } from './file-inspector.component';

describe('FileInspectorComponent', () => {
  let component: FileInspectorComponent;
  let fixture: ComponentFixture<FileInspectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileInspectorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FileInspectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
