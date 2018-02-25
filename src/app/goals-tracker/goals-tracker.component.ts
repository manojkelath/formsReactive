import {
    Component,
    Input,
    Output,
    EventEmitter,
    ViewEncapsulation,
    HostListener,
    ChangeDetectionStrategy,
    ContentChild,
    TemplateRef
  } from '@angular/core';
  import { scaleLinear, scalePoint, scaleTime } from 'd3-scale';
  import { curveLinear } from 'd3-shape';
  import { ColorHelper,BaseChartComponent, calculateViewDimensions, ViewDimensions} from '@swimlane/ngx-charts';

@Component({
    moduleId: module.id,
    selector: 'goals-tracker',
    templateUrl: 'goals-tracker.component.html',
    styleUrls: ['goals-tracker.component.scss']
})
export class GoalsTrackerComponent extends BaseChartComponent{
    @Input() legend;
    @Input() legendTitle: string = 'Legend';
    @Input() state;
    @Input() xAxis;
    @Input() yAxis;
    @Input() autoScale;
    @Input() showXAxisLabel;
    @Input() showYAxisLabel;
    @Input() xAxisLabel;
    @Input() yAxisLabel;
    @Input() timeline;
    @Input() gradient: boolean;
    @Input() showGridLines: boolean = true;
    @Input() curve: any = curveLinear;
    @Input() activeEntries: any[] = [];
    @Input() schemeType: string;
    @Input() xAxisTickFormatting: any;
    @Input() yAxisTickFormatting: any;
    @Input() roundDomains: boolean = false;
    @Input() tooltipDisabled: boolean = false;
    @Input() xScaleMin: any;
    @Input() xScaleMax: any;
    @Input() yScaleMin: number;
    @Input() yScaleMax: number;
  
    @Output() activate: EventEmitter<any> = new EventEmitter();
    @Output() deactivate: EventEmitter<any> = new EventEmitter();
  
    @ContentChild('tooltipTemplate') tooltipTemplate: TemplateRef<any>;
    @ContentChild('seriesTooltipTemplate') seriesTooltipTemplate: TemplateRef<any>;
  
    dims: ViewDimensions;
    xSet: any;
    xDomain: any;
    yDomain: any;
    seriesDomain: any;
    xScale: any;
    yScale: any;
    transform: string;
    colors: ColorHelper;
    clipPathId: string;
    clipPath: string;
    scaleType: string;
    series: any;
    margin = [10, 20, 10, 20];
    hoveredVertical: any; // the value of the x axis that is hovered over
    xAxisHeight: number = 0;
    yAxisWidth: number = 0;
    filteredDomain: any;
    legendOptions: any;
  
    timelineWidth: any;
    timelineHeight: number = 50;
    timelineXScale: any;
    timelineYScale: any;
    timelineXDomain: any;
    timelineTransform: any;
    timelinePadding: number = 10;
    cache = {};
  
    update(): void {
      super.update();
      this.dims = calculateViewDimensions({
        width: this.width,
        height: this.height,
        margins: this.margin,
        showXAxis: this.xAxis,
        showYAxis: this.yAxis,
        xAxisHeight: this.xAxisHeight,
        yAxisWidth: this.yAxisWidth,
        showXLabel: this.showXAxisLabel,
        showYLabel: this.showYAxisLabel,
        showLegend: this.legend,
        legendType: this.schemeType
      });
  
      if (this.timeline) {
        this.dims.height -= (this.timelineHeight + this.margin[2] + this.timelinePadding);
      }
  
      this.xDomain = this.getXDomain();
      if (this.filteredDomain) {
        this.xDomain = this.filteredDomain;
      }
  
      this.yDomain = this.getYDomain();
      this.seriesDomain = this.getSeriesDomain();
      
      this.xScale = this.getXScale(this.xDomain, this.dims.width);
      this.yScale = this.getYScale(this.yDomain, this.dims.height);
  
      this.updateTimeline();
  
      this.setColors();
      this.legendOptions = this.getLegendOptions();
  
      this.transform = `translate(${ this.dims.xOffset }, ${ this.margin[0] })`;
  
      this.clipPathId = 'clip' + this.id().toString();
      this.clipPath = `url(#${this.clipPathId})`;
    }
  
    updateTimeline(): void {
      if (this.timeline) {
        this.timelineWidth = this.dims.width;
        this.timelineXDomain = this.getXDomain();
        this.timelineXScale = this.getXScale(this.timelineXDomain, this.timelineWidth);
        this.timelineYScale = this.getYScale(this.yDomain, this.timelineHeight);
        this.timelineTransform = `translate(${ this.dims.xOffset }, ${ -this.margin[2] })`;
      }
    }
  
    getXDomain(): any[] {
      let values = [];
  
      for (const results of this.results) {
        for (const d of results.series) {
          if (!values.includes(d.name)) {
            values.push(d.name);
          }
        }
      }
  
      this.scaleType = this.getScaleType(values);
      let domain = [];
  
      if (this.scaleType === 'linear') {
        values = values.map(v => Number(v));
      }
  
      let min;
      let max;
      if (this.scaleType === 'time' || this.scaleType === 'linear') {
        min = this.xScaleMin
          ? this.xScaleMin
          : Math.min(...values);
  
        max = this.xScaleMax
          ? this.xScaleMax
          : Math.max(...values);
      }
  
      if (this.scaleType === 'time') {
        domain = [new Date(min), new Date(max)];
        this.xSet = [...values].sort((a, b) => {
          const aDate = a.getTime();
          const bDate = b.getTime();
          if (aDate > bDate) return 1;
          if (bDate > aDate) return -1;
          return 0;
        });
      } else if (this.scaleType === 'linear') {
        domain = [min, max];
        // Use compare function to sort numbers numerically
        this.xSet = [...values].sort((a, b) => (a - b));
      } else {
        domain = values;
        this.xSet = values;
      }
  
      return domain;
    }
  
