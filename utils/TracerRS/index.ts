import {
    globalTracer,
    Span as opSpan,
    initGlobalTracer,
    SpanOptions,
    followsFrom,
    Tags as opTags,
    FORMAT_TEXT_MAP,
    FORMAT_HTTP_HEADERS,
    FORMAT_BINARY,
    SpanContext
} from 'opentracing';
import {
    initTracer,
    JaegerTracer,
    TracingConfig,
    TracingOptions
} from 'jaeger-client';

export const BaggageFormat = {
    HTTP_HEADERS: FORMAT_HTTP_HEADERS,
    TEXT_MAP: FORMAT_TEXT_MAP,
    BINARY: FORMAT_BINARY
}

export enum ReferenceTypes {
    CHILD_OF = 'child_of',
    FOLLOWS_FROM = 'follow_from'
}

export class Span {
    private _span: opSpan;
    private _rootTracer: Tracer;
    private _parent?: Span;
    private _children: Span[];
    constructor(span: opSpan, rootTracer: Tracer, parent?: Span) {
        this._span = span;
        this._rootTracer = rootTracer;
        if (parent) {
            this._parent = parent;
        }
        this._children = [];
    }
    startSpan(name: string, reference: ReferenceTypes = ReferenceTypes.CHILD_OF): Span {
        let newSpan = this._rootTracer.startSpan(name, this, reference);
        this._children.push(newSpan);
        return newSpan;
    }
    log(object: { [key: string]: any } | string): Span {
        if (typeof object === 'string') {
            this._span.log({
                message: object
            });
        } else {
            this._span.log(object);
        }
        return this;
    }
    error(error: Error, setErrorToTrue: boolean = false): Span {
        if (error instanceof Error) {
            this.log({
                'error.name': error.name,
                'error.message': error.message,
                'error.stack': error.stack
            });
            if (setErrorToTrue) {
                this.setError(setErrorToTrue);
            }
        }
        return this;
    }
    tag(object: { [key: string]: any } | string, value?: string | number | boolean): Span {
        if (typeof object === 'string') {
            this._span.setTag(object, value);
        } else {
            this._span.addTags(object);
        }
        return this;
    }
    setError(isError: boolean = true): Span {
        return this.tag({ [opTags.ERROR]: isError });
    }
    context(): SpanContext {
        return this._span.context();
    }
    finish(finishChildren: boolean = false): void {
        if (finishChildren) {
            this._children.forEach((child: Span) => {
                child.finish();
            });
        }
        this._span.finish();
        this._parent?._childFinish(this);
        this._rootTracer.noticeFinish(this);
    }
    setName(spanName: string): Span {
        this._span.setOperationName(spanName);
        return this;
    }
    getInternalSpan(): opSpan {
        return this._span;
    }
    getTracer(): Tracer {
        return this._rootTracer;
    }
    getParent(): Span | undefined {
        return this._parent;
    }
    addChild(child: Span): void {
        this._children.push(child);
    }
    private _childFinish(child: Span): void {
        this._children = this._children.filter(c => c !== child);
    }
}

