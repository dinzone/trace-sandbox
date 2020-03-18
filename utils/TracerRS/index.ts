import { globalTracer, Span, initGlobalTracer, SpanOptions, followsFrom, Tags as opTags, FORMAT_TEXT_MAP, FORMAT_HTTP_HEADERS, FORMAT_BINARY, SpanContext } from 'opentracing';
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
class SpanRS extends Span {
    parentIdRef?: string | null;
    childrenIdsRef: { [key: string]: boolean } = {};
    id: string = '';
}
export class Tracer {
    private _tracer!: JaegerTracer;
    private _activeSpans!: { [key: string]: SpanRS };
    private _currentActiveSpan?: SpanRS;
    constructor() {
        if (globalTracer()) {
            this._tracer = globalTracer() as JaegerTracer;
            this._activeSpans = {};
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
    private _startSpan(spanName: string, opt?: SpanOptions): SpanRS {
        let newSpan = this._tracer.startSpan(spanName, opt) as SpanRS;
        newSpan.childrenIdsRef = {};
        newSpan.parentIdRef = null;
        return newSpan;
    }
    // start root span
    private _startOperation(spanName: string): string {
        const spanId = uuid();
        const newSpan = this._startSpan(spanName);
        newSpan.id = spanId;
        this._currentActiveSpan = newSpan;
        this._activeSpans[spanId] = newSpan;
        return spanId;
    }
    startSpan(spanName: string, reference: ReferenceTypes = ReferenceTypes.CHILD_OF): string {
        // in case the root span didnt created
        if (!this._currentActiveSpan) {
            return this._startOperation(spanName);
        }
        // force ref type of child_of in case this is the second span after the root span
        if (reference === ReferenceTypes.FOLLOWS_FROM && !this._currentActiveSpan.parentIdRef) {
            reference = ReferenceTypes.CHILD_OF;
        }
        const spanId = uuid();
        let opt: SpanOptions = {},
            newSpan: SpanRS;
        switch (reference) {
            // default to reference is CHILD_OF
            case ReferenceTypes.CHILD_OF:
                opt.childOf = this._currentActiveSpan.context();
                newSpan = this._startSpan(spanName, opt);
                this._currentActiveSpan.childrenIdsRef[spanId] = true;
                newSpan.parentIdRef = this._currentActiveSpan.id;
                this._activeSpans[spanId] = newSpan;
                break;
            case ReferenceTypes.FOLLOWS_FROM:
                opt.references = [followsFrom(this._currentActiveSpan.context())];
                newSpan = this._startSpan(spanName, opt);
                this._activeSpans[this._currentActiveSpan.parentIdRef!].childrenIdsRef[spanId] = true;
                this._finish(this._currentActiveSpan.id);
                delete this._activeSpans[this._currentActiveSpan.id];
                this._currentActiveSpan = newSpan;
                break;
        }
        return spanId;
    }
    spanLog(object: { [key: string]: any } | string): void {
        if (!this._currentActiveSpan) return;
        if (typeof object === 'string') {
            this._currentActiveSpan.log({
                message: object
            });
            return;
        }
        this._currentActiveSpan.log(object);
    }
    spanError(error: Error, setErrorToTrue: boolean = false): void {
        if (error instanceof Error) {
            this.spanLog({
                'error.name': error.name,
                'error.message': error.message,
                'error.stack': error.stack
            });
            if (setErrorToTrue) {
                this.spanSetError(setErrorToTrue);
            }
        }
    }
    spanTag(object: { [key: string]: any } | string, value?: string | number | boolean): void {
        if (!this._currentActiveSpan) return;
        if (typeof object === 'string') {
            this._currentActiveSpan.setTag(object, value);
        } else {
            this._currentActiveSpan.addTags(object);
        }
    }
    spanSetError(isError: boolean = true): void {
        this.spanTag({ [opTags.ERROR]: isError });
    }
    private _finish(spanId: string) {
        let currSpan = this._activeSpans[spanId];
        delete this._activeSpans[spanId];
        Object.keys(currSpan.childrenIdsRef).forEach(this._finish);
        currSpan.finish();
        if (currSpan.parentIdRef && Object.keys(this._activeSpans[currSpan.parentIdRef].childrenIdsRef).length === 0) {
            this._currentActiveSpan = this._activeSpans[currSpan.parentIdRef];
            this._finish(currSpan.parentIdRef);
        } else {
            this._currentActiveSpan = undefined;
        }
    }
    finish(spanId?: string): void {
        if (spanId && this._activeSpans[spanId]) {
            return this._finish(spanId);
        }
        if (!this._currentActiveSpan) return;
        return this._finish(this._currentActiveSpan.id);
    }
    inject(format = BaggageFormat.TEXT_MAP): object {
        let baggage = {};
        if (this._currentActiveSpan)
            this._tracer.inject(this._currentActiveSpan.context(), format, baggage);
        return baggage;
    }
    extract(baggage: any, format: any): SpanContext | null {
        return this._tracer.extract(format, baggage);
    }
}