import { TestBed } from '@angular/core/testing';

import { FileInspectorService } from './file-inspector.service';

describe('FileInspectorService', () => {
  let service: FileInspectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileInspectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
