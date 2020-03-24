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

/**
 * wrapper for the Opentracing Span
 */
export class Span {
    private _span: opSpan;
    private _rootTracer: Tracer;
    private _parent?: Span;
    private _children: Span[];

    /**
     * init new Span
     * @param span (Opentracing Span) the internal Opentracing span
     * @param rootTracer (TracerRS) the tracer that created the span
     * @param parent (Span) optional, the parent span that created this span
     */
    constructor(span: opSpan, rootTracer: Tracer, parent?: Span) {
        this._span = span;
        this._rootTracer = rootTracer;
        if (parent) {
            this._parent = parent;
        }
        this._children = [];
    }
    /**
    * add child to the span list of children
    * @param {Span} child (Span) span child to add to this span
    */
    addChild(child: Span): void {
        this._children.push(child);
    }
    /**
     * remove child span from span children list
     * @param {Span} child (Span) span that finished
     */
    private _childFinish(child: Span): void {
        this._children = this._children.filter(c => c !== child);
    }
    /**
     * start new span that related to the current span
     * @param {string} name (string) operation name of the span
     * @param {CHILD_OF | FOLLOWS_FROM} reference (ReferenceTypes), default to `CHILD_OF`
     */
    startSpan(name: string, reference: ReferenceTypes = ReferenceTypes.CHILD_OF): Span {
        let newSpan = this._rootTracer.startSpan(name, this, reference);
        this._children.push(newSpan);
        return newSpan;
    }
    /**
     * add log to span
     * @param {Object | string} object (Object | String) in case of object, will log as `{ key: value }` pairs,  
     * in case of string will log as `{ message: String }`
     */
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
    /**
     * log Error to span and set error tag
     * @param {Error} error (Error) the error to log the span
     * @param {Boolean} setErrorToTrue (boolean) optional, if `true` will set the Error tag to true,  
     * default `false`
     */
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
    /**
     * set tag or tags
     * @param {Object | String} object (object | string) in case of `object`, will set tags as `{ key: value }` pairs,  
     * in case of `string` will take it and the next parameter `value` and add tag as `{ object: 'value' }`
     * @param {string | number | boolean} value (string | number | boolean) optional, in case the first argument is an `object`,  
     * this parameter not necessary, in case the first argument is `string` this parameter is required
     */
    tag(object: { [key: string]: any } | string, value?: string | number | boolean): Span {
        if (typeof object === 'string') {
            this._span.setTag(object, value);
        } else {
            this._span.addTags(object);
        }
        return this;
    }
    /**
     * add or set the Error tag of the span
     * @param {boolean} isError (boolean) optional, set the error tag to `true` or `false`, default to `true` 
     */
    setError(isError: boolean = true): Span {
        return this.tag({ [opTags.ERROR]: isError });
    }
    /**
     * return span context
     */
    context(): SpanContext {
        return this._span.context();
    }
    /**
     * finish the span
     * @param {boolean} finishChildren (boolean) optional, finish also the span children in case of `true`, default to `false`
     */
    finish(finishChildren: boolean = false): void {
        if (finishChildren) {
            this._children.forEach((child: Span) => {
                child.finish();
            });
        }
        this._span.finish();
        // in case this span has parent, notice him that one of his child has finish
        this._parent?._childFinish(this);
        // notice the tracer that the span finished, in case the active span of the tracer is this tracer
        this._rootTracer.noticeFinish(this);
    }
    /**
     * change the span operation name
     * @param spanName (string) the new span name operation
     */
    setName(spanName: string): Span {
        this._span.setOperationName(spanName);
        return this;
    }
    /**
     * return the internal Opentracing span
     */
    getInternalSpan(): opSpan {
        return this._span;
    }
    /**
     * get the tracer that responsible for this span
     */
    getTracer(): Tracer {
        return this._rootTracer;
    }
    /**
     * get span parent, in case there isn't span parent, return undefined
     */
    getParent(): Span | undefined {
        return this._parent;
    }
}

/**
 * wrapper for the jaeger tracer  
 * this tracer will manage all the spans it creates
 */
