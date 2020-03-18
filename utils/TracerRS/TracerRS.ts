import { initTracer, JaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client';
import { Request, Response, NextFunction } from 'express';
import { Span, Tags, SpanContext, followsFrom } from 'opentracing';
import { createNamespace, Namespace } from 'cls-hooked';

class TracerRS {
    tracer?: JaegerTracer;
    private namespace: Namespace
    constructor() {
        this.namespace = createNamespace('TracerRS_NameSpace');
    }
    init(config: TracingConfig = {}, options: TracingOptions = {}): JaegerTracer {
        return this.tracer = initTracer({
            sampler: {
                type: 'const',
                param: 1
            },
            ...config
        }, options)
    }

    injectSpanMiddleware() {
        let self = this;
        return this.namespace.bind((req: Request, res: Response, next: NextFunction) => {
            let currentSpan = self.tracer?.startSpan(req.url);
            self.namespace.set('currentSpan', currentSpan);
            currentSpan?.addTags({
                [Tags.HTTP_METHOD]: req.method,
                [Tags.HTTP_URL]: req.url,
            });
            req.span = currentSpan;
            res.on('finish', () => {
                req.span?.finish();
                self.namespace.set('currentSpan', undefined);
            })
            next();
        });
    }

    error(err: Error): void {
        let currentSpan = this.getCurrentSpan();
        currentSpan?.log({
            'error.message': err.message,
            'error.name': err.name,
            'error.stack': err.stack
        });
        currentSpan?.setTag(Tags.ERROR, true);
    }

    getCurrentSpan(): Span {
        return this.namespace.get('currentSpan');
    }

    log(message: string) {
        let currentSpan = this.getCurrentSpan();
        currentSpan.log({
            message: message
        });
    }

    startSpan(name: string, spanContext?: SpanContext | null, refType?: spanRefType) {
        if (spanContext) {
            let opt: any = {};
            if (!refType || refType === spanRefType.CHILD_OF) {
                opt.childOf = spanContext;
            } else if (refType === spanRefType.REFERENCES) {
                opt[refType] = [followsFrom(spanContext)]
            }
            return this.tracer?.startSpan(name, opt);
        }
        return this.tracer?.startSpan(name);
    }
}

export enum spanRefType {
    CHILD_OF = 'childOf',
    REFERENCES = 'references'
}

export default new TracerRS;