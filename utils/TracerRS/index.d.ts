import {
    Tags as opTags,
    FORMAT_BINARY,
    FORMAT_HTTP_HEADERS,
    FORMAT_TEXT_MAP,
    REFERENCE_CHILD_OF,
    REFERENCE_FOLLOWS_FROM,
    Span,
} from 'opentracing';

import { TracingConfig, TracingOptions } from 'jaeger-client';
import { JaegerTracer } from 'jaeger-client';
import { v1 as uuid } from 'uuid/interfaces';


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
    export class SpanRS extends Span {
        parentIdRef: uuid;
        childrenIdsRef?: { [key: string]: null };
    }
    /**
     * class that wrap jaeger-client package for more convience way to use
     */
    export class Tracer {
        private _tracer: JaegerTracer;
        private _activeSpans: { [key: string]: SpanRS };
        private _currentActiveSpan: SpanRS;
        /**
         * init jaeger tracer
         */
        static initTracer(config: TracingConfig, options: TracingOptions): void;
        /**
         * create root parent span
         * @param {string} spanName operation name
         * @return {uuid} it's id for later use
         */
        startOperation(spanName: string): uuid;
        /**
         * create new child span
         * @param {string} spanName span name
         * @param {ReferenceTypes} reference refernce type
         * @returns {uuid} new span id
         */
        startSpan(spanName: string, reference?: ReferenceTypes): uuid;
        /**
         * log to span
         * @param {object} object any object
         */
        spanLog(object: any): void;
        /**
         * log to span
         * will add log to the span in format of:  
         * ```json
         * { "message": "message" }
         * ```
         * @param {string} message the message to log
         */
        spanLog(message: string): void;
        /**
         * log an error object to span
         * @param {Error} error error object
         * @param {boolean} setErrorToTrue optional, if set to `true`
         * add to span the `Error` tag with `true` value
         */
        spanError(error: Error, setErrorToTrue?: boolean): void;
        /**
         * add one or more tags to span
         * @param {object} object any valid tag object
         */
        spanTag(object: any): void;
        /**
         * add one tag to span
         * @param {string} key tag key
         * @param {string | number | boolean} value tag value
         */
        spanTag(key: string, value: string | number | boolean): void;
        /**
         * set error tag in the span
         * @param {boolean} isError optional, if exist will set the value to the `error` tag of the span
         */
        spanSetError(isError?: boolean): void;
    }
}