export class Tracer {
    private _tracer: JaegerTracer;
    private _rootSpan?: Span;
    private _rootTrace?: Tracer
    private _activeSpan?: Span;
    constructor(rootSpan?: Span) {
        if (globalTracer()) {
            this._tracer = globalTracer() as JaegerTracer;
            if (rootSpan) {
                this._rootSpan = rootSpan;
                this._rootTrace = rootSpan.getTracer();
            }
        } else {
            throw new Error('must init tracer before create new instance');
        }
    }
    static initTracer(config: TracingConfig, options: TracingOptions): void {
        initGlobalTracer(initTracer({
            sampler: {
                type: 'const',
                param: 1
            },
            ...config
        }, options));
    }
    // start span
    private _startSpan(spanName: string, opt?: SpanOptions, parentSpan?: Span): Span {
        let newSpan = this._tracer.startSpan(spanName, opt);
        let spanTmp = new Span(newSpan, this, parentSpan);
        parentSpan?.addChild(spanTmp);
        return spanTmp;
    }
    // start root span
    private _startOperation(spanName: string, parentSpanContext?: SpanContext, reference: ReferenceTypes = ReferenceTypes.CHILD_OF): Span {
        let opt: SpanOptions = {};
        let newSpan: Span;
        if (parentSpanContext) {
            switch (reference) {
                // default to reference is CHILD_OF
                case ReferenceTypes.CHILD_OF:
                    opt.childOf = parentSpanContext;
                    newSpan = this._startSpan(spanName, opt);
                    break;
                case ReferenceTypes.FOLLOWS_FROM:
                    opt.references = [followsFrom(parentSpanContext)];
                    newSpan = this._startSpan(spanName, opt);
                    break;
            }
        } else {
            newSpan = this._startSpan(spanName);
        }
        this._activeSpan = newSpan;
        this._rootSpan = newSpan;
        return newSpan;
    }
    startSpan(spanName: string, parentSpan?: Span | SpanContext | null, reference: ReferenceTypes = ReferenceTypes.CHILD_OF): Span {
        // in case the root span didnt created
        if (!this._activeSpan) {
            return this._startOperation(spanName, parentSpan as SpanContext, reference);
        }
        // force ref type of child_of in case this is the second span after the root span
        if (reference === ReferenceTypes.FOLLOWS_FROM && this._activeSpan === this._rootSpan) {
            reference = ReferenceTypes.CHILD_OF;
        }
        let opt: SpanOptions = {},
            newSpan: Span,
            parent = parentSpan as Span || this._activeSpan;
        switch (reference) {
            // default to reference is CHILD_OF
            case ReferenceTypes.CHILD_OF:
                opt.childOf = parent.context();
                newSpan = this._startSpan(spanName, opt, parent);
                break;
            case ReferenceTypes.FOLLOWS_FROM:
                opt.references = [followsFrom(parent.context())];
                newSpan = this._startSpan(spanName, opt);
                break;
        }
        return newSpan;
    }
    spanLog(object: { [key: string]: any } | string): Span {
        if (!this._activeSpan) throw new Error('span must created before log');
        return this._activeSpan.log(object);
    }
    spanError(error: Error, setErrorToTrue: boolean = false): Span {
        if (!this._activeSpan) throw new Error('span must created before error');
        return this._activeSpan.error(error, setErrorToTrue);
    }
    spanTag(object: { [key: string]: any } | string, value?: string | number | boolean): Span {
        if (!this._activeSpan) throw new Error('span must created before tag');
        return this._activeSpan.tag(object, value);
    }
    setError(isError: boolean = true): Span {
        if (!this._activeSpan) throw new Error('span must created before set error');
        return this._activeSpan.tag({ [opTags.ERROR]: isError });
    }
    context(): SpanContext {
        if (!this._activeSpan) throw new Error('span must created before get its content');
        return this._activeSpan.context();
    }
    finish(finishChildren: boolean = false): void {
        if (!this._activeSpan) throw new Error('span must created before finish');
        this._activeSpan.finish(finishChildren);
    }
    noticeFinish(span: Span) {
        if (span === this._activeSpan) {
            this._activeSpan = span.getParent();
        }
        if (span === this._rootSpan) {
            this._rootSpan = undefined;
        }
    }
    finishAll(): void {
        if (!this._rootSpan) throw new Error('root span must create before finish all');
        this._rootSpan.finish(true);
    }
    setName(spanName: string): Span {
        if (!this._activeSpan) throw new Error('span must created before finish');
        return this._activeSpan.setName(spanName);
    }
    withSpan(span: Span, func: (...params: any[]) => Promise<any>, ...params: any[]) {
        const spw = new spanWrapper(span);
        return spw.bindFunction(func, params);
    }
    withTracer(span: Span, func: (...params: any[]) => Promise<any>, ...params: any[]) {
        const tr = new Tracer(span);
        const trw = new tracerWrapper(tr);
        return trw.bindFunction(func, params);
    }
    activeSpan(span?: Span): Span {
        if (span) {
            return this._activeSpan = span;
        }
        if (!this._activeSpan) throw new Error('could not found active span');
        return this._activeSpan;
    }
    rootSpan(): Span {
        if (!this._rootSpan) throw new Error('could not found root span');
        return this._rootSpan;
    }
    static inject(span: Span, format = BaggageFormat.TEXT_MAP): object {
        if (!span) throw new Error('span must provided for inject');
        let baggage = {};
        globalTracer().inject(span.context(), format, baggage);
        return baggage;
    }
    static extract(baggage: any, format: any): SpanContext | undefined | null {
        return globalTracer().extract(format, baggage);
    }
}

export class spanWrapper {
    private _span: Span;
    constructor(span: Span) {
        this._span = span;
    }
    activeSpan(): Span {
        return this._span;
    }
    async bindFunction(func: (...parmas: any[]) => Promise<any>, params: any[]) {
        try {
            return await func.call(this, ...params);
        } catch (err) {
            this._span.setError(true);
            throw (err);
        } finally {
            this._span.finish();
        }
    }
}

export class tracerWrapper {
    private _tracer: Tracer;
    constructor(tracer: Tracer) {
        this._tracer = tracer;
    }
    activeTracer(): Tracer {
        return this._tracer;
    }
    async bindFunction(func: (...parmas: any[]) => Promise<any>, params: any[]) {
        try {
            return await func.call(this, ...params);
        } catch (err) {
            this._tracer.setError(true);
            throw (err);
        } finally {
            this._tracer.finishAll();
        }
    }
}