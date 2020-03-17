import serviceInterface from './serviceInterface';
import TracerRS, { spanRefType } from '../../../utils/tracer';
import { FORMAT_TEXT_MAP, Span, Tags } from 'opentracing';
import { wait } from '../../../utils';

class Service implements serviceInterface {
    start(msg: any): Promise<void> {
        let span: Span | undefined;
        try {
            console.log('do some work');
            let parentSpan;
            if (msg.tracerCarrier) {
                parentSpan = TracerRS.tracer?.extract(FORMAT_TEXT_MAP, msg.tracerCarrier)
            }
            span = TracerRS.startSpan('B-processing', parentSpan, spanRefType.REFERENCES);
            span?.log({
                msg: 'start B processing'
            });
            console.log(`got message: ${JSON.stringify(msg)}`);
            wait(4000);
            span?.log({
                msg: 'finish B processing'
            });
            console.log('finish B logic');
            span?.finish();
            return Promise.resolve();
        } catch (err) {
            console.log(err);
            span?.setTag(Tags.ERROR, true);
            return Promise.reject(err);
        } finally {
            span?.finish();
        }
    }
}

export default new Service();