import { globalTracer, Span as opSpan, initGlobalTracer, SpanOptions, followsFrom, Tags as opTags, FORMAT_TEXT_MAP, FORMAT_HTTP_HEADERS, FORMAT_BINARY, SpanContext } from 'opentracing';
import { initTracer, JaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client';
import { v1 as uuid } from 'uuid';

export const BaggageFormat = {
    HTTP_HEADERS: FORMAT_HTTP_HEADERS,
    TEXT_MAP: FORMAT_TEXT_MAP,
    BINARY: FORMAT_BINARY
}
export enum ReferenceTypes {
    CHILD_OF = 'child_of',
    FOLLOWS_FROM = 'follow_from'
}
class Span {
    private _span: opSpan;
    constructor(span: opSpan) {
        this._span = span;
    }
    log(object: { [key: string]: any } | string): opSpan {
        if (typeof object === 'string') {
            return this._span.log({
                message: object
            });
        }
        return this._span.log(object);
    }
    error(error: Error, setErrorToTrue: boolean = false): opSpan {
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
        return this._span;
    }
    tag(object: { [key: string]: any } | string, value?: string | number | boolean): opSpan {
        if (typeof object === 'string') {
            return this._span.setTag(object, value);
        } else {
            return this._span.addTags(object);
        }
    }
    setError(isError: boolean = true): opSpan {
        return this.tag({ [opTags.ERROR]: isError });
    }
    context(): SpanContext {
        return this._span.context();
    }
    finish(): void {
        this._span.finish();
    }
}

export class Tracer {
    private _tracer!: JaegerTracer;
    constructor() {
        if (globalTracer()) {
            this._tracer = globalTracer() as JaegerTracer;
        } else {
            throw new Error('must init tracer before create new instance')
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
    // start span helper until i get how to extend normally
    private _startSpan(spanName: string, opt?: SpanOptions): Span {
        let newSpan = new Span(this._tracer.startSpan(spanName, opt));
        return newSpan;
    }
    startSpan(spanName: string, span?: Span, reference: ReferenceTypes = ReferenceTypes.CHILD_OF): Span {
        let opt: SpanOptions = {};
        if (!span) return this._startSpan(spanName);
        switch (reference) {
            case ReferenceTypes.CHILD_OF:
                opt.childOf = span.context();
                break;
            case ReferenceTypes.FOLLOWS_FROM:
                opt.references = [followsFrom(span.context())];
                break;
        }
        return this._startSpan(spanName, opt);
    }
    async injectNewSpan(span: Span, func: () => any): Promise<any> {
        async function _withSpan(this: any) {
            this.span = span;
            return await func();
        }
        return await _withSpan();
    }
    // spanLog(object: { [key: string]: any } | string): void {
    //     if (!this._currentActiveSpan) return;
    //     if (typeof object === 'string') {
    //         this._currentActiveSpan.log({
    //             message: object
    //         });
    //         return;
    //     }
    //     this._currentActiveSpan.log(object);
    // }
    // spanError(error: Error, setErrorToTrue: boolean = false): void {
    //     if (error instanceof Error) {
    //         this.spanLog({
    //             'error.name': error.name,
    //             'error.message': error.message,
    //             'error.stack': error.stack
    //         });
    //         if (setErrorToTrue) {
    //             this.spanSetError(setErrorToTrue);
    //         }
    //     }
    // }
    // spanTag(object: { [key: string]: any } | string, value?: string | number | boolean): void {
    //     if (!this._currentActiveSpan) return;
    //     if (typeof object === 'string') {
    //         this._currentActiveSpan.setTag(object, value);
    //     } else {
    //         this._currentActiveSpan.addTags(object);
    //     }
    // }
    // spanSetError(isError: boolean = true): void {
    //     this.spanTag({ [opTags.ERROR]: isError });
    // }
    // private _finish(spanId: string) {
    //     let currSpan = this._activeSpans[spanId];
    //     delete this._activeSpans[spanId];
    //     Object.keys(currSpan.childrenIdsRef).forEach(this._finish);
    //     currSpan.finish();
    //     if (currSpan.parentIdRef && Object.keys(this._activeSpans[currSpan.parentIdRef].childrenIdsRef).length === 0) {
    //         this._currentActiveSpan = this._activeSpans[currSpan.parentIdRef];
    //         this._finish(currSpan.parentIdRef);
    //     } else {
    //         this._currentActiveSpan = undefined;
    //     }
    // }
    // finish(spanId?: string): void {
    //     if (spanId && this._activeSpans[spanId]) {
    //         return this._finish(spanId);
    //     }
    //     if (!this._currentActiveSpan) return;
    //     return this._finish(this._currentActiveSpan.id);
    // }
    inject(span: Span, format = BaggageFormat.TEXT_MAP): object {
        let baggage = {};
        this._tracer.inject(span.context(), format, baggage);
        return baggage;
    }
    extract(baggage: any, format: any): SpanContext | null {
        return this._tracer.extract(format, baggage);
    }
}