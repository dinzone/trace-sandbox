import {
    Span as opSpan,
    SpanContext,
} from 'opentracing';

import { TracingConfig, TracingOptions } from 'jaeger-client';


export namespace TracerRS {
    export enum BaggageFormat {
        HTTP_HEADERS,
        TEXT_MAP,
        BINARY
    }
    export enum ReferenceTypes {
        CHILD_OF,
        FOLLOWS_FROM
    }
    /**
    * wrapper for the Opentracing Span
    */
    export class Span {
        /**
        * init new Span
        * @param span (Opentracing Span) the internal Opentracing span
        * @param rootTracer (TracerRS) the tracer that created the span
        * @param parent (Span) optional, the parent span that created this span
        */
        constructor(span: opSpan, rootTracer: Tracer, parent?: Span);
        /**
        * add child to the span list of children
        * @param {Span} child (Span) span child to add to this span
        */
        addChild(child: Span): void;
        /**
        * start new span that related to the current span
        * @param {string} name (string) operation name of the span
        * @param {CHILD_OF | FOLLOWS_FROM} reference (ReferenceTypes), default to `CHILD_OF`
        */
        startSpan(name: string, reference?: ReferenceTypes): Span
        /**
         * add log to span
         * @param object format of
         * ```json
         * { "key": "value" }
         * ```
         * pairs
         */
        log(object: { [key: string]: any }): Span;
        /**
         * add message log to span.  
         * will add log as format 
         * ```json
         * { "messsage": "value" }
         * ```
         * @param message (string) log message
         */
        log(message: string): Span;
        /**
         * log Error to span and set error tag
         * @param {Error} error (Error) the error to log the span
         * @param {Boolean} setErrorToTrue (boolean) optional, if `true` will set the Error tag to true,  
         * default `false`
         */
        error(error: Error, setErrorToTrue?: boolean): Span
        /**
         * add one or more tags to span
         * @param object format of
         * ```json
         * { "key": "value" }
         * ```
         * pairs
         */
        tag(object: { [key: string]: any }): Span;
        /**
         * add one tag to span
         * @param key tag key
         * @param value tag value
         */
        tag(key: string, value: string | number | boolean): Span;
        /**
        * add or set the Error tag of the span
        * @param {boolean} isError (boolean) optional, set the error tag to `true` or `false`, default to `true` 
        */
        setError(isError?: boolean): Span
        /**
         * return span context
         */
        context(): SpanContext
        /**
         * finish the span
         * @param {boolean} finishChildren (boolean) optional, finish also the span children in case of `true`, default to `false`
         */
        finish(finishChildren?: boolean): void
        /**
         * change the span operation name
         * @param spanName (string) the new span name operation
         */
        setName(spanName: string): Span
        /**
         * return the internal Opentracing span
         */
        getInternalSpan(): opSpan
        /**
         * get the tracer that responsible for this span
         */
        getTracer(): Tracer
        /**
         * get span parent, in case there isn't span parent, return undefined
         */
        getParent(): Span | undefined
    }
    /**
     * wrapper for the jaeger tracing object
     * this class will manage the spans
     */
    export class Tracer {
        /**
         * 
         * @param {Tracer} rootSpan (Span) optional, init the tracer with root span and its tracer
         */
        constructor(rootSpan?: Span);
        /**
         * static method, init the global tracer once to use it later
         * @param config (TracingConfig) jaeger tracing config
         * @param options (TracingOptions) jaeger tracing options
         */
        static initTracer(config: TracingConfig, options: TracingOptions): void;
        /**
         * inject span context to carrier and return the carrier
         * @param span (Span) span to inject
         * @param format (BaggageFormat) optional, the format to inject the span context, default to `TEXT_MAP`
         */
        static inject(span: Span, format?: BaggageFormat): object;
        /**
         * extract carrier to span context, may also return null or undefined
         * @param baggage the carrier to extract
         * @param format (BaggageFormat) the baggage format to extract
         */
        static extract(baggage: any, format: BaggageFormat): SpanContext | undefined | null;
        /**
         * create new span that is child or followed by the active span
         * @param spanName (string) span operation name
         * @param parentSpan (SpanRS | SpanContext | null) span or spanContext that the active span create
         * @param reference (ReferenceTypes) optional, default to `CHILD_OF` in case `parentSpan` is provided
         */
        startSpan(spanName: string, parentSpan?: Span | SpanContext | null, reference?: ReferenceTypes): Span;
        /**
         * add log to the active span
         * @param object format of
         * ```json
         * { "key": "value" }
         * ```
         * pairs
         */
        spanLog(object: { [key: string]: any }): Span;
        /**
         * add message log to the active span.  
         * will add log as format 
         * ```json
         * { "messsage": "value" }
         * ```
         * @param message (string) log message
         */
        spanLog(message: string): Span;
        /**
         * log Error to the active span and set error tag
         * @param {Error} error (Error) the error to log the span
         * @param {Boolean} setErrorToTrue (boolean) optional, if `true` will set the Error tag to true,  
         * default `false`
         */
        spanError(error: Error, setErrorToTrue?: boolean): Span
        /**
         * add one or more tags to the active span
         * @param object format of
         * ```json
         * { "key": "value" }
         * ```
         * pairs
         */
        spanTag(object: { [key: string]: any }): Span;
        /**
         * add one tag to the active span
         * @param key tag key
         * @param value tag value
         */
        spanTag(key: string, value: string | number | boolean): Span;
        /**
        * add or set the Error tag of the active span
        * @param {boolean} isError (boolean) optional, set the error tag to `true` or `false`, default to `true` 
        */
        spanSetError(isError?: boolean): Span
        /**
         * return the context of the active span
         */
        context(): SpanContext
        /**
         * finish the active span and the parent of the span become the active span
         * @param {boolean} finishChildren (boolean) optional, finish also the span children in case of `true`, default to `false`
         */
        finish(finishChildren?: boolean): void;
        /**
         * finish all span hierarchy
         */
        finishAll(): void
        /**
         * set the active span operation name
         * @param spanName (string) span new operation name
         */
        setName(spanName: string): Span
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
        withSpan(span: Span, func: (...params: any[]) => Promise<any>, ...params: any[])
        /**
         * **experamental feature**, just like `withSpan` method but wrap the function with child tracer 
         */
        withTracer(span: Span, func: (...params: any[]) => Promise<any>, ...params: any[])
        /**
         * set the active span of the tracer
         * @param span (Span) set the tracer active span to the given span
         */
        activeSpan(span: Span): Span
        /**
         * get the active span of the tracer
         *
         */
        activeSpan(): Span
        /**
         * return the root span of the tracer
         */
        rootSpan(): Span
    }

    /**
 * span wrapper class that inject the given span to wanted function
 */
    export class spanWrapper {
        /**
         * 
         * @param span (Span) the span to inject to the function
         */
        constructor(span: Span)
        activeSpan(): Span
        /**
         * 
         * @param func (function) the function to run
         * @param params (params[]) the params to call with the function
         */
        bindFunction(func: (...parmas: any[]) => Promise<any>, params: any[]): Promise<any>
    }

    /**
     * **experimental feature** just like `spanWrapper` it wrap function with given tracer
     */
    export class tracerWrapper {
        constructor(tracer: Tracer)
        activeTracer(): Tracer
        bindFunction(func: (...parmas: any[]) => Promise<any>, params: any[]): Promise<any>
    }
}