    getYDomain(): any[] {
      const domain = [];
  
      for (const results of this.results) {
        for (const d of results.series) {
          if (!domain.includes(d.value)) {
            domain.push(d.value);
          }
        }
      }
  
      const values = [...domain];
      if (!this.autoScale) {
        values.push(0);
      }
  
      const min = this.yScaleMin
        ? this.yScaleMin
        : Math.min(...values);
  
      const max = this.yScaleMax
        ? this.yScaleMax
        : Math.max(...values);
  
      return [min, max];
    }
  
    getSeriesDomain(): any[] {
      return this.results.map(d => d.name);
    }
  
    getXScale(domain, width): any {
      let scale;
  
      if (this.scaleType === 'time') {
        scale = scaleTime();
      } else if (this.scaleType === 'linear') {
        scale = scaleLinear();
      } else if (this.scaleType === 'ordinal') {
        scale = scalePoint()
          .padding(0.1);
      }
  
      scale.range([0, width])
          .domain(domain);
  
      return this.roundDomains ? scale.nice() : scale;
    }
  
    getYScale(domain, height): any {
      const scale = scaleLinear()
        .range([height, 0])
        .domain(domain);
      return this.roundDomains ? scale.nice() : scale;
    }
  
    getScaleType(values): string {
      let date = true;
      let num = true;
      for (const value of values) {
        if (!this.isDate(value)) {
          date = false;
        }
        if (typeof value !== 'number') {
          num = false;
        }
      }
  
      if (date) {
        return 'time';
      }
  
      if (num) {
        return 'linear';
      }
  
      return 'ordinal';
    }
  
    isDate(value): boolean {
      if (value instanceof Date) {
        return true;
      }
  
      return false;
    }
  
    updateDomain(domain): void {
      this.filteredDomain = domain;
      this.xDomain = this.filteredDomain;
      this.xScale = this.getXScale(this.xDomain, this.dims.width);
    }
  
    updateHoveredVertical(item): void {
      this.hoveredVertical = item.value;
      this.deactivateAll();
    }
  
    @HostListener('mouseleave')
    hideCircles(): void {
      this.hoveredVertical = null;
      this.deactivateAll();
    }
  
    onClick(data, series?): void {
      if (series) {
        data.series = series.name;
      }
  
      this.select.emit(data);
    }
  
    trackBy(index, item): string {
      return item.name;
    }
    
    

    /**
     * Generates a short id.
     *
     * Description:
     *   A 4-character alphanumeric sequence (364 = 1.6 million)
     *   This should only be used for JavaScript specific models.
     *   http://stackoverflow.com/questions/6248666/how-to-generate-short-uid-like-ax4j9z-in-js
     *
     *   Example: `ebgf`
     */
    id(): string {
    let newId = ('0000' + (Math.random() * Math.pow(36, 4) << 0).toString(36)).slice(-4);

    // append a 'a' because neo gets mad
    newId = `a${newId}`;

    // ensure not already used
    if(!this.cache[newId]) {
        this.cache[newId] = true;
        return newId;
    }
    return newId;
    }



    setColors(): void {
      let domain;
      if (this.schemeType === 'ordinal') {
        domain = this.seriesDomain;
      } else {
        domain = this.yDomain;
      }
  
      this.colors = new ColorHelper(this.scheme, this.schemeType, domain, this.customColors);
    }
  
    getLegendOptions() {
      const opts = {
        scaleType: this.schemeType,
        colors: undefined,
        domain: [],
        title: undefined
      };
      if (opts.scaleType === 'ordinal') {
        opts.domain = this.seriesDomain;
        opts.colors = this.colors;
        opts.title = this.legendTitle;
      } else {
        opts.domain = this.yDomain;
        opts.colors = this.colors.scale;
      }
      return opts;
    }
  
    updateYAxisWidth({ width }): void {
      this.yAxisWidth = width;
      this.update();
    }
  
    updateXAxisHeight({ height }): void {
      this.xAxisHeight = height;
      this.update();
    }
  
    onActivate(item) {
      const idx = this.activeEntries.findIndex(d => {
        return d.name === item.name && d.value === item.value;
      });
      if (idx > -1) {
        return;
      }
  
      this.activeEntries = [ item, ...this.activeEntries ];
      this.activate.emit({ value: item, entries: this.activeEntries });
    }
  
    onDeactivate(item) {
      const idx = this.activeEntries.findIndex(d => {
        return d.name === item.name && d.value === item.value;
      });
  
      this.activeEntries.splice(idx, 1);
      this.activeEntries = [...this.activeEntries];
  
      this.deactivate.emit({ value: item, entries: this.activeEntries });
    }
  
    deactivateAll() {
      this.activeEntries = [...this.activeEntries];
      for (const entry of this.activeEntries) {
        this.deactivate.emit({ value: entry, entries: [] });
      }
      this.activeEntries = [];
    }
  }
  