export class Tracer {
    private _tracer: JaegerTracer;
    private _rootSpan?: Span;
    private _rootTrace?: Tracer
    private _activeSpan?: Span;
    /**
     * 
     * @param {Tracer} rootSpan (Span) optional, init the tracer with root span and its tracer
     */
    constructor(rootSpan?: Span) {
        // check if the global tracer has init
        if (globalTracer()) {
            // init the internal tracer to be the global tracer
            this._tracer = globalTracer() as JaegerTracer;
            if (rootSpan) {
                this._rootSpan = rootSpan;
                this._activeSpan = rootSpan;
                this._rootTrace = rootSpan.getTracer();
            }
        } else {
            throw new Error('must init tracer before create new instance');
        }
    }
    /**
     * static method, init the global tracer once to use it later
     * @param config (TracingConfig) jaeger tracing config
     * @param options (TracingOptions) jaeger tracing options
     */
    static initTracer(config?: TracingConfig, options?: TracingOptions): void {
        // init global tracer the the config and options
        // init sampler to always report to jaeger agent by default
        initGlobalTracer(initTracer({
            sampler: {
                type: 'const',
                param: 1
            },
            ...config
        }, options || {}));
    }
    /**
     * inject span context to carrier and return the carrier
     * @param span (Span) span to inject
     * @param format (BaggageFormat) optional, the format to inject the span context, default to `TEXT_MAP`
     */
    static inject(span: Span, format = BaggageFormat.TEXT_MAP): object {
        if (!span) throw new Error('span must provided for inject');
        let baggage = {};
        globalTracer().inject(span.context(), format, baggage);
        return baggage;
    }
    /**
     * extract carrier to span context, may also return null or undefined
     * @param baggage the carrier to extract
     * @param format (BaggageFormat) the baggage format to extract
     */
    static extract(baggage: any, format: any): SpanContext | undefined | null {
        return globalTracer().extract(format, baggage);
    }
    /**
     * internal method to create span
     * @param spanName (string) span operation name
     * @param opt (SpanOptions) optional
     * @param parentSpan (Span) optional, the parent span
     */
    private _startSpan(spanName: string, opt?: SpanOptions, parentSpan?: Span): Span {
        let newSpan = this._tracer.startSpan(spanName, opt);
        let spanTmp = new Span(newSpan, this, parentSpan);
        parentSpan?.addChild(spanTmp);
        return spanTmp;
    }
    /**
     * internal method to create root span
     * @param spanName (string) span operation name
     * @param parentSpanContext (SpanContext) optional, if provided will add to the root reference
     * @param reference (ReferenceTypes) optional, default to `CHILD_OF`
     */
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
    /**
     * create new span that is child or followed by the active span
     * @param spanName (string) span operation name
     * @param parentSpan (SpanRS | SpanContext | null) span or spanContext that the active span create
     * @param reference (ReferenceTypes) optional, default to `CHILD_OF` in case `parentSpan` is provided
     */
    startSpan(spanName: string, parentSpan?: Span | SpanContext | null, reference: ReferenceTypes = ReferenceTypes.CHILD_OF): Span {
        // in case the root span didn't created
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
    /**
     * like Span.log  
     * add log to the active span
     */
    spanLog(object: { [key: string]: any } | string): Span {
        if (!this._activeSpan) throw new Error('span must created before log');
        return this._activeSpan.log(object);
    }
    /**
     * like Span.error  
     * add error log to the active span
     */
    spanError(error: Error, setErrorToTrue: boolean = false): Span {
        if (!this._activeSpan) throw new Error('span must created before error');
        return this._activeSpan.error(error, setErrorToTrue);
    }
    /**
     * like Span.tag  
     * add tag to the active span
     */
    spanTag(object: { [key: string]: any } | string, value?: string | number | boolean): Span {
        if (!this._activeSpan) throw new Error('span must created before tag');
        return this._activeSpan.tag(object, value);
    }
    /**
     * like Span.setError  
     * add log to the active span
     */
    spanSetError(isError: boolean = true): Span {
        if (!this._activeSpan) throw new Error('span must created before set error');
        return this._activeSpan.tag({ [opTags.ERROR]: isError });
    }
    /**
     * like Span.context  
     * return the context of the active span
     */
    context(): SpanContext {
        if (!this._activeSpan) throw new Error('span must created before get its content');
        return this._activeSpan.context();
    }
    /**
     * like Span.finish  
     * finish the active span
     */
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
    /**
     * finish all span hierarchy
     */
    finishAll(): void {
        if (!this._rootSpan) throw new Error('root span must create before finish all');
        this._rootSpan.finish(true);
    }
    /**
     * like Span.setName  
     * change the operation name of the active span
     */
    setName(spanName: string): Span {
        if (!this._activeSpan) throw new Error('span must created before finish');
        return this._activeSpan.setName(spanName);
    }
    /**
     * wrap function with span  
     * this method will take a given function and wrap it with given span,
     * so the function can access the span anytime.  
     * the function will handle error and finish the span automatically
     * @param span (Span) the span to wrap the function with
     * @param func (funcion) the function to run  
     * **important** not to call the function directly, call it with arrow function to preserve the original scope 
     * @param params (params[]) all the params that the function will need
     */
    withSpan(span: Span, func: (...params: any[]) => Promise<any>, ...params: any[]) {
        const spw = new spanWrapper(span);
        return spw.bindFunction(func, params);
    }
    /**
     * **experamental feature**, just like `withSpan` method but wrap the function with child tracer 
     */
    withTracer(span: Span, func: (...params: any[]) => Promise<any>, ...params: any[]) {
        const tr = new Tracer(span);
        const trw = new tracerWrapper(tr);
        return trw.bindFunction(func, params);
    }
    /**
     * set or get the active span of the tracer
     * @param span (Span) optional, in case exist, will set the tracer active span to the given span
     */
    activeSpan(span?: Span): Span {
        if (span) {
            return this._activeSpan = span;
        }
        if (!this._activeSpan) throw new Error('could not found active span');
        return this._activeSpan;
    }
    /**
     * return the root span of the tracer
     */
    rootSpan(): Span {
        if (!this._rootSpan) throw new Error('could not found root span');
        return this._rootSpan;
    }
}

/**
 * span wrapper class that inject the given span to wanted function
 */
export class spanWrapper {
    private _span: Span;
    /**
     * 
     * @param span (Span) the span to inject to the function
     */
    constructor(span: Span) {
        this._span = span;
    }
    activeSpan(): Span {
        return this._span;
    }
    /**
     * 
     * @param func (function) the function to run
     * @param params (params[]) the params to call with the function
     */
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

/**
 * **experimental feature** just like `spanWrapper` it wrap function with given tracer
 */
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
            this._tracer.spanSetError(true);
            throw (err);
        } finally {
            this._tracer.finishAll();
        }
    }
}