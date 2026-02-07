import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  effect,
  AfterViewInit,
  OnDestroy,
  inject,
} from '@angular/core';
import type { StressTestMetrics } from '../../../../graph-core';

@Component({
  selector: 'app-stress-performance-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay">
      <div class="metrics">
        <div>Stress: {{ metrics()?.nodes ?? 0 }} nodes</div>
        <div>{{ metrics()?.links ?? 0 }} links</div>
        <div>Create: {{ metrics()?.creationMs?.toFixed(1) ?? '—' }} ms</div>
        <div>FPS: {{ fps() }}</div>
      </div>
      <button type="button" class="log-btn" (click)="logToConsole()">Log to Console</button>
    </div>
  `,
  styles: [
    `
      .overlay {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        min-width: 160px;
      }
      .metrics {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .log-btn {
        margin-top: 8px;
        width: 100%;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        background: #444;
        color: #fff;
        border: 1px solid #666;
        border-radius: 4px;
      }
      .log-btn:hover {
        background: #555;
      }
    `,
  ],
})
export class StressPerformanceOverlayComponent implements AfterViewInit, OnDestroy {
  readonly metrics = input<StressTestMetrics | null>(null);

  protected readonly fps = signal<string>('—');
  private rafId: number | null = null;
  private frameTimestamps: number[] = [];

  constructor() {
    effect(() => {
      this.metrics(); // ensure we react when metrics change
    });
  }

  ngAfterViewInit(): void {
    this.startFpsLoop();
  }

  ngOnDestroy(): void {
    this.stopFpsLoop();
  }

  private startFpsLoop(): void {
    const measure = () => {
      const now = performance.now();
      this.frameTimestamps.push(now);
      const oneSecondAgo = now - 1000;
      this.frameTimestamps = this.frameTimestamps.filter((t) => t > oneSecondAgo);
      const count = this.frameTimestamps.length;
      this.fps.set(String(count));
      this.rafId = requestAnimationFrame(measure);
    };
    this.rafId = requestAnimationFrame(measure);
  }

  private stopFpsLoop(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  logToConsole(): void {
    const m = this.metrics();
    const measures = performance.getEntriesByType('measure');
    const summary = [
      { metric: 'nodes', value: m?.nodes ?? '—' },
      { metric: 'links', value: m?.links ?? '—' },
      { metric: 'creationMs', value: m?.creationMs != null ? `${m.creationMs.toFixed(1)} ms` : '—' },
      { metric: 'FPS', value: this.fps() },
    ];
    console.log('[Stress Test] Summary:', summary);
    console.table(summary);
    if (measures.length > 0) {
      console.log('[Stress Test] Performance measures:', measures);
      console.table(measures.map((e) => ({ name: e.name, duration: e.duration.toFixed(1) })));
    }
  }
}
