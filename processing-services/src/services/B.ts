import serviceInterface from './serviceInterface';
import { wait } from '../../../utils';
import { Tracer, BaggageFormat, ReferenceTypes } from '../../../utils/TracerRS';

class Service implements serviceInterface {
    start(msg: any): Promise<void> {
        const tracer = new Tracer();
        try {
            console.log('do some work');
            let parentSpan;
            if (msg.tracerCarrier) {
                parentSpan = Tracer.extract(msg.tracerCarrier, BaggageFormat.TEXT_MAP);
            }
            tracer.startSpan('B-processing', parentSpan, ReferenceTypes.FOLLOWS_FROM);
            tracer.spanLog('start B processing');
            console.log(`got message: ${JSON.stringify(msg)}`);
            wait(4000);
            tracer.spanLog('finish B processing');
            console.log('finish B logic');
            return Promise.resolve();
        } catch (err) {
            console.log(err);
            tracer.setError(true);
            return Promise.reject(err);
        } finally {
            tracer.finish();
        }
    }
}

export default new Service();