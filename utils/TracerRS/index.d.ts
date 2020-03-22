import {
    SpanContext, Span as opSpan,
} from 'opentracing';

import { TracingConfig, TracingOptions } from 'jaeger-client';
import { JaegerTracer } from 'jaeger-client';


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
    export class Span {
        constructor(span: opSpan);
        /**
         * log to span
         * @param {object} object any object
         */
        log(object: { [key: string]: any }): void;
        /**
         * log to span
         * will add log to the span in format of:  
         * ```json
         * { "message": "message" }
         * ```
         * @param {string} message the message to log
         */
        log(message: string): void;
        /**
         * log an error object to span
         * @param {Error} error error object
         * @param {boolean} setErrorToTrue optional, if set to `true`
         * add to span the `Error` tag with `true` value, default `false`
         */
        error(error: Error, setErrorToTrue?: boolean): void;
        /**
         * add one or more tags to span
         * @param {object} object any valid tag object
         */
        tag(object: { [key: string]: any }): void;
        /**
         * add one tag to span
         * @param {string} key tag key
         * @param {string | number | boolean} value tag value
         */
        tag(key: string, value: string | number | boolean): void;
        /**
         * set error tag in the span
         * @param {boolean} isError optional, if exist will set the value to the `error` tag of the span
         */
        setError(isError?: boolean): void;
        /**
         * get span context
         * @returns the span context
         */
        context(): SpanContext;
        /**
         * finish recursivly the span and its child
         * @param {string} spanId optional, in case of spanId it will finish the span and and its child  
         * if the spanId not exist it do nothing
         */
        finish(): void;
    }
    /**
     * class that wrap jaeger-client package for more convience way to use
     */
    export class Tracer {
        private _tracer: JaegerTracer;
        /**
         * init jaeger tracer
         */
        static initTracer(config: TracingConfig, options: TracingOptions): void;
        /**
         * create root parent span
         * @param {string} spanName operation name
         * @return {string} it's id for later use
         */
        private _startOperation(spanName: string): string;
        /**
         * create new child span, 
         * in case the reference type is FOLLOW_FROM the previous span will finish automaticlly
         * @param {string} spanName span name
         * @param {ReferenceTypes} reference refernce type default to CHILD_OF
         * @returns {string} new span id
         */
        startSpan(spanName: string, reference?: ReferenceTypes): string;
        /**
         * inject span context to outbound process tracing
         * @param format optional, format which inject span context. default to TEXT
         * @returns object with the baggage to send to next process
         */
        inject(format?: any): object;
        /**
         * extract span context from baggage
         * @param baggage the baggae that return from the inject method
         * @returns span context to create new span
         */
        extract(baggage: any): SpanContext | null;
        injectNewSpan(span: Span, func: () => any): Promise<any>;
    }
}
